import type { Database } from 'better-sqlite3'

import type { RemoteLoraIndexItem } from '@shared/types/remote'

import { getDatabase } from '../database'

export interface RemoteLoraIndexRow {
  profile_id: string
  filename: string
  path: string
  file_size: number | null
  last_synced_at: string | null
  civitai_url: string | null
  civitai_name: string | null
}

export interface RemoteLoraIndexStatsRow {
  indexed_count: number
  last_synced_at: string | null
}

function toStem(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '')
}

export class RemoteLoraIndexRepository {
  private readonly db: Database

  constructor(db: Database = getDatabase()) {
    this.db = db
  }

  listByProfileId(profileId: string): RemoteLoraIndexItem[] {
    return this.db.prepare<[string], RemoteLoraIndexRow>(`
      SELECT
        profile_id,
        filename,
        path,
        file_size,
        last_synced_at,
        civitai_url,
        civitai_name
      FROM remote_lora_index
      WHERE profile_id = ?
      ORDER BY filename COLLATE NOCASE ASC, path COLLATE NOCASE ASC
    `).all(profileId).map((row) => ({
      profileId: row.profile_id,
      kind: 'lora',
      filename: row.filename,
      stem: toStem(row.filename),
      path: row.path,
      fileSize: row.file_size,
      modifiedAt: null,
      sha256: null,
      civitaiModelId: null,
      civitaiModelVersionId: null,
      lastIndexedAt: row.last_synced_at,
    }))
  }

  getStats(profileId: string): RemoteLoraIndexStatsRow {
    return this.db.prepare<[string], RemoteLoraIndexStatsRow>(`
      SELECT
        COUNT(*) AS indexed_count,
        MAX(last_synced_at) AS last_synced_at
      FROM remote_lora_index
      WHERE profile_id = ?
    `).get(profileId) ?? { indexed_count: 0, last_synced_at: null }
  }

  replaceForProfile(profileId: string, items: RemoteLoraIndexItem[], scannedAt: string): void {
    const transaction = this.db.transaction(() => {
      this.db.prepare('DELETE FROM remote_lora_index WHERE profile_id = ?').run(profileId)

      const insert = this.db.prepare(`
        INSERT INTO remote_lora_index (
          profile_id,
          filename,
          path,
          file_size,
          last_synced_at,
          civitai_url,
          civitai_name
        ) VALUES (
          @profile_id,
          @filename,
          @path,
          @file_size,
          @last_synced_at,
          NULL,
          NULL
        )
      `)

      for (const item of items) {
        insert.run({
          profile_id: profileId,
          filename: item.filename,
          path: item.path,
          file_size: item.fileSize,
          last_synced_at: scannedAt,
        })
      }
    })

    transaction()
  }
}
