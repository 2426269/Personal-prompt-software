import type { Database } from 'better-sqlite3'

import { initialSchemaMigration, type Migration } from './001_initial_schema'
import { entrySoftDeleteMigration } from './002_entry_soft_delete'
import { llmTemplatesAndAnalysisMigration } from './003_llm_templates_and_analysis'
import { analysisPerImageMigration } from './004_analysis_per_image'
import { remoteProfilesMetadataMigration } from './005_remote_profiles_metadata'
import { remoteProfilesLastScannedMigration } from './006_remote_profiles_last_scanned'
import { civitaiAndRemoteModelMigration } from './007_civitai_and_remote_model_index'
import { remoteModelIncrementalHashMigration } from './008_remote_model_incremental_hash'
import { appLogsMigration } from './009_app_logs'
import { promptPresetsMigration } from './010_prompt_presets'
import { animaLibraryMigration } from './011_anima_library'
import { spellbookLibraryMigration } from './012_spellbook_library'
import { llmConfigAdvancedSettingsMigration } from './013_llm_config_advanced_settings'

const MIGRATIONS: Migration[] = [
  initialSchemaMigration,
  entrySoftDeleteMigration,
  llmTemplatesAndAnalysisMigration,
  analysisPerImageMigration,
  remoteProfilesMetadataMigration,
  remoteProfilesLastScannedMigration,
  civitaiAndRemoteModelMigration,
  remoteModelIncrementalHashMigration,
  appLogsMigration,
  promptPresetsMigration,
  animaLibraryMigration,
  spellbookLibraryMigration,
  llmConfigAdvancedSettingsMigration,
]

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
