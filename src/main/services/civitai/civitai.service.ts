import type {
  CivitaiConfigInput,
  CivitaiConfigSummary,
  CivitaiConfigTestResult,
  CivitaiModelMatch,
  CivitaiSearchInput,
} from '@shared/types/civitai'

import { AppError } from '../../ipc/wrap-ipc'
import { CivitaiConfigRepository } from '../../db/repositories/civitai-config.repo'
import { CivitaiSearchCacheRepository } from '../../db/repositories/civitai-search-cache.repo'
import { writeStructuredLog } from '../../logging'
import { CivitaiClient, CivitaiRequestError } from './civitai-client'

function buildCacheKey(prefix: string, value: string): string {
  return `${prefix}:${value.trim().toLowerCase()}`
}

function isNotFound(error: unknown): boolean {
  return error instanceof CivitaiRequestError && error.status === 404
}

export class CivitaiService {
  constructor(
    private readonly configRepository: CivitaiConfigRepository = new CivitaiConfigRepository(),
    private readonly cacheRepository: CivitaiSearchCacheRepository = new CivitaiSearchCacheRepository(),
    private readonly client: CivitaiClient = new CivitaiClient(),
  ) {}

  getConfig(): CivitaiConfigSummary {
    return this.configRepository.get()
  }

  saveConfig(input: CivitaiConfigInput): CivitaiConfigSummary {
    return this.configRepository.save(input)
  }

  async testConfig(): Promise<CivitaiConfigTestResult> {
    const apiKey = this.configRepository.getApiKey()
    const startedAt = Date.now()
    try {
      await this.client.test(apiKey)
      const result = {
        ok: true,
        latencyMs: Date.now() - startedAt,
        message: 'Civitai 连接正常。',
      }
      writeStructuredLog({
        module: 'civitai',
        level: 'info',
        action: 'config.test',
        summary: 'Civitai 连接测试成功。',
        response: result,
      })
      return result
    } catch (error) {
      writeStructuredLog({
        module: 'civitai',
        level: 'error',
        action: 'config.test',
        summary: 'Civitai 连接测试失败。',
        error,
      })
      throw new AppError('CIVITAI_TEST_FAILED', error instanceof Error ? error.message : String(error))
    }
  }

  async getByHash(input: CivitaiSearchInput): Promise<CivitaiModelMatch | null> {
    const hash = input.hash?.trim()
    if (!hash) {
      throw new AppError('CIVITAI_INVALID_INPUT', '缺少 hash，无法按哈希查询。')
    }

    const cacheKey = buildCacheKey('hash', hash)
    if (!input.forceRefresh) {
      const cached = this.cacheRepository.get(cacheKey)
      if (cached) {
        return cached
      }
    }

    const match = await this.client.getByHash(hash, this.configRepository.getApiKey())
    if (match) {
      this.cacheRepository.set(cacheKey, 'hash', hash, match)
    }
    writeStructuredLog({
      module: 'civitai',
      level: 'info',
      action: 'search.by_hash',
      summary: match ? `Civitai hash 命中：${hash}` : `Civitai hash 未命中：${hash}`,
      request: { hash },
      response: match,
    })
    return match
  }

  async getByVersion(input: CivitaiSearchInput): Promise<CivitaiModelMatch | null> {
    if (input.modelVersionId == null) {
      throw new AppError('CIVITAI_INVALID_INPUT', '缺少 modelVersionId，无法按版本查询。')
    }

    const cacheKey = buildCacheKey('version', String(input.modelVersionId))
    if (!input.forceRefresh) {
      const cached = this.cacheRepository.get(cacheKey)
      if (cached) {
        return cached
      }
    }

    const match = await this.client.getByVersion(input.modelVersionId, this.configRepository.getApiKey())
    if (match) {
      this.cacheRepository.set(cacheKey, 'version', String(input.modelVersionId), match)
    }
    writeStructuredLog({
      module: 'civitai',
      level: 'info',
      action: 'search.by_version',
      summary: match ? `Civitai version 命中：${input.modelVersionId}` : `Civitai version 未命中：${input.modelVersionId}`,
      request: { modelVersionId: input.modelVersionId },
      response: match,
    })
    return match
  }

  async searchModel(input: CivitaiSearchInput): Promise<CivitaiModelMatch | null> {
    if (input.modelVersionId != null) {
      try {
        const byVersion = await this.getByVersion(input)
        if (byVersion) {
          return byVersion
        }
      } catch (error) {
        if (!isNotFound(error)) {
          throw error
        }
      }
    }

    if (input.hash?.trim()) {
      try {
        const byHash = await this.getByHash(input)
        if (byHash) {
          return byHash
        }
      } catch (error) {
        if (!isNotFound(error)) {
          throw error
        }
      }
    }

    const query = input.query?.trim()
    if (!query) {
      throw new AppError('CIVITAI_INVALID_INPUT', '缺少 query，无法按名称搜索。')
    }

    const cacheKey = buildCacheKey(`name:${input.kind}`, query)
    if (!input.forceRefresh) {
      const cached = this.cacheRepository.get(cacheKey)
      if (cached) {
        return cached
      }
    }

    const match = await this.client.searchByName(query, input.kind, this.configRepository.getApiKey())
    if (match) {
      this.cacheRepository.set(cacheKey, `name:${input.kind}`, query, match)
    }
    writeStructuredLog({
      module: 'civitai',
      level: 'info',
      action: 'search.by_name',
      summary: match ? `Civitai 名称搜索命中：${query}` : `Civitai 名称搜索未命中：${query}`,
      request: { kind: input.kind, query },
      response: match,
    })
    return match
  }
}
