import type { Database } from 'better-sqlite3'

import type { Migration } from './001_initial_schema'

function hasColumn(db: Database, table: string, column: string): boolean {
  const rows = db.prepare<[], { name: string }>(`PRAGMA table_info(${table})`).all()
  return rows.some((row) => row.name === column)
}

export const remoteProfilesMetadataMigration: Migration = {
  id: '005_remote_profiles_metadata',
  up: (db) => {
    if (!hasColumn(db, 'remote_profiles', 'name')) {
      db.exec(`
        ALTER TABLE remote_profiles
        ADD COLUMN name TEXT NOT NULL DEFAULT 'Remote ComfyUI';
      `)
    }

    if (!hasColumn(db, 'remote_profiles', 'is_default')) {
      db.exec(`
        ALTER TABLE remote_profiles
        ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1));
      `)
    }

    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_remote_profiles_default
      ON remote_profiles(is_default)
      WHERE is_default = 1;
    `)

    const defaultCount = db.prepare<[], { total: number }>(
      'SELECT COUNT(*) AS total FROM remote_profiles WHERE is_default = 1',
    ).get()?.total ?? 0

    if (defaultCount === 0) {
      db.prepare(`
        UPDATE remote_profiles
        SET
          is_default = 1,
          name = COALESCE(NULLIF(name, ''), COALESCE(ssh_host, comfy_base_url, 'Remote ComfyUI'))
        WHERE id = (
          SELECT id
          FROM remote_profiles
          ORDER BY updated_at DESC, created_at DESC
          LIMIT 1
        )
      `).run()
    }
  },
}
