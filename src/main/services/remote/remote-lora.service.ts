import path from 'node:path'

import type {
  EntryRemoteModelCheck,
  RemoteModelIndexItem,
  RemoteModelKind,
  RemoteModelScanProgress,
  RemoteModelScanInput,
  RemoteModelScanResult,
  RemoteProfileInput,
  RemoteProfileSummary,
} from '@shared/types/remote'
import type { PromptModelReference, PromptTag } from '@shared/types/importer'

import { AppError } from '../../ipc/wrap-ipc'
import { RemoteModelIndexRepository } from '../../db/repositories/remote-model-index.repo'
import { RemoteProfilesRepository, type RemoteProfileRow } from '../../db/repositories/remote-profiles.repo'
import { writeStructuredLog } from '../../logging'
import { SSHManager } from '../ssh/ssh-manager'

function parsePaths(rawValue: string): string[] {
  try {
    const parsed = JSON.parse(rawValue) as unknown
    if (Array.isArray(parsed)) {
      const filtered = parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      return filtered.length > 0 ? filtered : ['models/loras', 'models/lycoris', 'models/checkpoints']
    }
  } catch {
    return ['models/loras', 'models/lycoris', 'models/checkpoints']
  }

  return ['models/loras', 'models/lycoris', 'models/checkpoints']
}

function trimTrailingSlash(value: string): string {
  return value.replace(/[\\/]+$/, '')
}

function normalizeModelToken(value: string): string[] {
  const lowered = value.replace(/\\/g, '/').toLowerCase()
  const basename = path.posix.basename(lowered)
  const stem = basename.replace(/\.[^/.]+$/, '')
  return Array.from(new Set([lowered, basename, stem]))
}

function normalizeHash(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim().toLowerCase()
  return trimmed.length > 0 ? trimmed : null
}

export class RemoteLoraService {
  constructor(
    private readonly profilesRepository: RemoteProfilesRepository = new RemoteProfilesRepository(),
    private readonly indexRepository: RemoteModelIndexRepository = new RemoteModelIndexRepository(),
    private readonly sshManager: SSHManager = new SSHManager(),
  ) {}

  listProfiles(): RemoteProfileSummary[] {
    return this.profilesRepository.list().map((row) => this.toSummary(row))
  }

  getProfile(id: string): RemoteProfileSummary | null {
    const row = this.profilesRepository.getById(id)
    return row ? this.toSummary(row) : null
  }

  saveProfile(input: RemoteProfileInput): RemoteProfileSummary {
    const name = input.name.trim()
    if (!name) {
      throw new AppError('REMOTE_PROFILE_INVALID', '远端配置名称不能为空。')
    }

    const comfyBaseUrl = trimTrailingSlash(input.comfyBaseUrl.trim())
    if (!/^https?:\/\//i.test(comfyBaseUrl)) {
      throw new AppError('REMOTE_PROFILE_INVALID', 'ComfyUI 地址必须以 http:// 或 https:// 开头。')
    }

    if (!Number.isFinite(input.sshPort) || input.sshPort <= 0) {
      throw new AppError('REMOTE_PROFILE_INVALID', 'SSH 端口必须是有效正整数。')
    }

    const modelPaths = input.lorasPaths.map((value) => value.trim()).filter(Boolean)
    const id = this.profilesRepository.upsert({
      ...input,
      name,
      comfyBaseUrl,
      comfyHistoryRoute: input.comfyHistoryRoute?.trim() || '/history',
      sshHost: input.sshHost?.trim() || null,
      sshUser: input.sshUser?.trim() || null,
      comfyRootPath: input.comfyRootPath?.trim() || null,
      lorasPaths: modelPaths.length > 0 ? modelPaths : ['models/loras', 'models/lycoris', 'models/checkpoints'],
    })

    const saved = this.getProfile(id)
    if (!saved) {
      throw new AppError('REMOTE_PROFILE_SAVE_FAILED', '远端配置保存失败。')
    }

    return saved
  }

  deleteProfile(id: string): boolean {
    return this.profilesRepository.delete(id)
  }

  async scanModels(
    input: RemoteModelScanInput,
    onProgress?: (progress: RemoteModelScanProgress) => void,
  ): Promise<RemoteModelScanResult> {
    const profile = this.profilesRepository.getById(input.profileId)
    if (!profile) {
      throw new AppError('REMOTE_PROFILE_NOT_FOUND', '未找到指定的远端配置。')
    }

    if (!profile.ssh_host || !profile.ssh_user) {
      throw new AppError('REMOTE_PROFILE_INVALID', '请先填写 SSH 主机和用户名。')
    }

    if (!profile.comfy_root_path) {
      throw new AppError('REMOTE_PROFILE_INVALID', '请先填写远端 ComfyUI 根目录。')
    }

    let password: string | null
    try {
      password = this.profilesRepository.getPassword(profile.id)
    } catch {
      throw new AppError('REMOTE_PROFILE_PASSWORD_INVALID', '已保存的 SSH 密码无法解密，请重新输入 SSH 密码并保存配置。')
    }

    if (!password) {
      throw new AppError('REMOTE_PROFILE_INVALID', '请先填写 SSH 密码。')
    }

    const scannedAt = new Date().toISOString()
    const existingItems = this.indexRepository.listByProfileId(profile.id)
    writeStructuredLog({
      module: 'remote_model',
      level: 'info',
      action: 'scan.start',
      summary: `开始扫描远端模型：${profile.name}`,
      request: {
        profileId: profile.id,
        profileName: profile.name,
        sshHost: profile.ssh_host,
        sshPort: profile.ssh_port,
        comfyRootPath: profile.comfy_root_path,
        modelPaths: parsePaths(profile.loras_paths),
      },
      tags: ['SCAN_STARTED'],
    })

    let lastPhase: RemoteModelScanProgress['phase'] | null = null

    try {
      const items = await this.sshManager.scanModels({
        host: profile.ssh_host,
        port: profile.ssh_port,
        username: profile.ssh_user,
        password,
        comfyRootPath: profile.comfy_root_path,
        modelPaths: parsePaths(profile.loras_paths),
        existingItems,
        onProgress: (progress) => {
          onProgress?.({
            profileId: profile.id,
            phase: progress.phase,
            processed: progress.processed,
            total: progress.total,
            currentPath: progress.currentPath,
          })

          if (progress.phase !== lastPhase) {
            lastPhase = progress.phase
            writeStructuredLog({
              module: 'ssh',
              level: 'debug',
              action: 'scan.progress',
              summary: `远端扫描阶段切换：${progress.phase}`,
              request: {
                profileId: profile.id,
                profileName: profile.name,
                phase: progress.phase,
                processed: progress.processed,
                total: progress.total,
                currentPath: progress.currentPath,
              },
            })
          }
        },
      })

      this.indexRepository.replaceForProfile(
        profile.id,
        items.map((item) => ({ ...item, profileId: profile.id })),
        scannedAt,
      )
      this.profilesRepository.setLastScannedAt(profile.id, scannedAt)
      onProgress?.({
        profileId: profile.id,
        phase: 'done',
        processed: items.length,
        total: items.length,
        currentPath: null,
      })

      const result = {
        profileId: profile.id,
        scannedCount: items.length,
        scannedAt,
        counts: {
          lora: items.filter((item) => item.kind === 'lora').length,
          checkpoint: items.filter((item) => item.kind === 'checkpoint').length,
          vae: items.filter((item) => item.kind === 'vae').length,
        },
      }

      writeStructuredLog({
        module: 'remote_model',
        level: 'info',
        action: 'scan.complete',
        summary: `远端模型扫描完成：${profile.name}`,
        response: result,
        tags: ['SCAN_COMPLETED'],
      })

      return result
    } catch (error) {
      writeStructuredLog({
        module: 'ssh',
        level: 'error',
        action: 'scan.error',
        summary: `远端模型扫描失败：${profile.name}`,
        request: {
          profileId: profile.id,
          profileName: profile.name,
          sshHost: profile.ssh_host,
          sshPort: profile.ssh_port,
        },
        error,
      })
      throw error
    }
  }

  async scanLoras(
    input: RemoteModelScanInput,
    onProgress?: (progress: RemoteModelScanProgress) => void,
  ): Promise<RemoteModelScanResult> {
    return this.scanModels(input, onProgress)
  }

  getModelIndex(profileId: string): RemoteModelIndexItem[] {
    return this.indexRepository.listByProfileId(profileId)
  }

  getLoraIndex(profileId: string): RemoteModelIndexItem[] {
    return this.indexRepository.listByProfileIdAndKind(profileId, 'lora')
  }

  matchPromptTags(loras: PromptTag[], profileId?: string | null): EntryRemoteModelCheck | null {
    return this.matchModels(loras, 'lora', profileId)
  }

  matchCheckpoints(checkpoints: PromptModelReference[], profileId?: string | null): EntryRemoteModelCheck | null {
    return this.matchModels(checkpoints, 'checkpoint', profileId)
  }

  private matchModels(
    models: PromptModelReference[],
    kind: RemoteModelKind,
    profileId?: string | null,
  ): EntryRemoteModelCheck | null {
    const profile = profileId ? this.profilesRepository.getById(profileId) : this.profilesRepository.getDefault()
    if (!profile) {
      return null
    }

    const indexedItems = this.indexRepository.listByProfileIdAndKind(profile.id, kind)
    const pathMatchSet = new Map<string, RemoteModelIndexItem>()
    const hashMatchSet = new Map<string, RemoteModelIndexItem>()
    const versionMatchSet = new Map<number, RemoteModelIndexItem>()

    for (const item of indexedItems) {
      for (const token of normalizeModelToken(item.path)) {
        pathMatchSet.set(token, item)
      }

      for (const token of normalizeModelToken(item.filename)) {
        if (!pathMatchSet.has(token)) {
          pathMatchSet.set(token, item)
        }
      }

      const hash = normalizeHash(item.sha256)
      if (hash) {
        hashMatchSet.set(hash, item)
      }

      if (typeof item.civitaiModelVersionId === 'number') {
        versionMatchSet.set(item.civitaiModelVersionId, item)
      }
    }

    return {
      profileId: profile.id,
      profileName: profile.name,
      kind,
      isScanned: profile.last_scanned_at !== null,
      items: models.map((model) => {
        const versionMatch = model.modelVersionId != null ? versionMatchSet.get(model.modelVersionId) ?? null : null
        if (versionMatch) {
          return {
            model,
            kind,
            exists: true,
            matchedPath: versionMatch.path,
            matchedHash: versionMatch.sha256,
            matchType: 'exact_version' as const,
          }
        }

        const normalizedModelHash = normalizeHash(model.hash)
        const hashMatch = normalizedModelHash ? hashMatchSet.get(normalizedModelHash) ?? null : null
        if (hashMatch) {
          return {
            model,
            kind,
            exists: true,
            matchedPath: hashMatch.path,
            matchedHash: hashMatch.sha256,
            matchType: 'exact_hash' as const,
          }
        }

        const pathMatch = normalizeModelToken(model.text)
          .map((token) => pathMatchSet.get(token) ?? null)
          .find((value): value is RemoteModelIndexItem => value !== null) ?? null

        if (pathMatch) {
          return {
            model,
            kind,
            exists: true,
            matchedPath: pathMatch.path,
            matchedHash: pathMatch.sha256,
            matchType: 'name_guess' as const,
          }
        }

        return {
          model,
          kind,
          exists: false,
          matchedPath: null,
          matchedHash: null,
          matchType: 'none' as const,
        }
      }),
    }
  }

  private toSummary(row: RemoteProfileRow): RemoteProfileSummary {
    const stats = this.indexRepository.getStats(row.id)
    return {
      id: row.id,
      name: row.name,
      comfyBaseUrl: row.comfy_base_url,
      comfyHistoryRoute: row.comfy_history_route,
      sshHost: row.ssh_host,
      sshPort: row.ssh_port,
      sshUser: row.ssh_user,
      comfyRootPath: row.comfy_root_path,
      lorasPaths: parsePaths(row.loras_paths),
      hasPassword: Boolean(row.ssh_password_encrypted && row.ssh_password_encrypted.length > 0),
      isDefault: row.is_default === 1,
      indexedFileCount: stats.indexed_count,
      indexedLoraCount: stats.indexed_lora_count,
      indexedCheckpointCount: stats.indexed_checkpoint_count,
      lastSyncedAt: row.last_scanned_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }
}
