import type { Database } from 'better-sqlite3'

import type { Migration } from './001_initial_schema'

function hasDeletedAtColumn(db: Database): boolean {
  const rows = db.pragma('table_info(entries)') as Array<{ name?: string }>
  return rows.some((row) => row.name === 'deleted_at')
}

export const entrySoftDeleteMigration: Migration = {
  id: '002_entry_soft_delete',
  up: (db: Database) => {
    if (!hasDeletedAtColumn(db)) {
      db.exec('ALTER TABLE entries ADD COLUMN deleted_at TEXT;')
    }

    db.exec('CREATE INDEX IF NOT EXISTS idx_entries_deleted_at ON entries(deleted_at);')
  },
}
