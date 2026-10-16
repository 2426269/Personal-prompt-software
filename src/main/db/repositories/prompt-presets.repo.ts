import { randomUUID } from 'node:crypto'

import type { Database } from 'better-sqlite3'

import type {
  PromptPresetSaveInput,
  PromptPresetSyntaxMode,
} from '@shared/types/preset'
import type { PromptSourceType } from '@shared/types/importer'

import { getDatabase } from '../database'

export interface PromptPresetRow {
  id: string
  name: string
  source_entry_id: string
  source_analysis_id: string | null
  source_image_index: number
  source_entry_title: string
  source_prompt_type: Exclude<PromptSourceType, 'Unknown'>
  source_image_original_url: string | null
  source_image_local_path: string | null
  default_syntax_mode: PromptPresetSyntaxMode
  positive_sections_json: string
  negative_sections_json: string
  positive_item_count: number
  negative_item_count: number
  created_at: string
  updated_at: string
}

function countItemsInSections(sections: PromptPresetSaveInput['positiveSections']): number {
  return sections.reduce((total, section) => total + section.items.length, 0)
}

export class PromptPresetsRepository {
  private readonly db: Database

  constructor(db: Database = getDatabase()) {
    this.db = db
  }

  list(): PromptPresetRow[] {
    const statement = this.db.prepare<[], PromptPresetRow>(`
      SELECT
        id,
        name,
        source_entry_id,
        source_analysis_id,
        source_image_index,
        source_entry_title,
        source_prompt_type,
        source_image_original_url,
        source_image_local_path,
        default_syntax_mode,
        positive_sections_json,
        negative_sections_json,
        positive_item_count,
        negative_item_count,
        created_at,
        updated_at
      FROM prompt_presets
      ORDER BY updated_at DESC, created_at DESC
    `)

    return statement.all()
  }

  getById(id: string): PromptPresetRow | null {
    const statement = this.db.prepare<[string], PromptPresetRow>(`
      SELECT
        id,
        name,
        source_entry_id,
        source_analysis_id,
        source_image_index,
        source_entry_title,
        source_prompt_type,
        source_image_original_url,
        source_image_local_path,
        default_syntax_mode,
        positive_sections_json,
        negative_sections_json,
        positive_item_count,
        negative_item_count,
        created_at,
        updated_at
      FROM prompt_presets
      WHERE id = ?
      LIMIT 1
    `)

    return statement.get(id) ?? null
  }

  upsert(input: PromptPresetSaveInput): string {
    const id = input.id ?? randomUUID()
    const positiveItemCount = countItemsInSections(input.positiveSections)
    const negativeItemCount = countItemsInSections(input.negativeSections)

    this.db.prepare(`
      INSERT INTO prompt_presets (
        id,
        name,
        source_entry_id,
        source_analysis_id,
        source_image_index,
        source_entry_title,
        source_prompt_type,
        source_image_original_url,
        source_image_local_path,
        default_syntax_mode,
        positive_sections_json,
        negative_sections_json,
        positive_item_count,
        negative_item_count,
        updated_at
      ) VALUES (
        @id,
        @name,
        @source_entry_id,
        @source_analysis_id,
        @source_image_index,
        @source_entry_title,
        @source_prompt_type,
        @source_image_original_url,
        @source_image_local_path,
        @default_syntax_mode,
        @positive_sections_json,
        @negative_sections_json,
        @positive_item_count,
        @negative_item_count,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        source_entry_id = excluded.source_entry_id,
        source_analysis_id = excluded.source_analysis_id,
        source_image_index = excluded.source_image_index,
        source_entry_title = excluded.source_entry_title,
        source_prompt_type = excluded.source_prompt_type,
        source_image_original_url = excluded.source_image_original_url,
        source_image_local_path = excluded.source_image_local_path,
        default_syntax_mode = excluded.default_syntax_mode,
        positive_sections_json = excluded.positive_sections_json,
        negative_sections_json = excluded.negative_sections_json,
        positive_item_count = excluded.positive_item_count,
        negative_item_count = excluded.negative_item_count,
        updated_at = CURRENT_TIMESTAMP
    `).run({
      id,
      name: input.name,
      source_entry_id: input.sourceEntryId,
      source_analysis_id: input.sourceAnalysisId ?? null,
      source_image_index: input.sourceImageIndex,
      source_entry_title: input.sourceEntryTitle,
      source_prompt_type: input.sourcePromptType,
      source_image_original_url: input.referenceImage.originalUrl,
      source_image_local_path: input.referenceImage.localPath,
      default_syntax_mode: input.defaultSyntaxMode,
      positive_sections_json: JSON.stringify(input.positiveSections),
      negative_sections_json: JSON.stringify(input.negativeSections),
      positive_item_count: positiveItemCount,
      negative_item_count: negativeItemCount,
    })

    return id
  }

  delete(id: string): boolean {
    return this.db.prepare('DELETE FROM prompt_presets WHERE id = ?').run(id).changes > 0
  }
}
