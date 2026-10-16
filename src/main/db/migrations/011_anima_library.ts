import type { Database } from 'better-sqlite3'

import type { Migration } from './001_initial_schema'

export const animaLibraryMigration: Migration = {
  id: '011_anima_library',
  up: (db: Database) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS anima_library_meta (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        source_path TEXT,
        total_artists INTEGER NOT NULL DEFAULT 0,
        imported_at TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS anima_artists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        search_name TEXT NOT NULL,
        post_count INTEGER NOT NULL DEFAULT 0,
        page_bucket INTEGER NOT NULL DEFAULT 1,
        uniqueness_score REAL,
        image_rel_path TEXT NOT NULL,
        imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS anima_favorites (
        artist_id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS anima_folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS anima_folder_items (
        folder_id TEXT NOT NULL,
        artist_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (folder_id, artist_id),
        FOREIGN KEY (folder_id) REFERENCES anima_folders(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_anima_artists_name
      ON anima_artists(name COLLATE NOCASE);

      CREATE INDEX IF NOT EXISTS idx_anima_artists_post_count
      ON anima_artists(post_count DESC, name COLLATE NOCASE);

      CREATE INDEX IF NOT EXISTS idx_anima_artists_uniqueness
      ON anima_artists(uniqueness_score DESC, name COLLATE NOCASE);

      CREATE INDEX IF NOT EXISTS idx_anima_favorites_created_at
      ON anima_favorites(created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_anima_folder_items_artist
      ON anima_folder_items(artist_id, folder_id);
    `)
  },
}
