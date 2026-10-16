import type { Database } from 'better-sqlite3'

import type {
  AppLogClearInput,
  AppLogLevel,
  AppLogListInput,
  AppLogListResult,
  AppLogModule,
  AppLogRecord,
} from '@shared/types/logs'

import { getDatabase } from '../database'

interface AppLogRow {
  id: string
  created_at: string
  module: AppLogModule
  level: AppLogLevel
  action: string
  summary: string
  entry_id: string | null
  image_index: number | null
  request_json: string | null
  response_json: string | null
  error_json: string | null
  tags_json: string
}

interface AppLogInsertRow {
  id: string
  module: AppLogModule
  level: AppLogLevel
  action: string
  summary: string
  entry_id: string | null
  image_index: number | null
  request_json: string | null
  response_json: string | null
  error_json: string | null
  tags_json: string
}

function parseJson(value: string | null): unknown {
  if (!value) {
    return null
  }

  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}

function parseTags(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function toRecord(row: AppLogRow): AppLogRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    module: row.module,
    level: row.level,
    action: row.action,
    summary: row.summary,
    entryId: row.entry_id,
    imageIndex: row.image_index,
    requestJson: parseJson(row.request_json),
    responseJson: parseJson(row.response_json),
    errorJson: parseJson(row.error_json),
    tags: parseTags(row.tags_json),
  }
}

function buildWhereClause(input: AppLogListInput = {}): { sql: string; params: Record<string, unknown> } {
  const conditions: string[] = []
  const params: Record<string, unknown> = {}

  if (input.module && input.module !== 'all') {
    conditions.push('module = @module')
    params.module = input.module
  }

  if (input.level && input.level !== 'all') {
    conditions.push('level = @level')
    params.level = input.level
  }

  if (input.timeRange && input.timeRange !== 'all') {
    const hours = input.timeRange === '1h' ? 1 : input.timeRange === '24h' ? 24 : 24 * 7
    conditions.push(`datetime(created_at) >= datetime('now', '-${hours} hours')`)
  }

  if (input.query?.trim()) {
    params.query = `%${input.query.trim()}%`
    conditions.push(`(
      summary LIKE @query OR
      action LIKE @query OR
      IFNULL(request_json, '') LIKE @query OR
      IFNULL(response_json, '') LIKE @query OR
      IFNULL(error_json, '') LIKE @query OR
      IFNULL(tags_json, '') LIKE @query
    )`)
  }

  return {
    sql: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  }
}

export class AppLogsRepository {
  private get db(): Database {
    return getDatabase()
  }

  insert(row: AppLogInsertRow): void {
    this.db.prepare(`
      INSERT INTO app_logs (
        id, module, level, action, summary, entry_id, image_index,
        request_json, response_json, error_json, tags_json, created_at
      ) VALUES (
        @id, @module, @level, @action, @summary, @entry_id, @image_index,
        @request_json, @response_json, @error_json, @tags_json, CURRENT_TIMESTAMP
      )
    `).run(row)
  }

  getById(id: string): AppLogRecord | null {
    const row = this.db.prepare<[string], AppLogRow>(`
      SELECT *
      FROM app_logs
      WHERE id = ?
      LIMIT 1
    `).get(id)

    return row ? toRecord(row) : null
  }

  list(input: AppLogListInput = {}): AppLogListResult {
    const { sql, params } = buildWhereClause(input)
    const limit = Math.min(Math.max(input.limit ?? 200, 1), 1000)
    const offset = Math.max(input.offset ?? 0, 0)

    const rows = this.db.prepare(`
      SELECT *
      FROM app_logs
      ${sql}
      ORDER BY datetime(created_at) DESC, rowid DESC
      LIMIT @limit OFFSET @offset
    `).all({ ...params, limit, offset }) as AppLogRow[]

    const totalRow = this.db.prepare(`
      SELECT COUNT(*) AS total
      FROM app_logs
      ${sql}
    `).get(params) as { total: number }

    return {
      items: rows.map(toRecord),
      total: totalRow.total,
    }
  }

  clear(input: AppLogClearInput = {}): number {
    if (input.module && input.module !== 'all') {
      const result = this.db.prepare('DELETE FROM app_logs WHERE module = ?').run(input.module)
      return result.changes
    }

    const result = this.db.prepare('DELETE FROM app_logs').run()
    return result.changes
  }
}
