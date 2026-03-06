import { AppError } from '@main/ipc/wrap-ipc'
import type { LLMConnectionTestResult, LLMProvider } from '@shared/types/llm'

export interface ResolvedLLMConfig {
  id: string
  name: string
  provider: LLMProvider
  endpoint: string
  apiKey: string | null
  modelName: string
  temperature: number
}

export interface ProviderCompletionInput {
  config: ResolvedLLMConfig
  systemPrompt: string
  userPrompt: string
}

export interface ProviderCompletionResult {
  content: string
  raw: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

function normalizeEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/\/+$/, '')

  if (trimmed.endsWith('/chat/completions')) {
    return trimmed
  }

  if (trimmed.endsWith('/v1')) {
    return `${trimmed}/chat/completions`
  }

  if (trimmed.endsWith('/api/openai/v1')) {
    return `${trimmed}/chat/completions`
  }

  return `${trimmed}/v1/chat/completions`
}

function buildHeaders(config: ResolvedLLMConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`
  }

  return headers
}

function extractContent(payload: unknown): string {
  if (!isRecord(payload)) {
    throw new AppError('LLM_BAD_RESPONSE', 'LLM 响应格式错误。')
  }

  const choices = payload.choices
  if (!isUnknownArray(choices) || choices.length === 0) {
    throw new AppError('LLM_BAD_RESPONSE', 'LLM 响应 choices 为空。')
  }

  const firstChoice = choices[0]
  if (!isRecord(firstChoice)) {
    throw new AppError('LLM_BAD_RESPONSE', 'LLM 响应首个 choice 格式错误。')
  }

  const message = firstChoice.message
  if (!isRecord(message)) {
    throw new AppError('LLM_BAD_RESPONSE', 'LLM 响应 message 字段缺失。')
  }

  const content = message.content
  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    return content
      .flatMap((part) => {
        if (typeof part === 'string') {
          return [part]
        }

        if (!isRecord(part)) {
          return []
        }

        const text = part.text
        return typeof text === 'string' ? [text] : []
      })
      .join('\n')
  }

  throw new AppError('LLM_BAD_RESPONSE', 'LLM 响应 content 格式无法识别。')
}

async function performRequest(config: ResolvedLLMConfig, body: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(normalizeEndpoint(config.endpoint), {
    method: 'POST',
    headers: buildHeaders(config),
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new AppError(
      'LLM_HTTP_ERROR',
      `LLM 请求失败 (${response.status}): ${detail.slice(0, 240) || response.statusText}`,
    )
  }

  const payload: unknown = await response.json()
  return payload
}

export class OpenAICompatibleProvider {
  async completeJSON(input: ProviderCompletionInput): Promise<ProviderCompletionResult> {
    const baseBody = {
      model: input.config.modelName,
      temperature: input.config.temperature,
      messages: [
        { role: 'system', content: input.systemPrompt },
        { role: 'user', content: input.userPrompt },
      ],
    }

    try {
      const payload = await performRequest(input.config, {
        ...baseBody,
        response_format: { type: 'json_object' },
      })

      return {
        content: extractContent(payload),
        raw: payload,
      }
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== 'LLM_HTTP_ERROR') {
        throw error
      }

      const payload = await performRequest(input.config, baseBody)
      return {
        content: extractContent(payload),
        raw: payload,
      }
    }
  }

  async testConnection(config: ResolvedLLMConfig): Promise<LLMConnectionTestResult> {
    const startedAt = Date.now()
    const result = await this.completeJSON({
      config,
      systemPrompt: 'Reply with a JSON object only.',
      userPrompt: '{"ping":"pong"}',
    })

    return {
      ok: true,
      provider: config.provider,
      endpoint: config.endpoint,
      model: config.modelName,
      latencyMs: Date.now() - startedAt,
      message: result.content,
    }
  }
}

