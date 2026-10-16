import { AppError } from '@main/ipc/wrap-ipc'
import type {
  PromptPresetDetail,
  PromptPresetItem,
  PromptPresetSaveInput,
  PromptPresetSection,
  PromptPresetSummary,
} from '@shared/types/preset'

import {
  PromptPresetsRepository,
  type PromptPresetRow,
} from '../../db/repositories/prompt-presets.repo'

function parseSections(value: string): PromptPresetSection[] {
  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.flatMap((section) => {
      if (typeof section !== 'object' || section === null) {
        return []
      }

      const sectionRecord = section as Record<string, unknown>
      if (typeof sectionRecord.key !== 'string' || typeof sectionRecord.label !== 'string') {
        return []
      }

      const items = Array.isArray(sectionRecord.items)
        ? sectionRecord.items.flatMap((item) => {
            if (typeof item !== 'object' || item === null) {
              return []
            }

            const itemRecord = item as Record<string, unknown>
            if (typeof itemRecord.id !== 'string' || typeof itemRecord.text !== 'string') {
              return []
            }

            const normalizedItem: PromptPresetItem = {
              id: itemRecord.id,
              text: itemRecord.text,
              weight: typeof itemRecord.weight === 'number' ? itemRecord.weight : null,
              note: typeof itemRecord.note === 'string' ? itemRecord.note : null,
            }

            return normalizedItem.text.trim() ? [normalizedItem] : []
          })
        : []

      return items.length > 0
        ? [{
            key: sectionRecord.key,
            label: sectionRecord.label,
            items,
          }]
        : []
    })
  } catch {
    return []
  }
}

function normalizeSections(sections: PromptPresetSection[]): PromptPresetSection[] {
  return sections
    .map((section) => ({
      key: section.key.trim(),
      label: section.label.trim() || section.key.trim(),
      items: section.items
        .map((item) => ({
          id: item.id.trim(),
          text: item.text.trim(),
          weight: item.weight != null && Number.isFinite(item.weight) ? Number(item.weight) : null,
          note: item.note?.trim() ? item.note.trim() : null,
        }))
        .filter((item) => item.id && item.text),
    }))
    .filter((section) => section.key && section.label && section.items.length > 0)
}

export class PromptPresetsService {
  constructor(private readonly repository = new PromptPresetsRepository()) {}

  list(): PromptPresetSummary[] {
    return this.repository.list().map((row) => this.toSummary(row))
  }

  get(id: string): PromptPresetDetail | null {
    const row = this.repository.getById(id)
    return row ? this.toDetail(row) : null
  }

  save(input: PromptPresetSaveInput): PromptPresetDetail {
    const name = input.name.trim()
    if (!name) {
      throw new AppError('PROMPT_PRESET_NAME_REQUIRED', '预设名称不能为空。')
    }

    const positiveSections = normalizeSections(input.positiveSections)
    const negativeSections = normalizeSections(input.negativeSections)

    if (positiveSections.length === 0 && negativeSections.length === 0) {
      throw new AppError('PROMPT_PRESET_EMPTY', '至少需要保留一个正向或负向提示词。')
    }

    const id = this.repository.upsert({
      ...input,
      name,
      positiveSections,
      negativeSections,
      sourceAnalysisId: input.sourceAnalysisId ?? null,
      sourceEntryTitle: input.sourceEntryTitle.trim() || name,
      referenceImage: {
        originalUrl: input.referenceImage.originalUrl?.trim() || null,
        localPath: input.referenceImage.localPath?.trim() || null,
      },
    })

    const row = this.repository.getById(id)
    if (!row) {
      throw new AppError('PROMPT_PRESET_SAVE_FAILED', '提示词预设保存失败。')
    }

    return this.toDetail(row)
  }

  delete(id: string): boolean {
    return this.repository.delete(id)
  }

  private toSummary(row: PromptPresetRow): PromptPresetSummary {
    return {
      id: row.id,
      name: row.name,
      sourceEntryId: row.source_entry_id,
      sourceAnalysisId: row.source_analysis_id,
      sourceImageIndex: row.source_image_index,
      sourceEntryTitle: row.source_entry_title,
      sourcePromptType: row.source_prompt_type,
      referenceImage: {
        originalUrl: row.source_image_original_url,
        localPath: row.source_image_local_path,
      },
      defaultSyntaxMode: row.default_syntax_mode,
      positiveItemCount: row.positive_item_count,
      negativeItemCount: row.negative_item_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  private toDetail(row: PromptPresetRow): PromptPresetDetail {
    return {
      ...this.toSummary(row),
      positiveSections: parseSections(row.positive_sections_json),
      negativeSections: parseSections(row.negative_sections_json),
    }
  }
}
