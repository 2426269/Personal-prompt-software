import { randomUUID } from 'node:crypto'

import type { Database } from 'better-sqlite3'

import type { AnalysisCategory, AnalysisSettingsCommon, AnalysisTagItem } from '@shared/types/llm'
import type { PromptTemplateMode } from '@shared/types/template'
import type { PromptSourceType } from '@shared/types/importer'

import { getDatabase } from '../database'

export interface AnalyzedTemplateRow {
  id: string
  entry_id: string
  template_id: string | null
  config_id: string | null
  template_json: string
  removed_specific: string | null
  settings_common: string | null
  custom_categories: string | null
  ai_model_used: string | null
  nsfw_mode: PromptTemplateMode
  prompt_type: Exclude<PromptSourceType, 'Unknown'>
  raw_response: string | null
  sanitized_payload: string | null
  created_at: string
  updated_at: string
}

export interface SaveAnalysisInput {
  entryId: string
  templateId: string | null
  configId: string | null
  categories: AnalysisCategory[]
  removedSpecific: string[]
  settingsCommon: AnalysisSettingsCommon
  customCategories: Record<string, AnalysisTagItem[]>
  aiModelUsed: string | null
  nsfwMode: PromptTemplateMode
  promptType: Exclude<PromptSourceType, 'Unknown'>
  rawResponse: string | null
  sanitizedPayload: string | null
}

export class AnalyzedTemplatesRepository {
  private readonly db: Database

  constructor(db: Database = getDatabase()) {
    this.db = db
  }

  getByEntryId(entryId: string): AnalyzedTemplateRow | null {
    const statement = this.db.prepare<[string], AnalyzedTemplateRow>(`
      SELECT
        id,
        entry_id,
        template_id,
        config_id,
        template_json,
        removed_specific,
        settings_common,
        custom_categories,
        ai_model_used,
        nsfw_mode,
        prompt_type,
        raw_response,
        sanitized_payload,
        created_at,
        updated_at
      FROM analyzed_templates
      WHERE entry_id = ?
      LIMIT 1
    `)

    return statement.get(entryId) ?? null
  }

  save(input: SaveAnalysisInput): string {
    const existing = this.getByEntryId(input.entryId)
    const id = existing?.id ?? randomUUID()

    this.db.prepare(`
      INSERT INTO analyzed_templates (
        id,
        entry_id,
        template_id,
        config_id,
        template_json,
        removed_specific,
        settings_common,
        custom_categories,
        ai_model_used,
        nsfw_mode,
        prompt_type,
        raw_response,
        sanitized_payload,
        updated_at
      ) VALUES (
        @id,
        @entry_id,
        @template_id,
        @config_id,
        @template_json,
        @removed_specific,
        @settings_common,
        @custom_categories,
        @ai_model_used,
        @nsfw_mode,
        @prompt_type,
        @raw_response,
        @sanitized_payload,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT(entry_id) DO UPDATE SET
        template_id = excluded.template_id,
        config_id = excluded.config_id,
        template_json = excluded.template_json,
        removed_specific = excluded.removed_specific,
        settings_common = excluded.settings_common,
        custom_categories = excluded.custom_categories,
        ai_model_used = excluded.ai_model_used,
        nsfw_mode = excluded.nsfw_mode,
        prompt_type = excluded.prompt_type,
        raw_response = excluded.raw_response,
        sanitized_payload = excluded.sanitized_payload,
        updated_at = CURRENT_TIMESTAMP
    `).run({
      id,
      entry_id: input.entryId,
      template_id: input.templateId,
      config_id: input.configId,
      template_json: JSON.stringify(input.categories),
      removed_specific: JSON.stringify(input.removedSpecific),
      settings_common: JSON.stringify(input.settingsCommon),
      custom_categories: JSON.stringify(input.customCategories),
      ai_model_used: input.aiModelUsed,
      nsfw_mode: input.nsfwMode,
      prompt_type: input.promptType,
      raw_response: input.rawResponse,
      sanitized_payload: input.sanitizedPayload,
    })

    return id
  }
}
