import type { Database } from 'better-sqlite3'

import type { AppLogLevel, AppLogModule } from '@shared/types/logs'

import type { Migration } from './001_initial_schema'

const LOG_LEVELS: AppLogLevel[] = ['debug', 'info', 'warn', 'error']
const LOG_MODULES: AppLogModule[] = ['llm', 'comfy', 'civitai', 'ssh', 'remote_model', 'ipc', 'main']

export const appLogsMigration: Migration = {
  id: '009_app_logs',
  up(db: Database) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS app_logs (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        module TEXT NOT NULL CHECK (module IN (${LOG_MODULES.map((item) => `'${item}'`).join(', ')})),
        level TEXT NOT NULL CHECK (level IN (${LOG_LEVELS.map((item) => `'${item}'`).join(', ')})),
        action TEXT NOT NULL,
        summary TEXT NOT NULL,
        entry_id TEXT,
        image_index INTEGER,
        request_json TEXT,
        response_json TEXT,
        error_json TEXT,
        tags_json TEXT NOT NULL DEFAULT '[]'
      );

      CREATE INDEX IF NOT EXISTS idx_app_logs_created_at ON app_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_app_logs_module_created_at ON app_logs(module, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_app_logs_level_created_at ON app_logs(level, created_at DESC);
    `)
  },
}
