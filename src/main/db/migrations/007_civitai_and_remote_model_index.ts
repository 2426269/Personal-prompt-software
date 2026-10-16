import type { Database } from 'better-sqlite3'

import type { Migration } from './001_initial_schema'

export const civitaiAndRemoteModelMigration: Migration = {
  id: '007_civitai_and_remote_model_index',
  up: (db: Database) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS remote_model_index (
        profile_id TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('lora', 'checkpoint', 'vae')),
        filename TEXT NOT NULL,
        stem TEXT NOT NULL,
        path TEXT NOT NULL,
        file_size INTEGER,
        sha256 TEXT,
        civitai_model_id INTEGER,
        civitai_model_version_id INTEGER,
        last_indexed_at TEXT,
        PRIMARY KEY (profile_id, kind, path),
        FOREIGN KEY (profile_id) REFERENCES remote_profiles(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS civitai_config (
        id TEXT PRIMARY KEY,
        api_key_encrypted BLOB,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS civitai_search_cache (
        cache_key TEXT PRIMARY KEY,
        query_type TEXT NOT NULL,
        query_value TEXT NOT NULL,
        response_json TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_remote_model_profile_kind ON remote_model_index(profile_id, kind);
      CREATE INDEX IF NOT EXISTS idx_remote_model_sha256 ON remote_model_index(sha256);
      CREATE INDEX IF NOT EXISTS idx_remote_model_version ON remote_model_index(civitai_model_version_id);
      CREATE INDEX IF NOT EXISTS idx_civitai_search_type ON civitai_search_cache(query_type, query_value);
    `)

    const hasLegacyTable = db.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name = 'remote_lora_index'
    `).get() as { name?: string } | undefined

    if (hasLegacyTable?.name) {
      db.exec(`
        INSERT OR IGNORE INTO remote_model_index (
          profile_id,
          kind,
          filename,
          stem,
          path,
          file_size,
          sha256,
          civitai_model_id,
          civitai_model_version_id,
          last_indexed_at
        )
        SELECT
          profile_id,
          'lora',
          filename,
          CASE
            WHEN instr(filename, '.') > 0 THEN substr(filename, 1, length(filename) - length(substr(filename, instr(filename, '.'))))
            ELSE filename
          END,
          path,
          file_size,
          NULL,
          NULL,
          NULL,
          last_synced_at
        FROM remote_lora_index;
      `)
    }

    db.exec(`
      INSERT OR IGNORE INTO civitai_config (id, api_key_encrypted)
      VALUES ('default', NULL);
    `)
  },
}
