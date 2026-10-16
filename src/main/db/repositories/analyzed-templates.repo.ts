import { randomUUID } from 'node:crypto'

import type { Database } from 'better-sqlite3'

import type { AnalysisCategory, AnalysisSettingsCommon, AnalysisTagItem } from '@shared/types/llm'
import type { PromptTemplateMode } from '@shared/types/template'
import type { PromptSourceType } from '@shared/types/importer'

import { getDatabase } from '../database'

export interface AnalyzedTemplateRow {
  id: string
  entry_id: string
  image_index: number | null
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
  imageIndex: number | null
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

  listByEntryId(entryId: string): AnalyzedTemplateRow[] {
    const statement = this.db.prepare<[string], AnalyzedTemplateRow>(`
      SELECT
        id,
        entry_id,
        image_index,
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
      ORDER BY
        CASE WHEN image_index IS NULL THEN 1 ELSE 0 END,
        image_index ASC,
        updated_at DESC
    `)

    return statement.all(entryId)
  }

  getByEntryId(entryId: string): AnalyzedTemplateRow | null {
    return this.listByEntryId(entryId)[0] ?? null
  }

  getByEntryIdAndImageIndex(entryId: string, imageIndex: number | null): AnalyzedTemplateRow | null {
    if (imageIndex == null) {
      const statement = this.db.prepare<[string], AnalyzedTemplateRow>(`
        SELECT
          id,
          entry_id,
          image_index,
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
        WHERE entry_id = ? AND image_index IS NULL
        LIMIT 1
      `)
      return statement.get(entryId) ?? null
    }

    const statement = this.db.prepare<[string, number], AnalyzedTemplateRow>(`
      SELECT
        id,
        entry_id,
        image_index,
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
      WHERE entry_id = ? AND image_index = ?
      LIMIT 1
    `)

    return statement.get(entryId, imageIndex) ?? null
  }

  save(input: SaveAnalysisInput): string {
    const existing = this.getByEntryIdAndImageIndex(input.entryId, input.imageIndex)
    const id = existing?.id ?? randomUUID()

    if (existing) {
      this.db.prepare(`
        UPDATE analyzed_templates
        SET
          template_id = @template_id,
          config_id = @config_id,
          template_json = @template_json,
          removed_specific = @removed_specific,
          settings_common = @settings_common,
          custom_categories = @custom_categories,
          ai_model_used = @ai_model_used,
          nsfw_mode = @nsfw_mode,
          prompt_type = @prompt_type,
          raw_response = @raw_response,
          sanitized_payload = @sanitized_payload,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
      `).run({
        id,
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

    this.db.prepare(`
      INSERT INTO analyzed_templates (
        id,
        entry_id,
        image_index,
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
        @image_index,
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
    `).run({
      id,
      entry_id: input.entryId,
      image_index: input.imageIndex,
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
