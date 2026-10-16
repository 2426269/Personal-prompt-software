import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { AppError } from '@main/ipc/wrap-ipc'
import type {
  NAIConnectionInput,
  NAIConnectionResult,
  NAIGeneratedImage,
  NAIImageSourceInput,
  NAISubmitInput,
  NAISubmitResult,
} from '@shared/types/nai'

import { writeStructuredLog } from '../../logging'
import { asObject } from '../parser/json-utils'

const execFileAsync = promisify(execFile)
const DEFAULT_BASE_URL = 'https://api.novelai.net'

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function normalizeBaseUrl(input?: string): string {
  const trimmed = input?.trim() || DEFAULT_BASE_URL
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  try {
    const url = new URL(withProtocol)
    return url.toString().replace(/\/+$/, '')
  } catch {
    throw new AppError('NAI_BASE_URL_INVALID', 'NovelAI 地址格式无效。')
  }
}

function normalizeConnection(input: NAIConnectionInput): { apiKey: string; baseUrl: string; timeoutMs: number } {
  const apiKey = input.apiKey.trim()
  if (!apiKey) {
    throw new AppError('NAI_API_KEY_REQUIRED', '请填写 NovelAI API Key。')
  }

  return {
    apiKey,
    baseUrl: normalizeBaseUrl(input.baseUrl),
    timeoutMs: input.timeoutMs && input.timeoutMs > 0 ? input.timeoutMs : 60000,
  }
}

function buildUrl(baseUrl: string, route: string): string {
  return new URL(route, `${baseUrl}/`).toString()
}

function extractApiError(payload: unknown, fallback: string): string {
  const objectPayload = asObject(payload)
  return (
    asString(objectPayload?.message) ??
    asString(objectPayload?.error) ??
    asString(objectPayload?.statusText) ??
    fallback
  )
}

function stripDataUrlPrefix(value: string): string {
  const match = value.match(/^data:[^;]+;base64,(.+)$/)
  return match?.[1] ?? value
}

async function resolveImageBase64(source: NAIImageSourceInput | null | undefined): Promise<string | null> {
  if (!source) {
    return null
  }

  if (source.dataUrl?.trim()) {
    return stripDataUrlPrefix(source.dataUrl.trim())
  }

  if (source.localPath?.trim()) {
    const buffer = await fs.readFile(source.localPath.trim())
    return buffer.toString('base64')
  }

  return null
}

function parseJsonImagePayload(payload: unknown): string[] {
  const objectPayload = asObject(payload)
  if (!objectPayload) {
    return []
  }

  const images: string[] = []
  const single = asString(objectPayload.image)
  if (single) {
    images.push(single)
  }

  const imageList = objectPayload.images
  if (Array.isArray(imageList)) {
    for (const value of imageList) {
      const maybe = asString(value)
      if (maybe) {
        images.push(maybe)
      }
    }
  }

  return images
}

function parseSseImagePayload(text: string): string[] {
  const images: string[] = []

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) {
      continue
    }

    const payloadText = trimmed.slice(5).trim()
    if (!payloadText) {
      continue
    }

    try {
      const parsed = JSON.parse(payloadText) as unknown
      images.push(...parseJsonImagePayload(parsed))
    } catch {
      continue
    }
  }

  return images
}

async function extractZipToImages(buffer: Buffer, requestId: string): Promise<NAIGeneratedImage[]> {
  const rootDir = path.join(os.tmpdir(), 'promptforge-nai-results', requestId)
  const zipPath = path.join(rootDir, 'result.zip')
  const extractDir = path.join(rootDir, 'unzipped')
  await fs.mkdir(rootDir, { recursive: true })
  await fs.writeFile(zipPath, buffer)

  await execFileAsync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      "param([string]$Zip,[string]$Dest) Expand-Archive -LiteralPath $Zip -DestinationPath $Dest -Force",
      zipPath,
      extractDir,
    ],
    { windowsHide: true },
  )

  const files = await fs.readdir(extractDir, { recursive: true })
  const imageFiles = files
    .filter((file) => typeof file === 'string')
    .map((file) => path.join(extractDir, file))
    .filter((file) => /\.(png|jpe?g|webp)$/i.test(file))
    .sort()

  return imageFiles.map((file, index) => ({
    index,
    src: `file://${file.replace(/\\/g, '/')}`,
    localPath: file,
    mimeType: file.toLowerCase().endsWith('.png')
      ? 'image/png'
      : file.toLowerCase().endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg',
  }))
}

function base64ImagesToResult(images: string[]): NAIGeneratedImage[] {
  return images.map((image, index) => ({
    index,
    src: `data:image/png;base64,${image}`,
    localPath: null,
    mimeType: 'image/png',
  }))
}

export class NAIClient {
  async testConnection(input: NAIConnectionInput): Promise<NAIConnectionResult> {
    const connection = normalizeConnection(input)

    try {
      const [information, subscription] = await Promise.all([
        this.requestJson<Record<string, unknown>>(buildUrl(connection.baseUrl, '/user/information'), {
          apiKey: connection.apiKey,
          timeoutMs: connection.timeoutMs,
        }),
        this.requestJson<Record<string, unknown>>(buildUrl(connection.baseUrl, '/user/subscription'), {
          apiKey: connection.apiKey,
          timeoutMs: connection.timeoutMs,
        }).catch(() => null),
      ])

      const account = asObject(information)
      const perks = subscription ? asObject(subscription.perks) : null

        const result: NAIConnectionResult = {
          ok: true,
          normalizedBaseUrl: connection.baseUrl,
          accountEmail: asString(account?.email),
          tier: asString(account?.tier) ?? asString(subscription ? subscription.tier : null),
          perksUnlimitedImageGeneration: asBoolean(perks?.unlimitedImageGeneration),
          trainingStepsLeft: asNumber(subscription?.trainingStepsLeft),
        }

      writeStructuredLog({
        module: 'llm',
        level: 'info',
        action: 'nai.connection.test',
        summary: `NovelAI 连接测试成功：${connection.baseUrl}`,
        request: { baseUrl: connection.baseUrl },
        response: result,
      })

      return result
    } catch (error) {
      writeStructuredLog({
        module: 'llm',
        level: 'error',
        action: 'nai.connection.test',
        summary: `NovelAI 连接测试失败：${connection.baseUrl}`,
        request: { baseUrl: connection.baseUrl },
        error,
      })
      throw error
    }
  }

  async submit(input: NAISubmitInput): Promise<NAISubmitResult> {
    const connection = normalizeConnection(input.connection)
    const prompt = input.prompt.trim()
    if (!prompt) {
      throw new AppError('NAI_PROMPT_REQUIRED', '请填写正向提示词。')
    }

    if (input.action === 'img2img') {
      const maybeImage = await resolveImageBase64(input.referenceImage)
      if (!maybeImage) {
        throw new AppError('NAI_REFERENCE_IMAGE_REQUIRED', '图生图模式需要一张参考图。')
      }
    }

    const requestId = randomUUID()
    const queuedAt = new Date().toISOString()
    const startedAt = Date.now()
    const referenceImage = await resolveImageBase64(input.referenceImage)

    const body = {
      input: prompt,
      model: input.model,
      action: input.action,
      parameters: {
        prompt,
        uc: input.negativePrompt?.trim() || '',
        width: input.parameters.width,
        height: input.parameters.height,
        steps: input.parameters.steps,
        scale: input.parameters.scale,
        sampler: input.parameters.sampler,
        seed: input.parameters.seed ?? undefined,
        cfg_rescale: input.parameters.cfgRescale ?? undefined,
        sm: input.parameters.sm ?? undefined,
        sm_dyn: input.parameters.smDyn ?? undefined,
        qualityToggle: input.parameters.qualityToggle ?? undefined,
        strength: input.parameters.strength ?? undefined,
        noise: input.parameters.noise ?? undefined,
        image: referenceImage ?? undefined,
      },
    }

    try {
      const response = await this.request(buildUrl(connection.baseUrl, '/ai/generate-image'), {
        method: 'POST',
        apiKey: connection.apiKey,
        timeoutMs: connection.timeoutMs,
        body,
      })

      const contentType = response.headers.get('content-type') ?? ''
      let images: NAIGeneratedImage[] = []

      if (contentType.includes('application/json')) {
        const payload = await response.json()
        images = base64ImagesToResult(parseJsonImagePayload(payload))
      } else if (contentType.includes('text/event-stream')) {
        const payload = await response.text()
        images = base64ImagesToResult(parseSseImagePayload(payload))
      } else {
        const buffer = Buffer.from(await response.arrayBuffer())
        images = await extractZipToImages(buffer, requestId)
      }

      if (images.length === 0) {
        throw new AppError('NAI_IMAGE_MISSING', 'NovelAI 未返回可显示的生成结果。')
      }

      const result: NAISubmitResult = {
        requestId,
        entryId: input.entryId ?? null,
        imageIndex: input.imageIndex ?? null,
        presetId: input.presetId ?? null,
        action: input.action,
        model: input.model,
        status: 'completed',
        queuedAt,
        completedAt: new Date().toISOString(),
        elapsedMs: Date.now() - startedAt,
        normalizedBaseUrl: connection.baseUrl,
        images,
      }

      writeStructuredLog({
        module: 'llm',
        level: 'info',
        action: 'nai.generate',
        summary: `NovelAI 生成完成：${requestId}`,
        entryId: input.entryId ?? null,
        imageIndex: input.imageIndex ?? null,
        request: {
          baseUrl: connection.baseUrl,
          model: input.model,
          action: input.action,
          hasReferenceImage: Boolean(referenceImage),
          parameters: body.parameters,
        },
        response: {
          imageCount: result.images.length,
          elapsedMs: result.elapsedMs,
        },
      })

      return result
    } catch (error) {
      writeStructuredLog({
        module: 'llm',
        level: 'error',
        action: 'nai.generate',
        summary: `NovelAI 生成失败：${requestId}`,
        entryId: input.entryId ?? null,
        imageIndex: input.imageIndex ?? null,
        request: {
          baseUrl: connection.baseUrl,
          model: input.model,
          action: input.action,
          hasReferenceImage: Boolean(referenceImage),
          parameters: body.parameters,
        },
        error,
      })
      throw error
    }
  }

  private async requestJson<T>(
    url: string,
    options: {
      apiKey: string
      timeoutMs: number
      method?: string
      body?: Record<string, unknown>
    },
  ): Promise<T> {
    const response = await this.request(url, options)
    return (await response.json()) as T
  }

  private async request(
    url: string,
    options: {
      apiKey: string
      timeoutMs: number
      method?: string
      body?: Record<string, unknown>
    },
  ): Promise<Response> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs)

    try {
      const response = await fetch(url, {
        method: options.method ?? 'GET',
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          Accept: 'application/json, text/event-stream, application/octet-stream, application/zip',
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      })

      if (!response.ok) {
        const payloadText = await response.text()
        let parsed: unknown = payloadText
        try {
          parsed = JSON.parse(payloadText) as unknown
        } catch {
          parsed = payloadText
        }
        throw new AppError(
          'NAI_HTTP_ERROR',
          `NovelAI 请求失败：${response.status} ${extractApiError(parsed, response.statusText)}`,
          parsed,
        )
      }

      return response
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new AppError('NAI_TIMEOUT', 'NovelAI 请求超时。')
      }

      throw new AppError('NAI_NETWORK_ERROR', error instanceof Error ? error.message : 'NovelAI 网络请求失败。')
    } finally {
      clearTimeout(timeout)
    }
  }
}
