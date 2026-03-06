import type {
  EntryDeleteInput,
  EntryDeleteResult,
  EntryDetail,
  EntryListItem,
  EntryListParams,
  EntryListResult,
  EntryUpdateInput,
} from '@shared/types/entry'
import type { PromptTag } from '@shared/types/importer'

import { EntriesRepository, type EntryDetailRow, type EntryListRow } from '../../db/repositories/entries.repo'
import { ImagesRepository } from '../../db/repositories/images.repo'
import { LLMService } from '../llm/llm-service'
import { ComfyUIParser } from '../parser/comfyui-parser'
import { SDParser } from '../parser/sd-parser'
import { TagsService } from '../tags/tags.service'

function parseTags(rawValue: string | null): string[] {
  if (!rawValue) {
    return []
  }

  try {
    const parsed: unknown = JSON.parse(rawValue)
    if (Array.isArray(parsed)) {
      return parsed.filter((value): value is string => typeof value === 'string')
    }
  } catch {
    return []
  }

  return []
}

function dedupeLoras(loras: PromptTag[]): PromptTag[] {
  const seen = new Set<string>()
  const result: PromptTag[] = []

  for (const lora of loras) {
    const key = `${lora.text}:${lora.weight ?? ''}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    result.push(lora)
  }

  return result
}

function isPromptTagPayload(value: unknown): value is { text: string; weight?: number } {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const maybeTag = value as { text?: unknown; weight?: unknown }
  return typeof maybeTag.text === 'string' && (maybeTag.weight === undefined || typeof maybeTag.weight === 'number')
}

export class EntriesService {
  constructor(
    private readonly entriesRepository = new EntriesRepository(),
    private readonly imagesRepository = new ImagesRepository(),
    private readonly tagsService = new TagsService(),
    private readonly llmService = new LLMService(),
    private readonly sdParser = new SDParser(),
    private readonly comfyuiParser = new ComfyUIParser(),
  ) {}

  list(params: EntryListParams): EntryListResult {
    const normalizedParams: EntryListParams = {
      includeDeleted: params.includeDeleted ?? false,
      page: Math.max(1, params.page),
      pageSize: Math.max(1, params.pageSize),
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    }

    const { rows, total } = this.entriesRepository.list(normalizedParams)
    const totalPages = total === 0 ? 0 : Math.ceil(total / normalizedParams.pageSize)

    return {
      items: rows.map((row) => this.toListItem(row)),
      page: normalizedParams.page,
      pageSize: normalizedParams.pageSize,
      total,
      totalPages,
    }
  }

  get(id: string): EntryDetail | null {
    const row = this.entriesRepository.getById(id)
    if (!row) {
      return null
    }

    const images = this.imagesRepository.listByEntryId(id)
    const userTagRecords = this.tagsService.getByEntryId(id)
    const analysis = this.llmService.getAnalysisForEntry(id)

    return {
      id: row.id,
      pixivId: row.pixiv_id,
      authorId: row.author_id,
      authorName: row.author_name,
      title: row.title,
      customName: row.custom_name,
      displayTitle: row.custom_name ?? row.title,
      caption: row.caption,
      type: row.type,
      sourceUrl: row.source_url,
      postDate: row.post_date,
      views: row.views,
      bookmarks: row.bookmarks,
      isFavorited: row.is_favorited === 1,
      sourceTags: parseTags(row.tags),
      userTags: userTagRecords.map((tag) => tag.name),
      userTagRecords,
      loras: this.extractLoras(row, images),
      rawJson: row.raw_json,
      images,
      analysis,
      deletedAt: row.deleted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  update(input: EntryUpdateInput): boolean {
    return this.entriesRepository.update(input)
  }

  delete(input: EntryDeleteInput): EntryDeleteResult {
    const success = input.mode === 'hard'
      ? this.entriesRepository.hardDelete(input.id)
      : this.entriesRepository.softDelete(input.id)

    return {
      id: input.id,
      mode: input.mode,
      success,
    }
  }

  private toListItem(row: EntryListRow): EntryListItem {
    return {
      id: row.id,
      pixivId: row.pixiv_id,
      authorId: row.author_id,
      authorName: row.author_name,
      title: row.title,
      customName: row.custom_name,
      displayTitle: row.custom_name ?? row.title,
      caption: row.caption,
      type: row.type,
      sourceUrl: row.source_url,
      postDate: row.post_date,
      views: row.views,
      bookmarks: row.bookmarks,
      isFavorited: row.is_favorited === 1,
      tags: parseTags(row.tags),
      imageCount: row.image_count,
      coverImage:
        row.cover_original_url || row.cover_local_path
          ? {
              index: 0,
              aiJson: row.cover_ai_json ?? '',
              promptText: row.cover_prompt_text ?? '',
              originalUrl: row.cover_original_url ?? '',
              localPath: row.cover_local_path,
            }
          : null,
      deletedAt: row.deleted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  private extractLoras(row: EntryDetailRow, images: ReturnType<ImagesRepository['listByEntryId']>): PromptTag[] {
    const rawPayload = this.safeParseJson(row.raw_json)

    if (row.type === 'SD') {
      const rawLoras = this.extractLorasFromParsedPayload(rawPayload)
      if (rawLoras.length > 0) {
        return rawLoras
      }

      return dedupeLoras(
        images.flatMap((image) => {
          try {
            return this.sdParser.parse(image.aiJson || image.promptText).loras
          } catch {
            return []
          }
        }),
      )
    }

    if (row.type === 'ComfyUI') {
      const rawLoras = this.extractLorasFromParsedPayload(rawPayload)
      if (rawLoras.length > 0) {
        return rawLoras
      }

      return dedupeLoras(
        images.flatMap((image) => {
          try {
            return this.comfyuiParser.parse(image.aiJson || image.promptText).loras
          } catch {
            return []
          }
        }),
      )
    }

    return []
  }

  private extractLorasFromParsedPayload(payload: unknown): PromptTag[] {
    if (typeof payload !== 'object' || payload === null || !('loras' in payload)) {
      return []
    }

    const rawLoras = payload.loras
    if (!Array.isArray(rawLoras)) {
      return []
    }

    return dedupeLoras(
      rawLoras.flatMap((lora) => {
        if (!isPromptTagPayload(lora)) {
          return []
        }

        return lora.weight === undefined ? [{ text: lora.text }] : [{ text: lora.text, weight: lora.weight }]
      }),
    )
  }

  private safeParseJson(value: string): unknown {
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }
}
