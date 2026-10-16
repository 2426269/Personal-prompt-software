import path from 'node:path/posix'
import { createRequire } from 'node:module'

import type { RemoteModelIndexItem, RemoteModelKind } from '@shared/types/remote'

const require = createRequire(import.meta.url)

interface SFTPAttributesLike {
  size?: number
  mtime?: number
  isDirectory?: () => boolean
}

interface SFTPDirectoryEntryLike {
  filename?: string
  longname?: string
  attrs?: SFTPAttributesLike
}

interface SFTPClientLike {
  readdir: (
    remoteDir: string,
    callback: (error: Error | null, entries: SFTPDirectoryEntryLike[] | undefined) => void,
  ) => void
}

interface ExecStreamLike {
  on: (event: 'close', callback: (code: number | null) => void) => ExecStreamLike
  stderr: {
    on: (event: 'data', callback: (chunk: Buffer | string) => void) => void
  }
  setEncoding?: (encoding: string) => void
}

interface SSHClientLike {
  on: (event: 'ready' | 'error', callback: (error?: Error) => void) => SSHClientLike
  sftp: (callback: (error: Error | null, sftp: SFTPClientLike) => void) => void
  exec: (command: string, callback: (error: Error | null, stream: ExecStreamLike) => void) => void
  connect: (config: {
    host: string
    port: number
    username: string
    password: string
    readyTimeout: number
  }) => void
  end: () => void
}

const { Client } = require('ssh2') as { Client: new () => SSHClientLike }

interface ScanRemoteModelsInput {
  host: string
  port: number
  username: string
  password: string
  comfyRootPath: string
  modelPaths: string[]
  existingItems?: RemoteModelIndexItem[]
  onProgress?: (progress: {
    phase: 'discovering' | 'hashing'
    processed: number
    total: number
    currentPath: string | null
  }) => void
}

interface RemoteFileEntry {
  kind: RemoteModelKind
  filename: string
  stem: string
  path: string
  fileSize: number | null
  modifiedAt: number | null
}

const MODEL_EXTENSIONS = new Set(['.safetensors', '.ckpt', '.pt', '.pth', '.bin'])

function normalizeRemotePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/\.$/, '')
}

function isModelFile(filename: string): boolean {
  return MODEL_EXTENSIONS.has(path.extname(filename).toLowerCase())
}

function isMissingDirectoryError(error: Error): boolean {
  const code = (error as Error & { code?: unknown }).code
  return code === 'ENOENT' || /no such file/i.test(error.message)
}

function toStem(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '')
}

function inferKindFromPath(remotePath: string): RemoteModelKind {
  const normalized = remotePath.toLowerCase()
  if (normalized.includes('/checkpoints/')) {
    return 'checkpoint'
  }
  if (normalized.includes('/vae/')) {
    return 'vae'
  }
  return 'lora'
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`
}

export class SSHManager {
  async scanModels(input: ScanRemoteModelsInput): Promise<RemoteModelIndexItem[]> {
    const client = new Client()

    return new Promise<RemoteModelIndexItem[]>((resolve, reject) => {
      const onError = (error: unknown) => {
        client.end()
        reject(error instanceof Error ? error : new Error(String(error)))
      }

      client.on('ready', () => {
        client.sftp((sftpError: Error | null, sftp: SFTPClientLike) => {
          if (sftpError) {
            onError(sftpError)
            return
          }

          void (async () => {
            try {
              const discovered: RemoteFileEntry[] = []
              let discoveredCount = 0

              for (const relativePath of input.modelPaths) {
                const remoteRoot = normalizeRemotePath(path.join(input.comfyRootPath, relativePath))
                const items = await this.walkDirectory(sftp, remoteRoot, (currentPath) => {
                  discoveredCount += 1
                  input.onProgress?.({
                    phase: 'discovering',
                    processed: discoveredCount,
                    total: 0,
                    currentPath,
                  })
                })
                discovered.push(...items)
              }

              const hashedItems = await this.attachSha256(
                client,
                discovered,
                input.existingItems ?? [],
                input.onProgress,
              )

              client.end()
              resolve(
                hashedItems.map((item) => ({
                  profileId: '',
                  kind: item.kind,
                  filename: item.filename,
                  stem: item.stem,
                  path: item.path,
                  fileSize: item.fileSize,
                  modifiedAt: item.modifiedAt,
                  sha256: item.sha256,
                  civitaiModelId: item.civitaiModelId,
                  civitaiModelVersionId: item.civitaiModelVersionId,
                  lastIndexedAt: null,
                })),
              )
            } catch (error) {
              onError(error)
            }
          })()
        })
      })

      client.on('error', onError)
      client.connect({
        host: input.host,
        port: input.port,
        username: input.username,
        password: input.password,
        readyTimeout: 15000,
      })
    })
  }

  async scanLoras(input: {
    host: string
    port: number
    username: string
    password: string
    comfyRootPath: string
    lorasPaths: string[]
  }): Promise<RemoteModelIndexItem[]> {
    return this.scanModels({
      host: input.host,
      port: input.port,
      username: input.username,
      password: input.password,
      comfyRootPath: input.comfyRootPath,
      modelPaths: input.lorasPaths,
    })
  }

  private async attachSha256(
    client: SSHClientLike,
    items: RemoteFileEntry[],
    existingItems: RemoteModelIndexItem[],
    onProgress?: ScanRemoteModelsInput['onProgress'],
  ): Promise<Array<RemoteFileEntry & {
    sha256: string | null
    civitaiModelId: number | null
    civitaiModelVersionId: number | null
  }>> {
    if (items.length === 0) {
      onProgress?.({
        phase: 'hashing',
        processed: 0,
        total: 0,
        currentPath: null,
      })
      return []
    }

    const chunkSize = 24
    const hashMap = new Map<string, string>()
    const existingMap = new Map(
      existingItems.map((item) => [`${item.kind}:${normalizeRemotePath(item.path)}`, item] as const),
    )
    const results = new Map<string, {
      sha256: string | null
      civitaiModelId: number | null
      civitaiModelVersionId: number | null
    }>()
    const toHash: RemoteFileEntry[] = []
    let processed = 0

    for (const item of items) {
      const existing = existingMap.get(`${item.kind}:${item.path}`) ?? null
      if (
        existing &&
        existing.fileSize === item.fileSize &&
        existing.modifiedAt === item.modifiedAt &&
        existing.sha256
      ) {
        results.set(item.path, {
          sha256: existing.sha256,
          civitaiModelId: existing.civitaiModelId,
          civitaiModelVersionId: existing.civitaiModelVersionId,
        })
        processed += 1
        onProgress?.({
          phase: 'hashing',
          processed,
          total: items.length,
          currentPath: item.path,
        })
      } else {
        toHash.push(item)
      }
    }

    for (let index = 0; index < toHash.length; index += chunkSize) {
      const chunk = toHash.slice(index, index + chunkSize)
      const command = `sha256sum ${chunk.map((item) => shellQuote(item.path)).join(' ')}`
      try {
        const stdout = await this.exec(client, command)
        for (const line of stdout.split(/\r?\n/)) {
          const match = line.match(/^([a-fA-F0-9]{64})\s+\*?(.+)$/)
          if (!match) {
            continue
          }

          hashMap.set(normalizeRemotePath(match[2]), match[1].toLowerCase())
        }
      } catch {
        for (const item of chunk) {
          hashMap.set(item.path, '')
        }
      }

      for (const item of chunk) {
        results.set(item.path, {
          sha256: (hashMap.get(item.path) || null) || null,
          civitaiModelId: null,
          civitaiModelVersionId: null,
        })
        processed += 1
        onProgress?.({
          phase: 'hashing',
          processed,
          total: items.length,
          currentPath: item.path,
        })
      }
    }

    return items.map((item) => ({
      ...item,
      sha256: results.get(item.path)?.sha256 ?? null,
      civitaiModelId: results.get(item.path)?.civitaiModelId ?? null,
      civitaiModelVersionId: results.get(item.path)?.civitaiModelVersionId ?? null,
    }))
  }

  private exec(client: SSHClientLike, command: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      client.exec(command, (error, stream) => {
        if (error) {
          reject(error)
          return
        }

        let stdout = ''
        let stderr = ''
        stream.setEncoding?.('utf8')
        ;(stream as unknown as { on: (event: 'data', callback: (chunk: string) => void) => void }).on('data', (chunk) => {
          stdout += chunk
        })
        stream.stderr.on('data', (chunk) => {
          stderr += chunk.toString()
        })
        stream.on('close', (code) => {
          if (code !== 0 && stderr.trim().length > 0) {
            reject(new Error(stderr.trim()))
            return
          }
          resolve(stdout)
        })
      })
    })
  }

  private walkDirectory(
    sftp: SFTPClientLike,
    remoteDir: string,
    onFile?: (currentPath: string) => void,
  ): Promise<RemoteFileEntry[]> {
    return new Promise<RemoteFileEntry[]>((resolve, reject) => {
      sftp.readdir(remoteDir, (error: Error | null, entries: SFTPDirectoryEntryLike[] | undefined) => {
        if (error) {
          if (isMissingDirectoryError(error)) {
            resolve([])
            return
          }

          reject(error)
          return
        }

        const results: RemoteFileEntry[] = []

        void (async () => {
          try {
            for (const entry of entries ?? []) {
              const filename = typeof entry.filename === 'string' ? entry.filename : ''
              if (!filename || filename === '.' || filename === '..') {
                continue
              }

              const remotePath = normalizeRemotePath(path.join(remoteDir, filename))
              const longname = typeof entry.longname === 'string' ? entry.longname : ''
              const attrs = entry.attrs
              const isDirectory = typeof attrs?.isDirectory === 'function'
                ? attrs.isDirectory()
                : longname.startsWith('d')

              if (isDirectory) {
                results.push(...(await this.walkDirectory(sftp, remotePath, onFile)))
                continue
              }

              if (!isModelFile(filename)) {
                continue
              }

              results.push({
                kind: inferKindFromPath(remotePath),
                filename,
                stem: toStem(filename),
                path: remotePath,
                fileSize: typeof attrs?.size === 'number' ? attrs.size : null,
                modifiedAt: typeof attrs?.mtime === 'number' ? attrs.mtime : null,
              })
              onFile?.(remotePath)
            }

            resolve(results)
          } catch (innerError) {
            reject(innerError instanceof Error ? innerError : new Error(String(innerError)))
          }
        })()
      })
    })
  }
}
