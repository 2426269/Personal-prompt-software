import type { Database } from 'better-sqlite3'

import type { Migration } from './001_initial_schema'

export const spellbookLibraryMigration: Migration = {
  id: '012_spellbook_library',
  up: (db: Database) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS spellbook_meta (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        root_url TEXT NOT NULL,
        total_entries INTEGER NOT NULL DEFAULT 0,
        total_images INTEGER NOT NULL DEFAULT 0,
        last_synced_at TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS spellbook_entries (
        id TEXT PRIMARY KEY,
        parent_entry_id TEXT,
        title TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL,
        kind TEXT NOT NULL,
        source_url TEXT NOT NULL UNIQUE,
        prompt_text TEXT,
        prompt_candidates_json TEXT NOT NULL DEFAULT '[]',
        body_text TEXT NOT NULL DEFAULT '',
        sections_json TEXT NOT NULL DEFAULT '[]',
        related_links_json TEXT NOT NULL DEFAULT '[]',
        model_hints_json TEXT NOT NULL DEFAULT '[]',
        tags_json TEXT NOT NULL DEFAULT '[]',
        cover_image_rel_path TEXT,
        image_count INTEGER NOT NULL DEFAULT 0,
        child_count INTEGER NOT NULL DEFAULT 0,
        synced_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS spellbook_images (
        id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL,
        source_url TEXT NOT NULL,
        local_rel_path TEXT NOT NULL,
        caption TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (entry_id) REFERENCES spellbook_entries(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_spellbook_entries_category
      ON spellbook_entries(category, kind, title COLLATE NOCASE);

      CREATE INDEX IF NOT EXISTS idx_spellbook_entries_parent
      ON spellbook_entries(parent_entry_id, title COLLATE NOCASE);

      CREATE INDEX IF NOT EXISTS idx_spellbook_entries_updated
      ON spellbook_entries(updated_at DESC, title COLLATE NOCASE);

      CREATE INDEX IF NOT EXISTS idx_spellbook_images_entry
      ON spellbook_images(entry_id, sort_order);
    `)
  },
}
