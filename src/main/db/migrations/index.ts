import type { Database } from 'better-sqlite3'

import { initialSchemaMigration, type Migration } from './001_initial_schema'
import { entrySoftDeleteMigration } from './002_entry_soft_delete'

const MIGRATIONS: Migration[] = [initialSchemaMigration, entrySoftDeleteMigration]

function ensureMigrationTable(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)
}

export function runMigrations(db: Database): void {
  ensureMigrationTable(db)

  const getAppliedMigration = db.prepare<[string], { id: string }>(
    'SELECT id FROM schema_migrations WHERE id = ?',
  )
  const insertMigration = db.prepare<[string]>(
    'INSERT INTO schema_migrations (id, applied_at) VALUES (?, CURRENT_TIMESTAMP)',
  )

  for (const migration of MIGRATIONS) {
    const applied = getAppliedMigration.get(migration.id)
    if (applied) {
      continue
    }

    const transaction = db.transaction(() => {
      migration.up(db)
      insertMigration.run(migration.id)
    })

    transaction()
  }
}
