import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

import type {
  AppLogClearInput,
  AppLogClearResult,
  AppLogExportInput,
  AppLogExportResult,
  AppLogLevel,
  AppLogListInput,
  AppLogListResult,
  AppLogModule,
  AppLogRecord,
  AppLogSummary,
  AppLogSummaryItem,
} from '@shared/types/logs'

import { AppError } from '../../ipc/wrap-ipc'
import { AppLogsRepository } from '../../db/repositories/app-logs.repo'

export interface AppLogWriteInput {
  module: AppLogModule
  level: AppLogLevel
  action: string
  summary: string
  entryId?: string | null
  imageIndex?: number | null
  request?: unknown
  response?: unknown
  error?: unknown
  tags?: string[]
}

const REDACTED = '[REDACTED]'
const SENSITIVE_KEYS = new Set([
  'apikey',
  'api_key',
  'authorization',
  'password',
  'sshpassword',
  'ssh_password',
  'token',
  'bearer',
])

const DEFAULT_TAGS = [
  { key: 'LLM_INVALID_ARGUMENT', test: (record: AppLogRecord) => record.module === 'llm' && JSON.stringify(record.errorJson ?? '').includes('INVALID_ARGUMENT') },
  { key: 'LLM_HTTP_4XX', test: (record: AppLogRecord) => record.module === 'llm' && /LLM 请求失败 \(4\d\d\)/.test(JSON.stringify(record.errorJson ?? '')) },
  { key: 'LLM_NETWORK_ERROR', test: (record: AppLogRecord) => record.module === 'llm' && /LLM_NETWORK_ERROR|fetch failed|ENOTFOUND|ECONNRESET|ETIMEDOUT|CERT_|UND_ERR/i.test(JSON.stringify(record.errorJson ?? '')) },
  { key: 'COMFY_CONNECTION_ERROR', test: (record: AppLogRecord) => record.module === 'comfy' && /COMFY_(NETWORK_ERROR|HTTP_ERROR|TIMEOUT)/.test(JSON.stringify(record.errorJson ?? '')) },
  { key: 'COMFY_HISTORY_UNAVAILABLE', test: (record: AppLogRecord) => record.module === 'comfy' && JSON.stringify(record.errorJson ?? '').includes('COMFY_HISTORY_UNAVAILABLE') },
  { key: 'SSH_AUTH_FAILED', test: (record: AppLogRecord) => record.module === 'ssh' && /authentication/i.test(JSON.stringify(record.errorJson ?? '')) },
  { key: 'SSH_TIMEOUT', test: (record: AppLogRecord) => record.module === 'ssh' && /timed out|timeout/i.test(JSON.stringify(record.errorJson ?? '')) },
  { key: 'CIVITAI_404', test: (record: AppLogRecord) => record.module === 'civitai' && /404/.test(JSON.stringify(record.errorJson ?? '')) },
  { key: 'CIVITAI_TIMEOUT', test: (record: AppLogRecord) => record.module === 'civitai' && /超时|timeout/i.test(JSON.stringify(record.errorJson ?? '')) },
  { key: 'PRELOAD_LOAD_FAILED', test: (record: AppLogRecord) => record.module === 'main' && /preload/i.test(JSON.stringify(record.errorJson ?? '')) },
]

function serializeError(error: unknown): unknown {
  if (error instanceof Error) {
    const errorRecord = error as unknown as Record<string, unknown>
    const details = Object.fromEntries(
      Object.entries(errorRecord)
        .filter(([key]) => !['name', 'message', 'stack'].includes(key)),
    )

    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
      ...(Object.keys(details).length > 0 ? details : {}),
      ...(error.cause !== undefined ? { cause: serializeError(error.cause) } : {}),
    }
  }

  if (Array.isArray(error)) {
    return error.map((item) => serializeError(item))
  }

  if (typeof error === 'object' && error !== null) {
    return Object.fromEntries(
      Object.entries(error as Record<string, unknown>).map(([key, value]) => [key, serializeError(value)]),
    )
  }

  return error
}

function sanitizeUnknown(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeUnknown(item))
  }

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => {
        const normalizedKey = key.replace(/[^a-z0-9]/gi, '').toLowerCase()
        if (SENSITIVE_KEYS.has(normalizedKey)) {
          return [key, REDACTED]
        }

        if (
          typeof item === 'string'
          && (normalizedKey.includes('authorization') || normalizedKey.includes('apikey') || normalizedKey.includes('password'))
        ) {
          return [key, REDACTED]
        }

        return [key, sanitizeUnknown(item)]
      }),
    )
  }

  if (typeof value === 'string' && /^Bearer\s+/i.test(value)) {
    return REDACTED
  }

  return value
}

function safeJsonStringify(value: unknown): string | null {
  if (value == null) {
    return null
  }

  try {
    return JSON.stringify(sanitizeUnknown(value))
  } catch {
    return JSON.stringify({ unserializable: true })
  }
}

function deriveTags(record: AppLogRecord, explicitTags: string[]): string[] {
  const derived = DEFAULT_TAGS.filter((item) => item.test(record)).map((item) => item.key)
  return Array.from(new Set([...explicitTags, ...derived]))
}

function resolveExportDir(): string {
  return path.join(app.getPath('userData'), 'exports')
}

export class AppLogsService {
  constructor(
    private readonly repository: AppLogsRepository = new AppLogsRepository(),
  ) {}

  write(input: AppLogWriteInput): void {
    const id = crypto.randomUUID()
    const requestJson = safeJsonStringify(input.request)
    const responseJson = safeJsonStringify(input.response)
    const errorJson = safeJsonStringify(serializeError(input.error))

    const baseRecord: AppLogRecord = {
      id,
      createdAt: new Date().toISOString(),
      module: input.module,
      level: input.level,
      action: input.action,
      summary: input.summary,
      entryId: input.entryId ?? null,
      imageIndex: input.imageIndex ?? null,
      requestJson: requestJson ? JSON.parse(requestJson) : null,
      responseJson: responseJson ? JSON.parse(responseJson) : null,
      errorJson: errorJson ? JSON.parse(errorJson) : null,
      tags: [],
    }

    const tags = deriveTags(baseRecord, input.tags ?? [])

    try {
      this.repository.insert({
        id,
        module: input.module,
        level: input.level,
        action: input.action,
        summary: input.summary,
        entry_id: input.entryId ?? null,
        image_index: input.imageIndex ?? null,
        request_json: requestJson,
        response_json: responseJson,
        error_json: errorJson,
        tags_json: JSON.stringify(tags),
      })
    } catch {
      // Ignore structured log write failures. File logs remain the fallback.
    }
  }

  list(input: AppLogListInput = {}): AppLogListResult {
    return this.repository.list(input)
  }

  get(id: string): AppLogRecord | null {
    return this.repository.getById(id)
  }

  getSummary(input: AppLogListInput = {}): AppLogSummary {
    const result = this.repository.list({
      ...input,
      limit: 1000,
      offset: 0,
    })

    const moduleMap = new Map<string, AppLogSummaryItem>()
    const tagMap = new Map<string, AppLogSummaryItem>()

    for (const item of result.items) {
      const moduleEntry = moduleMap.get(item.module) ?? { key: item.module, count: 0, lastSeenAt: item.createdAt }
      moduleEntry.count += 1
      if (!moduleEntry.lastSeenAt || moduleEntry.lastSeenAt < item.createdAt) {
        moduleEntry.lastSeenAt = item.createdAt
      }
      moduleMap.set(item.module, moduleEntry)

      for (const tag of item.tags) {
        const tagEntry = tagMap.get(tag) ?? { key: tag, count: 0, lastSeenAt: item.createdAt }
        tagEntry.count += 1
        if (!tagEntry.lastSeenAt || tagEntry.lastSeenAt < item.createdAt) {
          tagEntry.lastSeenAt = item.createdAt
        }
        tagMap.set(tag, tagEntry)
      }
    }

    return {
      total: result.total,
      modules: [...moduleMap.values()].sort((left, right) => right.count - left.count),
      problemTags: [...tagMap.values()].sort((left, right) => right.count - left.count),
    }
  }

  clear(input: AppLogClearInput = {}): AppLogClearResult {
    return {
      deletedCount: this.repository.clear(input),
    }
  }

  export(input: AppLogExportInput): AppLogExportResult {
    const result = this.repository.list({
      module: input.module,
      level: input.level,
      timeRange: input.timeRange,
      query: input.query,
      limit: 1000,
      offset: 0,
    })

    if (result.items.length === 0) {
      throw new AppError('LOGS_EXPORT_EMPTY', '当前筛选条件下没有可导出的日志。')
    }

    const exportDir = resolveExportDir()
    fs.mkdirSync(exportDir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filePath = path.join(exportDir, `promptforge-logs-${stamp}.${input.format}`)
    const payload = input.format === 'json'
      ? JSON.stringify(result.items, null, 2)
      : result.items.map((item) => JSON.stringify(item)).join('\n')

    fs.writeFileSync(filePath, payload, 'utf8')

    return {
      filePath,
      recordCount: result.items.length,
      format: input.format,
    }
  }
}
