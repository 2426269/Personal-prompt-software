import type { Database } from 'better-sqlite3'

import type { Migration } from './001_initial_schema'

export const llmTemplatesAndAnalysisMigration: Migration = {
  id: '003_llm_templates_and_analysis',
  up: (db: Database) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS prompt_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        system_prompt TEXT NOT NULL,
        template_json TEXT NOT NULL DEFAULT '[]',
        mode TEXT NOT NULL DEFAULT 'sanitize' CHECK (mode IN ('sanitize', 'full')),
        is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_templates_default
      ON prompt_templates(is_default)
      WHERE is_default = 1;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_analyzed_templates_entry_id_unique
      ON analyzed_templates(entry_id);
    `)

    db.exec("ALTER TABLE analyzed_templates ADD COLUMN template_id TEXT")
    db.exec("ALTER TABLE analyzed_templates ADD COLUMN config_id TEXT")
    db.exec("ALTER TABLE analyzed_templates ADD COLUMN nsfw_mode TEXT NOT NULL DEFAULT 'sanitize'")
    db.exec("ALTER TABLE analyzed_templates ADD COLUMN prompt_type TEXT NOT NULL DEFAULT 'SD'")
    db.exec("ALTER TABLE analyzed_templates ADD COLUMN raw_response TEXT")
    db.exec("ALTER TABLE analyzed_templates ADD COLUMN sanitized_payload TEXT")
    db.exec("ALTER TABLE analyzed_templates ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP")
    db.exec("ALTER TABLE user_tags ADD COLUMN updated_at TEXT")
    db.exec("UPDATE user_tags SET updated_at = created_at WHERE updated_at IS NULL")
  },
}
