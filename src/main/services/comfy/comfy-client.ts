import { AppError } from '@main/ipc/wrap-ipc'
import type {
  ComfyConnectionInput,
  ComfyConnectionResult,
  ComfyGeneratedImage,
  ComfyQueueStatusResult,
} from '@shared/types/comfy'

import { asObject } from '../parser/json-utils'
import { writeStructuredLog } from '../../logging'

interface NormalizedConnection {
  baseUrl: string
  historyRoute: string
  clientId: string
  timeoutMs: number
}

interface QueueSnapshot {
  raw: { queue_running?: unknown[]; queue_pending?: unknown[] } | null
  runningCount: number
  pendingCount: number
  isRunningPrompt: (promptId: string) => boolean
  isPendingPrompt: (promptId: string) => boolean
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) {
    throw new AppError('COMFY_BASE_URL_REQUIRED', '请填写 ComfyUI 地址。')
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`

  try {
    const url = new URL(withProtocol)
    return url.toString().replace(/\/+$/, '')
  } catch {
    throw new AppError('COMFY_BASE_URL_INVALID', 'ComfyUI 地址格式无效。')
  }
}

function normalizeHistoryRoute(route?: string): string {
  const trimmed = (route ?? '/history').trim()
  if (!trimmed) {
    return '/history'
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

function buildUrl(baseUrl: string, route: string): string {
  return new URL(route, `${baseUrl}/`).toString()
}

function buildHistoryUrl(baseUrl: string, route: string, promptId: string): string {
  if (route.includes('{promptId}')) {
    return buildUrl(baseUrl, route.replace('{promptId}', encodeURIComponent(promptId)))
  }

  return buildUrl(baseUrl, `${route.replace(/\/+$/, '')}/${encodeURIComponent(promptId)}`)
}

function buildViewUrl(baseUrl: string, image: { filename: string; subfolder?: string; type?: string }): string {
  const url = new URL('/view', `${baseUrl}/`)
  url.searchParams.set('filename', image.filename)
  url.searchParams.set('subfolder', image.subfolder ?? '')
  url.searchParams.set('type', image.type ?? 'output')
  return url.toString()
}

function normalizeConnection(input: ComfyConnectionInput): NormalizedConnection {
  return {
    baseUrl: normalizeBaseUrl(input.baseUrl),
    historyRoute: normalizeHistoryRoute(input.historyRoute),
    clientId: input.clientId?.trim() || 'promptforge-client',
    timeoutMs: input.timeoutMs && input.timeoutMs > 0 ? input.timeoutMs : 15000,
  }
}

function hasPromptId(queueItem: unknown, promptId: string): boolean {
  if (Array.isArray(queueItem)) {
    return queueItem.some((part) => hasPromptId(part, promptId))
  }

  const objectItem = asObject(queueItem)
  if (objectItem) {
    return Object.values(objectItem).some((part) => hasPromptId(part, promptId))
  }

  return queueItem === promptId
}

function extractImagesFromHistory(baseUrl: string, outputs: Record<string, unknown>): ComfyGeneratedImage[] {
  const images: ComfyGeneratedImage[] = []

  for (const [nodeId, rawOutput] of Object.entries(outputs)) {
    const output = asObject(rawOutput)
    const outputImages = output && Array.isArray(output.images) ? output.images : []

    for (const rawImage of outputImages) {
      const image = asObject(rawImage)
      const filename = image ? asString(image.filename) : null
      if (!filename) {
        continue
      }

      const subfolder = image ? asString(image.subfolder) ?? '' : ''
      const type = image ? asString(image.type) ?? 'output' : 'output'

      images.push({
        nodeId,
        filename,
        subfolder,
        type,
        url: buildViewUrl(baseUrl, { filename, subfolder, type }),
      })
    }
  }

  return images
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export class ComfyUIClient {
  normalize(input: ComfyConnectionInput): NormalizedConnection {
    return normalizeConnection(input)
  }

  async testConnection(input: ComfyConnectionInput): Promise<ComfyConnectionResult> {
    const connection = this.normalize(input)

    try {
      let systemStats: Record<string, unknown> | null = null
      try {
        systemStats = await this.requestJson<Record<string, unknown>>(buildUrl(connection.baseUrl, '/system_stats'), {
          timeoutMs: connection.timeoutMs,
          retryCount: 1,
        })
      } catch (error) {
        const objectInfo = await this.requestJson<Record<string, unknown>>(buildUrl(connection.baseUrl, '/object_info'), {
          timeoutMs: connection.timeoutMs,
          retryCount: 1,
        }).catch(() => null)

        if (!objectInfo) {
          throw error
        }
      }

      const queue = await this.getQueue(connection)
      const system = asObject(systemStats?.system)
      const firstDevice = Array.isArray(systemStats?.devices) ? asObject(systemStats?.devices[0]) : null

      const result = {
        ok: true,
        normalizedBaseUrl: connection.baseUrl,
        historyRoute: connection.historyRoute,
        queueRunning: queue.runningCount,
        queuePending: queue.pendingCount,
        system: {
          os: system ? asString(system.os) : null,
          comfyuiVersion: system ? asString(system.comfyui_version) : null,
          pythonVersion: system ? asString(system.python_version) : null,
        },
        device: firstDevice
          ? {
              name: asString(firstDevice.name),
              type: asString(firstDevice.type),
              vramTotal: asNumber(firstDevice.vram_total),
              vramFree: asNumber(firstDevice.vram_free),
            }
          : null,
      }

      writeStructuredLog({
        module: 'comfy',
        level: 'info',
        action: 'connection.test',
        summary: `ComfyUI 连接测试成功：${connection.baseUrl}`,
        request: {
          baseUrl: connection.baseUrl,
          historyRoute: connection.historyRoute,
          clientId: connection.clientId,
        },
        response: result,
      })

      return result
    } catch (error) {
      writeStructuredLog({
        module: 'comfy',
        level: 'error',
        action: 'connection.test',
        summary: `ComfyUI 连接测试失败：${connection.baseUrl}`,
        request: {
          baseUrl: connection.baseUrl,
          historyRoute: connection.historyRoute,
          clientId: connection.clientId,
        },
        error,
      })
      throw error
    }
  }

  async queuePrompt(input: ComfyConnectionInput, prompt: Record<string, unknown>): Promise<{
    promptId: string
    clientId: string
    normalizedBaseUrl: string
  }> {
    const connection = this.normalize(input)
    try {
      const payload = await this.requestJson<Record<string, unknown>>(buildUrl(connection.baseUrl, '/prompt'), {
        method: 'POST',
        body: { prompt, client_id: connection.clientId },
        timeoutMs: connection.timeoutMs,
      })

      const promptId = asString(payload.prompt_id)
      if (!promptId) {
        throw new AppError('COMFY_PROMPT_ID_MISSING', 'ComfyUI 未返回 prompt_id。')
      }

      const result = {
        promptId,
        clientId: connection.clientId,
        normalizedBaseUrl: connection.baseUrl,
      }

      writeStructuredLog({
        module: 'comfy',
        level: 'info',
        action: 'prompt.submit',
        summary: `ComfyUI 任务已提交：${promptId}`,
        request: {
          baseUrl: connection.baseUrl,
          prompt,
          clientId: connection.clientId,
        },
        response: payload,
      })

      return result
    } catch (error) {
      writeStructuredLog({
        module: 'comfy',
        level: 'error',
        action: 'prompt.submit',
        summary: `ComfyUI 任务提交失败：${connection.baseUrl}`,
        request: {
          baseUrl: connection.baseUrl,
          prompt,
          clientId: connection.clientId,
        },
        error,
      })
      throw error
    }
  }

  async getQueueStatus(input: ComfyConnectionInput, promptId: string): Promise<ComfyQueueStatusResult> {
    const connection = this.normalize(input)
    const [historyResult, queueResult] = await Promise.allSettled([
      this.requestJson<Record<string, unknown>>(buildHistoryUrl(connection.baseUrl, connection.historyRoute, promptId), {
        timeoutMs: connection.timeoutMs,
        retryCount: 1,
      }),
      this.getQueue(connection),
    ])

    if (historyResult.status === 'rejected') {
      const error = new AppError(
        'COMFY_HISTORY_UNAVAILABLE',
        `无法读取 ComfyUI 历史记录，请检查 History 路由或连接状态：${historyResult.reason instanceof Error ? historyResult.reason.message : 'unknown error'}`,
      )
      writeStructuredLog({
        module: 'comfy',
        level: 'error',
        action: 'queue.status',
        summary: `ComfyUI 历史记录查询失败：${promptId}`,
        request: {
          baseUrl: connection.baseUrl,
          historyRoute: connection.historyRoute,
          promptId,
        },
        error,
      })
      throw error
    }

    if (queueResult.status === 'rejected') {
      const error = new AppError(
        'COMFY_QUEUE_UNAVAILABLE',
        `无法读取 ComfyUI 队列状态：${queueResult.reason instanceof Error ? queueResult.reason.message : 'unknown error'}`,
      )
      writeStructuredLog({
        module: 'comfy',
        level: 'error',
        action: 'queue.status',
        summary: `ComfyUI 队列状态查询失败：${promptId}`,
        request: {
          baseUrl: connection.baseUrl,
          promptId,
        },
        error,
      })
      throw error
    }

    const historyPayload = historyResult.value
    const queue = queueResult.value

    const historyEntry = asObject(historyPayload[promptId])
    const status = historyEntry ? asObject(historyEntry.status) : null
    const outputs = historyEntry ? asObject(historyEntry.outputs) : null
    const images = outputs ? extractImagesFromHistory(connection.baseUrl, outputs) : []
    const historyError = asString(status?.error)
    const statusText = asString(status?.status_str)

    if (historyEntry) {
      const completed = status ? status.completed === true : images.length > 0
      if (completed) {
        const result: ComfyQueueStatusResult = {
          promptId,
          state: 'completed',
          queueRunning: queue.runningCount,
          queuePending: queue.pendingCount,
          completed: true,
          images,
          errorMessage: null,
          normalizedBaseUrl: connection.baseUrl,
        }
        writeStructuredLog({
          module: 'comfy',
          level: 'info',
          action: 'queue.status',
          summary: `ComfyUI 任务完成：${promptId}`,
          request: {
            baseUrl: connection.baseUrl,
            promptId,
          },
          response: result,
        })
        return result
      }

      if (historyError || statusText === 'error') {
        const result: ComfyQueueStatusResult = {
          promptId,
          state: 'failed',
          queueRunning: queue.runningCount,
          queuePending: queue.pendingCount,
          completed: false,
          images,
          errorMessage: historyError ?? 'ComfyUI 执行失败。',
          normalizedBaseUrl: connection.baseUrl,
        }
        writeStructuredLog({
          module: 'comfy',
          level: 'warn',
          action: 'queue.status',
          summary: `ComfyUI 任务失败：${promptId}`,
          request: {
            baseUrl: connection.baseUrl,
            promptId,
          },
          response: result,
        })
        return result
      }
    }

    const running = queue.isRunningPrompt(promptId)
    const queued = queue.isPendingPrompt(promptId)

    const result: ComfyQueueStatusResult = {
      promptId,
      state: running ? 'running' : queued ? 'queued' : 'not_found',
      queueRunning: queue.runningCount,
      queuePending: queue.pendingCount,
      completed: false,
      images: [],
      errorMessage: running || queued ? null : '未在历史记录或队列中找到该任务。',
      normalizedBaseUrl: connection.baseUrl,
    }
    writeStructuredLog({
      module: 'comfy',
      level: 'debug',
      action: 'queue.status',
      summary: `ComfyUI 状态轮询：${promptId} -> ${result.state}`,
      request: {
        baseUrl: connection.baseUrl,
        promptId,
      },
      response: result,
    })
    return result
  }

  async interrupt(input: ComfyConnectionInput, promptId?: string): Promise<{ interrupted: boolean; promptId: string | null }> {
    const connection = this.normalize(input)
    if (promptId) {
      const queue = await this.getQueue(connection)
      if (queue.isRunningPrompt(promptId) === false) {
        if (queue.isPendingPrompt(promptId)) {
          throw new AppError('COMFY_CANCEL_NOT_RUNNING', '该任务仍在排队，ComfyUI 当前接口无法按 promptId 精确取消排队任务。')
        }

        throw new AppError('COMFY_CANCEL_TARGET_MISMATCH', '当前运行中的任务不是这个 promptId，已拒绝执行全局 interrupt。')
      }
    }

    try {
      await this.requestJson<Record<string, unknown>>(buildUrl(connection.baseUrl, '/interrupt'), {
        method: 'POST',
        body: {},
        timeoutMs: connection.timeoutMs,
      })

      const result = {
        interrupted: true,
        promptId: promptId ?? null,
      }
      writeStructuredLog({
        module: 'comfy',
        level: 'info',
        action: 'queue.cancel',
        summary: `ComfyUI 任务中断成功：${promptId ?? 'current'}`,
        request: {
          baseUrl: connection.baseUrl,
          promptId: promptId ?? null,
        },
        response: result,
      })
      return result
    } catch (error) {
      writeStructuredLog({
        module: 'comfy',
        level: 'error',
        action: 'queue.cancel',
        summary: `ComfyUI 任务中断失败：${promptId ?? 'current'}`,
        request: {
          baseUrl: connection.baseUrl,
          promptId: promptId ?? null,
        },
        error,
      })
      throw error
    }
  }

  private async getQueue(connection: NormalizedConnection): Promise<QueueSnapshot> {
    const queue = await this.requestJson<Record<string, unknown>>(buildUrl(connection.baseUrl, '/queue'), {
      timeoutMs: connection.timeoutMs,
      retryCount: 1,
    })

    const queueRunning = Array.isArray(queue.queue_running) ? queue.queue_running : []
    const queuePending = Array.isArray(queue.queue_pending) ? queue.queue_pending : []

    return {
      raw: {
        queue_running: queueRunning,
        queue_pending: queuePending,
      },
      runningCount: queueRunning.length,
      pendingCount: queuePending.length,
      isRunningPrompt: (promptId: string) => queueRunning.some((item) => hasPromptId(item, promptId)),
      isPendingPrompt: (promptId: string) => queuePending.some((item) => hasPromptId(item, promptId)),
    }
  }

  private async requestJson<T>(
    url: string,
    options: {
      method?: string
      body?: Record<string, unknown>
      timeoutMs: number
      retryCount?: number
    },
  ): Promise<T> {
    const maxAttempts = 1 + (options.retryCount ?? 0)
    let lastError: AppError | null = null

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), options.timeoutMs)

      try {
        const response = await fetch(url, {
          method: options.method ?? 'GET',
          headers: options.body ? { 'content-type': 'application/json' } : undefined,
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new AppError('COMFY_HTTP_ERROR', `ComfyUI 请求失败：${response.status} ${response.statusText}`)
        }

        return (await response.json()) as T
      } catch (error) {
        if (error instanceof AppError) {
          lastError = error
        } else if (error instanceof Error && error.name === 'AbortError') {
          lastError = new AppError('COMFY_TIMEOUT', 'ComfyUI 请求超时。')
        } else {
          lastError = new AppError(
            'COMFY_NETWORK_ERROR',
            error instanceof Error ? error.message : 'ComfyUI 网络请求失败。',
          )
        }
      } finally {
        clearTimeout(timeout)
      }

      if (attempt < maxAttempts) {
        await sleep(300 * attempt)
      }
    }

    throw lastError ?? new AppError('COMFY_NETWORK_ERROR', 'ComfyUI 网络请求失败。')
  }
}
