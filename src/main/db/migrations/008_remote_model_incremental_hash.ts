import type { Database } from 'better-sqlite3'

import type { Migration } from './001_initial_schema'

function hasColumn(db: Database, tableName: string, columnName: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name?: string }>
  return rows.some((row) => row.name === columnName)
}

export const remoteModelIncrementalHashMigration: Migration = {
  id: '008_remote_model_incremental_hash',
  up: (db: Database) => {
    if (!hasColumn(db, 'remote_model_index', 'modified_at')) {
      db.exec(`
        ALTER TABLE remote_model_index
        ADD COLUMN modified_at INTEGER;
      `)
    }
  },
}
