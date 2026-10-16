import type { Database } from 'better-sqlite3'

import type { Migration } from './001_initial_schema'

function hasColumn(db: Database, table: string, column: string): boolean {
  const rows = db.prepare<[], { name: string }>(`PRAGMA table_info(${table})`).all()
  return rows.some((row) => row.name === column)
}

export const remoteProfilesLastScannedMigration: Migration = {
  id: '006_remote_profiles_last_scanned',
  up: (db) => {
    if (!hasColumn(db, 'remote_profiles', 'last_scanned_at')) {
      db.exec(`
        ALTER TABLE remote_profiles
        ADD COLUMN last_scanned_at TEXT;
      `)
    }
  },
}
