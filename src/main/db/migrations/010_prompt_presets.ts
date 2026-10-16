import type { Database } from 'better-sqlite3'

import type { Migration } from './001_initial_schema'

export const promptPresetsMigration: Migration = {
  id: '010_prompt_presets',
  up: (db: Database) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS prompt_presets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        source_entry_id TEXT NOT NULL,
        source_analysis_id TEXT,
        source_image_index INTEGER NOT NULL,
        source_entry_title TEXT NOT NULL,
        source_prompt_type TEXT NOT NULL CHECK (source_prompt_type IN ('NAI', 'SD', 'ComfyUI')),
        source_image_original_url TEXT,
        source_image_local_path TEXT,
        default_syntax_mode TEXT NOT NULL CHECK (default_syntax_mode IN ('nai', 'sd')),
        positive_sections_json TEXT NOT NULL,
        negative_sections_json TEXT NOT NULL,
        positive_item_count INTEGER NOT NULL DEFAULT 0,
        negative_item_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (source_entry_id) REFERENCES entries(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_prompt_presets_updated_at
      ON prompt_presets(updated_at DESC, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_prompt_presets_source_entry
      ON prompt_presets(source_entry_id, source_image_index);
    `)
  },
}
