import type { AitagImportResult, PromptSourceType } from '@shared/types/importer'

import { EntriesRepository } from '../../db/repositories/entries.repo'
import { ImagesRepository } from '../../db/repositories/images.repo'
import { PromptTypeDetector } from '../parser/auto-detect'
import { ImageCacheDownloader } from './image-downloader'

const AITAG_BASE_URL = 'https://aitag.win'

interface AitagApiImage {
  index?: number
  ai_json?: string
  prompt_text?: string
}

interface AitagApiWork {
  id?: number | string
  userid?: number | string
  title?: string
  caption?: string
  tags?: string
  create_date?: string
  total_view?: number
  total_bookmarks?: number
  ai_type?: string
}

interface AitagApiResponse {
  work?: AitagApiWork
  images?: AitagApiImage[]
}

type AitagDetectedType = 'NAI' | 'SD' | 'COMFYUI' | 'UNKNOWN'

function parseTags(tagsText: string | undefined): string[] {
  if (!tagsText) {
    return []
  }

  try {
    const parsedUnknown: unknown = JSON.parse(tagsText)
    if (Array.isArray(parsedUnknown)) {
      return parsedUnknown.filter((item): item is string => typeof item === 'string')
    }
  } catch {
    return tagsText
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
  }

  return []
}

function normalizeDetectedType(type: PromptSourceType): AitagDetectedType {
  if (type === 'ComfyUI') {
    return 'COMFYUI'
  }

  if (type === 'NAI' || type === 'SD') {
    return type
  }

  return 'UNKNOWN'
}

function toImportDetectedType(type: AitagDetectedType): AitagImportResult['detectedType'] {
  if (type === 'COMFYUI') {
    return 'ComfyUI'
  }

  if (type === 'UNKNOWN') {
    return 'Unknown'
  }

  return type
}

function toEntryType(type: AitagImportResult['detectedType']): 'NAI' | 'SD' | 'ComfyUI' {
  if (type === 'Unknown') {
    // Keep persistence resilient even when detection is ambiguous.
    return 'SD'
  }

  return type
}

function resolveWorkType(work: AitagApiWork, images: AitagApiImage[]): AitagDetectedType {
  const explicitType = work.ai_type?.toUpperCase()
  if (explicitType === 'NAI' || explicitType === 'SD' || explicitType === 'COMFYUI') {
    return explicitType
  }

  const detector = new PromptTypeDetector()
  for (const image of images) {
    if (!image.ai_json) {
      continue
    }

    const result = detector.detect(image.ai_json)
    const normalized = normalizeDetectedType(result.type)
    if (normalized !== 'UNKNOWN') {
      return normalized
    }
  }

  return 'UNKNOWN'
}

function buildImageUrl(type: string, authorId: string, pixivId: string, index: number): string {
  return `${AITAG_BASE_URL}/${type}/${authorId}/${pixivId}_p${index}.webp`
}

async function fetchJson(url: string): Promise<AitagApiResponse> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: 'application/json, text/plain, */*',
        referer: `${AITAG_BASE_URL}/`,
      },
    })

    if (!response.ok) {
      throw new Error(`aitag request failed: ${response.status}`)
    }

    return (await response.json()) as AitagApiResponse
  } finally {
    clearTimeout(timeout)
  }
}

export function extractPixivId(input: string): string {
  const trimmed = input.trim()

  const directMatch = trimmed.match(/^(\d{5,})$/)
  if (directMatch) {
    return directMatch[1]
  }

  const urlMatch = trimmed.match(/\/i\/(\d{5,})/i)
  if (urlMatch) {
    return urlMatch[1]
  }

  throw new Error('Invalid aitag input. Please provide pixiv id or aitag work URL.')
}

export class AitagClient {
  async fetchWork(input: string): Promise<AitagImportResult> {
    const pixivId = extractPixivId(input)
    const apiUrl = `${AITAG_BASE_URL}/api/work/${pixivId}`
    const payload = await fetchJson(apiUrl)

    const work = payload.work ?? {}
    const images = Array.isArray(payload.images) ? payload.images : []
    const authorId = String(work.userid ?? '')
    const detectedType = resolveWorkType(work, images)

    const imageRecords = images.map((image, index) => {
      const imageIndex = typeof image.index === 'number' ? image.index : index
      return {
        index: imageIndex,
        aiJson: image.ai_json ?? '',
        promptText: image.prompt_text ?? '',
        originalUrl: buildImageUrl(detectedType, authorId, pixivId, imageIndex),
        localPath: null,
      }
    })

    return {
      detectedType: toImportDetectedType(detectedType),
      work: {
        pixivId,
        authorId,
        title: work.title ?? '',
        caption: work.caption ?? '',
        tags: parseTags(work.tags),
        createDate: work.create_date ?? null,
        totalView: work.total_view ?? null,
        totalBookmarks: work.total_bookmarks ?? null,
        sourceUrl: `${AITAG_BASE_URL}/i/${pixivId}`,
      },
      images: imageRecords,
      raw: {
        work: work as Record<string, unknown>,
        images: images as Record<string, unknown>[],
      },
    }
  }
}

export class AitagScraperService {
  constructor(
    private readonly client = new AitagClient(),
    private readonly downloader = new ImageCacheDownloader(),
    private readonly entriesRepository = new EntriesRepository(),
    private readonly imagesRepository = new ImagesRepository(),
  ) {}

  async importByInput(input: string): Promise<AitagImportResult> {
    const result = await this.client.fetchWork(input)
    const downloaded = await this.downloader.download(result.work.pixivId, result.images)

    const entryId = this.entriesRepository.upsert({
      pixivId: result.work.pixivId,
      authorId: result.work.authorId,
      title: result.work.title,
      caption: result.work.caption,
      type: toEntryType(result.detectedType),
      tags: result.work.tags,
      sourceUrl: result.work.sourceUrl,
      postDate: result.work.createDate,
      views: result.work.totalView,
      bookmarks: result.work.totalBookmarks,
      rawJson: JSON.stringify(result.raw),
    })

    this.imagesRepository.replaceForEntry(entryId, downloaded)

    return {
      ...result,
      entryId,
      images: downloaded,
    }
  }
}
