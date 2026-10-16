import type { Database } from 'better-sqlite3'

import type { Migration } from './001_initial_schema'

export const analysisPerImageMigration: Migration = {
  id: '004_analysis_per_image',
  up: (db: Database) => {
    db.exec(`
      DROP INDEX IF EXISTS idx_analyzed_templates_entry_id_unique;
      ALTER TABLE analyzed_templates ADD COLUMN image_index INTEGER;
      CREATE INDEX IF NOT EXISTS idx_analyzed_templates_entry_image
      ON analyzed_templates(entry_id, image_index, updated_at DESC);
    `)
  },
}
