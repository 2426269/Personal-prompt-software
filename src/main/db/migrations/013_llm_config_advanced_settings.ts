import type { Database } from 'better-sqlite3'

import type { Migration } from './001_initial_schema'

export const llmConfigAdvancedSettingsMigration: Migration = {
  id: '013_llm_config_advanced_settings',
  up(db: Database) {
    const columns = db.prepare<[], { name: string }>('PRAGMA table_info(ai_model_configs)').all()
    const existing = new Set(columns.map((column) => column.name))

    if (!existing.has('max_tokens')) {
      db.exec('ALTER TABLE ai_model_configs ADD COLUMN max_tokens INTEGER')
    }

    if (!existing.has('strict_json_mode')) {
      db.exec('ALTER TABLE ai_model_configs ADD COLUMN strict_json_mode INTEGER NOT NULL DEFAULT 1')
    }

    if (!existing.has('thinking_enabled')) {
      db.exec('ALTER TABLE ai_model_configs ADD COLUMN thinking_enabled INTEGER NOT NULL DEFAULT 0')
    }
  },
}
