import type {
  EntryDeleteInput,
  EntryDeleteResult,
  EntryDetail,
  EntryImageDetail,
  EntryListItem,
  EntryListParams,
  EntryListResult,
  EntryUpdateInput,
} from '@shared/types/entry'
import type { AitagImage, PromptModelReference, PromptTag } from '@shared/types/importer'

import { EntriesRepository, type EntryDetailRow, type EntryListRow } from '../../db/repositories/entries.repo'
import { ImagesRepository } from '../../db/repositories/images.repo'
import { WorkflowsRepository } from '../../db/repositories/workflows.repo'
import { LLMService } from '../llm/llm-service'
import { ComfyUIParser } from '../parser/comfyui-parser'
import { RemoteLoraService } from '../remote/remote-lora.service'
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

function dedupeModelReferences<T extends PromptModelReference>(items: T[]): T[] {
  const seen = new Set<string>()
  const result: T[] = []

  for (const item of items) {
    const key = `${item.text}:${item.weight ?? ''}:${item.hash ?? ''}:${item.modelVersionId ?? ''}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    result.push(item)
  }

  return result
}

function isPromptTagPayload(value: unknown): value is PromptModelReference {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const maybeTag = value as Record<string, unknown>
  return typeof maybeTag.text === 'string'
}

export class EntriesService {
  constructor(
    private readonly entriesRepository: EntriesRepository = new EntriesRepository(),
    private readonly imagesRepository: ImagesRepository = new ImagesRepository(),
    private readonly tagsService: TagsService = new TagsService(),
    private readonly llmService: LLMService = new LLMService(),
    private readonly sdParser: SDParser = new SDParser(),
    private readonly comfyuiParser: ComfyUIParser = new ComfyUIParser(),
    private readonly remoteLoraService: RemoteLoraService = new RemoteLoraService(),
    private readonly workflowsRepository: WorkflowsRepository = new WorkflowsRepository(),
  ) {}

  list(params: EntryListParams): EntryListResult {
    const normalizedParams: EntryListParams = {
      favoritesOnly: params.favoritesOnly ?? false,
      includeDeleted: params.includeDeleted ?? false,
      page: Math.max(1, params.page),
      pageSize: Math.max(1, params.pageSize),
      searchMode: params.searchMode,
      searchQuery: params.searchQuery?.trim() ?? '',
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
      type: params.type ?? 'all',
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

    const images = this.imagesRepository.listByEntryId(id).map((image) => this.toEntryImageDetail(row.type, image))
    const userTagRecords = this.tagsService.getByEntryId(id)
    const analyses = this.llmService.listAnalysesForEntry(id)
    const analysis = analyses[0] ?? null
    const loras = this.extractLoras(row, images)
    const checkpoints = this.extractCheckpoints(row, images)
    const workflowBindingRow = this.workflowsRepository.getBindingByEntryId(id)
    const workflowBinding =
      workflowBindingRow &&
      (
        workflowBindingRow.original_workflow_id !== null ||
        workflowBindingRow.clean_workflow_id !== null ||
        workflowBindingRow.preferred_test_workflow_id !== null
      )
        ? {
            entryId: workflowBindingRow.entry_id,
            originalWorkflowId: workflowBindingRow.original_workflow_id,
            cleanWorkflowId: workflowBindingRow.clean_workflow_id,
            preferredTestWorkflowId: workflowBindingRow.preferred_test_workflow_id,
            updatedAt: workflowBindingRow.updated_at,
          }
        : null

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
      loras,
      checkpoints,
      rawJson: row.raw_json,
      images,
      analysis,
      analyses,
      remoteLoraCheck: this.remoteLoraService.matchPromptTags(loras),
      remoteCheckpointCheck: this.remoteLoraService.matchCheckpoints(checkpoints),
      workflowBinding,
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
      userTags: parseTags(row.user_tags),
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

  private extractLoras(row: EntryDetailRow, images: AitagImage[]): PromptTag[] {
    const rawPayload = this.safeParseJson(row.raw_json)
    const fromParsedPayload = this.extractModelsFromParsedPayload(rawPayload, 'loras')
    if (fromParsedPayload.length > 0) {
      return fromParsedPayload
    }

    if (row.type === 'SD') {
      return dedupeModelReferences(
        images.flatMap((image: AitagImage) => {
          try {
            return this.sdParser.parse(image.aiJson || image.promptText).loras
          } catch {
            return []
          }
        }),
      )
    }

    if (row.type === 'ComfyUI') {
      return dedupeModelReferences(
        images.flatMap((image: AitagImage) => {
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

  private extractCheckpoints(row: EntryDetailRow, images: AitagImage[]): PromptModelReference[] {
    const rawPayload = this.safeParseJson(row.raw_json)
    const fromParsedPayload = this.extractModelsFromParsedPayload(rawPayload, 'checkpoints')
    if (fromParsedPayload.length > 0) {
      return fromParsedPayload
    }

    if (row.type === 'SD') {
      return dedupeModelReferences(
        images.flatMap((image: AitagImage) => {
          try {
            return this.sdParser.parse(image.aiJson || image.promptText).checkpoints
          } catch {
            return []
          }
        }),
      )
    }

    if (row.type === 'ComfyUI') {
      return dedupeModelReferences(
        images.flatMap((image: AitagImage) => {
          try {
            return this.comfyuiParser.parse(image.aiJson || image.promptText).checkpoints
          } catch {
            return []
          }
        }),
      )
    }

    return []
  }

  private extractModelsFromParsedPayload(payload: unknown, key: 'loras' | 'checkpoints'): PromptModelReference[] {
    if (typeof payload !== 'object' || payload === null || !(key in payload)) {
      return []
    }

    const rawModels = (payload as Record<string, unknown>)[key]
    if (!Array.isArray(rawModels)) {
      return []
    }

    return dedupeModelReferences(
      rawModels.flatMap((item) => {
        if (!isPromptTagPayload(item)) {
          return []
        }

        const normalized: PromptModelReference = {
          text: item.text,
          weight: typeof item.weight === 'number' ? item.weight : undefined,
          hash: typeof item.hash === 'string' ? item.hash : null,
          modelId: typeof item.modelId === 'number' ? item.modelId : null,
          modelVersionId: typeof item.modelVersionId === 'number' ? item.modelVersionId : null,
        }

        return [normalized]
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

  private toEntryImageDetail(type: EntryDetailRow['type'], image: AitagImage): EntryImageDetail {
    const parsed = this.parseImageModels(type, image)

    return {
      ...image,
      parsedLoras: parsed.loras,
      parsedCheckpoints: parsed.checkpoints,
      remoteLoraCheck: this.remoteLoraService.matchPromptTags(parsed.loras),
      remoteCheckpointCheck: this.remoteLoraService.matchCheckpoints(parsed.checkpoints),
    }
  }

  private parseImageModels(
    type: EntryDetailRow['type'],
    image: AitagImage,
  ): { loras: PromptTag[]; checkpoints: PromptModelReference[] } {
    const source = image.aiJson || image.promptText
    if (!source.trim()) {
      return { loras: [], checkpoints: [] }
    }

    try {
      if (type === 'SD') {
        const parsed = this.sdParser.parse(source)
        return {
          loras: dedupeModelReferences(parsed.loras),
          checkpoints: dedupeModelReferences(parsed.checkpoints),
        }
      }

      if (type === 'ComfyUI') {
        const parsed = this.comfyuiParser.parse(source)
        return {
          loras: dedupeModelReferences(parsed.loras),
          checkpoints: dedupeModelReferences(parsed.checkpoints),
        }
      }
    } catch {
      return { loras: [], checkpoints: [] }
    }

    return { loras: [], checkpoints: [] }
  }
}



