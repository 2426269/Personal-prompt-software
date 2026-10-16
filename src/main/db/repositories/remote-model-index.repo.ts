import type { Database } from 'better-sqlite3'

import type { RemoteModelIndexItem, RemoteModelKind } from '@shared/types/remote'

import { getDatabase } from '../database'

interface RemoteModelIndexRow {
  profile_id: string
  kind: RemoteModelKind
  filename: string
  stem: string
  path: string
  file_size: number | null
  modified_at: number | null
  sha256: string | null
  civitai_model_id: number | null
  civitai_model_version_id: number | null
  last_indexed_at: string | null
}

interface RemoteModelIndexStatsRow {
  indexed_count: number
  indexed_lora_count: number
  indexed_checkpoint_count: number
  indexed_vae_count: number
  last_indexed_at: string | null
}

export class RemoteModelIndexRepository {
  private readonly db: Database

  constructor(db: Database = getDatabase()) {
    this.db = db
  }

  listByProfileId(profileId: string): RemoteModelIndexItem[] {
    return this.db.prepare<[string], RemoteModelIndexRow>(`
      SELECT
        profile_id,
        kind,
        filename,
        stem,
        path,
        file_size,
        modified_at,
        sha256,
        civitai_model_id,
        civitai_model_version_id,
        last_indexed_at
      FROM remote_model_index
      WHERE profile_id = ?
      ORDER BY kind ASC, filename COLLATE NOCASE ASC, path COLLATE NOCASE ASC
    `).all(profileId).map((row) => this.toItem(row))
  }

  listByProfileIdAndKind(profileId: string, kind: RemoteModelKind): RemoteModelIndexItem[] {
    return this.db.prepare<[string, RemoteModelKind], RemoteModelIndexRow>(`
      SELECT
        profile_id,
        kind,
        filename,
        stem,
        path,
        file_size,
        modified_at,
        sha256,
        civitai_model_id,
        civitai_model_version_id,
        last_indexed_at
      FROM remote_model_index
      WHERE profile_id = ? AND kind = ?
      ORDER BY filename COLLATE NOCASE ASC, path COLLATE NOCASE ASC
    `).all(profileId, kind).map((row) => this.toItem(row))
  }

  getStats(profileId: string): RemoteModelIndexStatsRow {
    return this.db.prepare<[string], RemoteModelIndexStatsRow>(`
      SELECT
        COUNT(*) AS indexed_count,
        SUM(CASE WHEN kind = 'lora' THEN 1 ELSE 0 END) AS indexed_lora_count,
        SUM(CASE WHEN kind = 'checkpoint' THEN 1 ELSE 0 END) AS indexed_checkpoint_count,
        SUM(CASE WHEN kind = 'vae' THEN 1 ELSE 0 END) AS indexed_vae_count,
        MAX(last_indexed_at) AS last_indexed_at
      FROM remote_model_index
      WHERE profile_id = ?
    `).get(profileId) ?? {
      indexed_count: 0,
      indexed_lora_count: 0,
      indexed_checkpoint_count: 0,
      indexed_vae_count: 0,
      last_indexed_at: null,
    }
  }

  replaceForProfile(profileId: string, items: RemoteModelIndexItem[], scannedAt: string): void {
    const transaction = this.db.transaction(() => {
      this.db.prepare('DELETE FROM remote_model_index WHERE profile_id = ?').run(profileId)

      const insert = this.db.prepare(`
        INSERT INTO remote_model_index (
          profile_id,
          kind,
          filename,
          stem,
          path,
          file_size,
          modified_at,
          sha256,
          civitai_model_id,
          civitai_model_version_id,
          last_indexed_at
        ) VALUES (
          @profile_id,
          @kind,
          @filename,
          @stem,
          @path,
          @file_size,
          @modified_at,
          @sha256,
          @civitai_model_id,
          @civitai_model_version_id,
          @last_indexed_at
        )
      `)

      for (const item of items) {
        insert.run({
          profile_id: profileId,
          kind: item.kind,
          filename: item.filename,
          stem: item.stem,
          path: item.path,
          file_size: item.fileSize,
          modified_at: item.modifiedAt,
          sha256: item.sha256,
          civitai_model_id: item.civitaiModelId,
          civitai_model_version_id: item.civitaiModelVersionId,
          last_indexed_at: scannedAt,
        })
      }
    })

    transaction()
  }

  private toItem(row: RemoteModelIndexRow): RemoteModelIndexItem {
    return {
      profileId: row.profile_id,
      kind: row.kind,
      filename: row.filename,
      stem: row.stem,
      path: row.path,
      fileSize: row.file_size,
      modifiedAt: row.modified_at,
      sha256: row.sha256,
      civitaiModelId: row.civitai_model_id,
      civitaiModelVersionId: row.civitai_model_version_id,
      lastIndexedAt: row.last_indexed_at,
    }
  }
}
