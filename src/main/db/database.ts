import fs from 'node:fs'
import path from 'node:path'

import BetterSqlite3, { type Database as SQLiteDatabase } from 'better-sqlite3'
import { app } from 'electron'

import { runMigrations } from './migrations'

let database: SQLiteDatabase | null = null

function resolveDatabasePath(overridePath?: string): string {
  if (overridePath) {
    return overridePath
  }

  return path.join(app.getPath('userData'), 'promptforge.db')
}

export function initDatabase(overridePath?: string): SQLiteDatabase {
  if (database) {
    return database
  }

  const dbPath = resolveDatabasePath(overridePath)
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })

  const db = new BetterSqlite3(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  runMigrations(db)
  database = db

  return db
}

export function getDatabase(): SQLiteDatabase {
  if (!database) {
    throw new Error('Database is not initialized. Call initDatabase() first.')
  }

  return database
}

export function closeDatabase(): void {
  if (!database) {
    return
  }

  database.close()
  database = null
}
