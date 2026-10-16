import type { AitagImportResult, PromptSourceType } from '@shared/types/importer'

import { EntriesRepository } from '../../db/repositories/entries.repo'
import { ImagesRepository } from '../../db/repositories/images.repo'
import { PromptTypeDetector } from '../parser/auto-detect'
import { asObject } from '../parser/json-utils'
import { WorkflowsService } from '../workflow/workflows.service'
import { ImageCacheDownloader } from './image-downloader'

const AITAG_BASE_URL = 'https://aitag.win'
const AITAG_IMAGE_BASE_URL = 'https://ai-img.10118899.xyz'

interface AitagApiImage {
  index?: number
  ai_json?: string
  prompt_text?: string
  image_path?: string
  file_name?: string
  image_type?: string
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
  json?: string
  original_urls?: string
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

function normalizeImageRelativeUrl(relativePath: string): string {
  const normalized = relativePath.replace(/^\/+/, '')
  return `${AITAG_IMAGE_BASE_URL}/${normalized}`
}

function normalizeImageTypeSegment(type: string): string {
  if (type === 'COMFYUI') {
    return 'ComfyUI'
  }

  return type
}

function buildFallbackImageUrl(type: string, authorId: string, pixivId: string, index: number): string {
  return `${AITAG_IMAGE_BASE_URL}/${normalizeImageTypeSegment(type)}/${authorId}/${pixivId}_p${index}.webp`
}

function extractFileStem(url: string): string | null {
  const pathname = new URL(url).pathname
  const lastSegment = pathname.split('/').pop()
  if (!lastSegment) {
    return null
  }

  const match = lastSegment.match(/^(.+?)\.[a-z0-9]+$/i)
  return match?.[1] ?? null
}

function parseJsonArray(value: string | undefined): string[] {
  if (!value) {
    return []
  }

  try {
    const parsed: unknown = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string')
    }
  } catch {
    return []
  }

  return []
}

function buildPixivImageLookup(work: AitagApiWork): Map<string, string> {
  const lookup = new Map<string, string>()

  if (work.json) {
    try {
      const parsedUnknown: unknown = JSON.parse(work.json)
      if (typeof parsedUnknown === 'object' && parsedUnknown !== null && 'meta_pages' in parsedUnknown) {
        const metaPagesUnknown = parsedUnknown.meta_pages
        if (Array.isArray(metaPagesUnknown)) {
          for (const page of metaPagesUnknown) {
            if (typeof page !== 'object' || page === null || !('image_urls' in page)) {
              continue
            }

            const imageUrlsUnknown = asObject(page)?.image_urls
            const imageUrlsObject = asObject(imageUrlsUnknown)
            if (!imageUrlsObject) {
              continue
            }

            const imageUrls = imageUrlsObject as {
              large?: unknown
              medium?: unknown
              original?: unknown
            }

            const candidates = [imageUrls.large, imageUrls.medium, imageUrls.original]
              .filter((url): url is string => typeof url === 'string' && url.length > 0)

            for (const url of candidates) {
              const stem = extractFileStem(url)
              if (stem && !lookup.has(stem)) {
                lookup.set(stem, url)
              }
            }
          }
        }
      }
    } catch {
      // Ignore malformed Pixiv payloads and fall back below.
    }
  }

  for (const url of parseJsonArray(work.original_urls)) {
    const stem = extractFileStem(url)
    if (stem && !lookup.has(stem)) {
      lookup.set(stem, url)
    }
  }

  return lookup
}

function resolveImageUrl(
  image: AitagApiImage,
  type: string,
  authorId: string,
  pixivId: string,
  index: number,
  pixivImageLookup: Map<string, string>,
): string {
  if (typeof image.image_path === 'string' && image.image_path.length > 0) {
    if (/^https?:\/\//i.test(image.image_path)) {
      return image.image_path
    }

    return normalizeImageRelativeUrl(image.image_path)
  }

  if (typeof image.file_name === 'string' && image.file_name.length > 0) {
    const hasExtension = /\.[a-z0-9]+$/i.test(image.file_name)
    const normalizedFileName = hasExtension ? image.file_name : `${image.file_name}.webp`
    return normalizeImageRelativeUrl(`${normalizeImageTypeSegment(type)}/${authorId}/${normalizedFileName}`)
  }

  const pixivFileName = `${pixivId}_p${index}`
  const pixivUrl = pixivImageLookup.get(pixivFileName)
  if (pixivUrl) {
    return pixivUrl
  }

  return buildFallbackImageUrl(type, authorId, pixivId, index)
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
    const pixivImageLookup = buildPixivImageLookup(work)

    const imageRecords = images.map((image, index) => {
      const imageIndex = typeof image.index === 'number' ? image.index : index
      return {
        index: imageIndex,
        aiJson: image.ai_json ?? '',
        promptText: image.prompt_text ?? '',
        originalUrl: resolveImageUrl(image, detectedType, authorId, pixivId, imageIndex, pixivImageLookup),
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
    private readonly workflowsService = new WorkflowsService(),
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

    if (result.detectedType === 'ComfyUI') {
      const workflowSource = downloaded
        .map((image) => image.aiJson.trim().length > 0 ? image.aiJson : image.promptText)
        .find((value) => value.trim().length > 0)
      if (workflowSource) {
        this.workflowsService.ensureWorkflowForEntry({
          entryId,
          name: `${result.work.title || result.work.pixivId} Workflow`,
          workflowJson: workflowSource,
        })
      }
    }

    return {
      ...result,
      entryId,
      images: downloaded,
    }
  }
}
