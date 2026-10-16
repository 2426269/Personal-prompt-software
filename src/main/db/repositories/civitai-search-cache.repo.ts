import type { Database } from 'better-sqlite3'

import type { CivitaiModelMatch } from '@shared/types/civitai'

import { getDatabase } from '../database'

interface CivitaiSearchCacheRow {
  cache_key: string
  query_type: string
  query_value: string
  response_json: string
  updated_at: string
}

export class CivitaiSearchCacheRepository {
  private readonly db: Database

  constructor(db: Database = getDatabase()) {
    this.db = db
  }

  get(cacheKey: string): CivitaiModelMatch | null {
    const row = this.db.prepare<[string], CivitaiSearchCacheRow>(`
      SELECT cache_key, query_type, query_value, response_json, updated_at
      FROM civitai_search_cache
      WHERE cache_key = ?
      LIMIT 1
    `).get(cacheKey)

    if (!row) {
      return null
    }

    try {
      return JSON.parse(row.response_json) as CivitaiModelMatch
    } catch {
      return null
    }
  }

  set(cacheKey: string, queryType: string, queryValue: string, result: CivitaiModelMatch): void {
    this.db.prepare(`
      INSERT INTO civitai_search_cache (cache_key, query_type, query_value, response_json, updated_at)
      VALUES (@cache_key, @query_type, @query_value, @response_json, CURRENT_TIMESTAMP)
      ON CONFLICT(cache_key) DO UPDATE SET
        query_type = excluded.query_type,
        query_value = excluded.query_value,
        response_json = excluded.response_json,
        updated_at = CURRENT_TIMESTAMP
    `).run({
      cache_key: cacheKey,
      query_type: queryType,
      query_value: queryValue,
      response_json: JSON.stringify(result),
    })
  }
}
