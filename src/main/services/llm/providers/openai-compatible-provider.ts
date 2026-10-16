import { AppError } from '@main/ipc/wrap-ipc'
import type { LLMConnectionTestResult, LLMModelDescriptor, LLMProvider } from '@shared/types/llm'

export interface ResolvedLLMConfig {
  id: string
  name: string
  provider: LLMProvider
  endpoint: string
  apiKey: string | null
  modelName: string
  temperature: number
  maxTokens: number | null
  strictJsonMode: boolean
  thinkingEnabled: boolean
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

function normalizeModelsEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/\/+$/, '')

  if (trimmed.endsWith('/chat/completions')) {
    return trimmed.replace(/\/chat\/completions$/i, '/models')
  }

  if (trimmed.endsWith('/v1')) {
    return `${trimmed}/models`
  }

  if (trimmed.endsWith('/api/openai/v1')) {
    return `${trimmed}/models`
  }

  return `${trimmed}/v1/models`
}

function normalizeErrorDetails(error: unknown): unknown {
  if (error instanceof Error) {
    const errorRecord = error as unknown as Record<string, unknown>
    const extra = Object.fromEntries(
      Object.entries(errorRecord)
        .filter(([key]) => !['name', 'message', 'stack'].includes(key)),
    )

    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
      ...(Object.keys(extra).length > 0 ? extra : {}),
      ...(error.cause !== undefined ? { cause: normalizeErrorDetails(error.cause) } : {}),
    }
  }

  if (Array.isArray(error)) {
    return error.map((item) => normalizeErrorDetails(item))
  }

  if (typeof error === 'object' && error !== null) {
    return Object.fromEntries(
      Object.entries(error as Record<string, unknown>).map(([key, value]) => [key, normalizeErrorDetails(value)]),
    )
  }

  return error
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

function isDeepSeek(config: ResolvedLLMConfig): boolean {
  return config.provider === 'deepseek'
}

function buildMessages(
  input: ProviderCompletionInput,
  options?: { forceJsonHint?: boolean },
): Array<{ role: 'system' | 'user'; content: string }> {
  let systemPrompt = input.systemPrompt
  let userPrompt = input.userPrompt

  if (input.config.strictJsonMode && (options?.forceJsonHint || isDeepSeek(input.config))) {
    const jsonHint = [
      'Return one valid json object only.',
      'The final answer must be strict json with no markdown, no code fence, and no extra text.',
      'Do not return an empty content field.',
    ].join(' ')

    if (!/json/i.test(systemPrompt)) {
      systemPrompt = `${systemPrompt}\n\n${jsonHint}`
    } else if (options?.forceJsonHint) {
      systemPrompt = `${systemPrompt}\n\n${jsonHint}`
    }

    if (!/json/i.test(userPrompt)) {
      userPrompt = `${userPrompt}\n\nPlease return strict json only.`
    }
  }

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]
}

function buildRequestBody(
  input: ProviderCompletionInput,
  options?: { includeResponseFormat?: boolean; forceJsonHint?: boolean },
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: input.config.modelName,
    messages: buildMessages(input, { forceJsonHint: options?.forceJsonHint }),
  }

  if (!(isDeepSeek(input.config) && input.config.thinkingEnabled)) {
    body.temperature = input.config.temperature
  }

  if (input.config.maxTokens != null) {
    body.max_tokens = input.config.maxTokens
  }

  if (isDeepSeek(input.config) && input.config.thinkingEnabled) {
    body.thinking = { type: 'enabled' }
  }

  if (options?.includeResponseFormat && input.config.strictJsonMode) {
    body.response_format = { type: 'json_object' }
  }

  return body
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

function chooseProbeModel(config: ResolvedLLMConfig, models: LLMModelDescriptor[]): string {
  if (config.modelName.trim()) {
    return config.modelName.trim()
  }

  const available = models.map((item) => item.id)
  const preferred =
    config.provider === 'deepseek'
      ? ['deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-chat', 'deepseek-reasoner']
      : []

  const preferredMatch = preferred.find((id) => available.includes(id))
  if (preferredMatch) {
    return preferredMatch
  }

  const genericMatch = available.find((id) => !/(embedding|rerank|tts|whisper|moderation|image)/i.test(id))
  if (genericMatch) {
    return genericMatch
  }

  return available[0] ?? ''
}

async function performRequest(
  config: ResolvedLLMConfig,
  body: Record<string, unknown>,
  options?: { phase?: string },
): Promise<unknown> {
  const requestUrl = normalizeEndpoint(config.endpoint)
  let response: Response

  try {
    response = await fetch(requestUrl, {
      method: 'POST',
      headers: buildHeaders(config),
      body: JSON.stringify(body),
    })
  } catch (error) {
    throw new AppError(
      'LLM_NETWORK_ERROR',
      `LLM 请求发送失败: ${error instanceof Error ? error.message : '未知网络错误'}`,
      {
        endpoint: config.endpoint,
        requestUrl,
        provider: config.provider,
        modelName: config.modelName,
        phase: options?.phase ?? 'request',
        cause: normalizeErrorDetails(error),
      },
    )
  }

  if (!response.ok) {
    const detail = await response.text()
    throw new AppError(
      'LLM_HTTP_ERROR',
      `LLM 请求失败 (${response.status}): ${detail.slice(0, 240) || response.statusText}`,
      {
        endpoint: config.endpoint,
        requestUrl,
        provider: config.provider,
        modelName: config.modelName,
        phase: options?.phase ?? 'request',
        status: response.status,
        statusText: response.statusText,
        responseBody: detail,
      },
    )
  }

  try {
    const payload: unknown = await response.json()
    return payload
  } catch (error) {
    throw new AppError(
      'LLM_BAD_RESPONSE',
      `LLM 响应 JSON 解析失败: ${error instanceof Error ? error.message : '未知解析错误'}`,
      {
        endpoint: config.endpoint,
        requestUrl,
        provider: config.provider,
        modelName: config.modelName,
        phase: options?.phase ?? 'response_parse',
        cause: normalizeErrorDetails(error),
      },
    )
  }
}

export class OpenAICompatibleProvider {
  async discoverModels(config: ResolvedLLMConfig): Promise<LLMModelDescriptor[]> {
    const requestUrl = normalizeModelsEndpoint(config.endpoint)
    let response: Response

    try {
      response = await fetch(requestUrl, {
        method: 'GET',
        headers: buildHeaders(config),
      })
    } catch (error) {
      throw new AppError(
        'LLM_NETWORK_ERROR',
        `LLM 模型列表请求失败: ${error instanceof Error ? error.message : '未知网络错误'}`,
        {
          endpoint: config.endpoint,
          requestUrl,
          provider: config.provider,
          modelName: config.modelName,
          phase: 'model_discovery',
          cause: normalizeErrorDetails(error),
        },
      )
    }

    if (!response.ok) {
      const detail = await response.text()
      throw new AppError(
        'LLM_HTTP_ERROR',
        `LLM 模型列表请求失败 (${response.status}): ${detail.slice(0, 240) || response.statusText}`,
        {
          endpoint: config.endpoint,
          requestUrl,
          provider: config.provider,
          modelName: config.modelName,
          phase: 'model_discovery',
          status: response.status,
          statusText: response.statusText,
          responseBody: detail,
        },
      )
    }

    let payload: unknown
    try {
      payload = await response.json()
    } catch (error) {
      throw new AppError(
        'LLM_BAD_RESPONSE',
        `LLM 模型列表解析失败: ${error instanceof Error ? error.message : '未知解析错误'}`,
        {
          endpoint: config.endpoint,
          requestUrl,
          provider: config.provider,
          modelName: config.modelName,
          phase: 'model_discovery_parse',
          cause: normalizeErrorDetails(error),
        },
      )
    }

    if (!isRecord(payload) || !isUnknownArray(payload.data)) {
      throw new AppError('LLM_BAD_RESPONSE', 'LLM 模型列表格式错误。', {
        endpoint: config.endpoint,
        requestUrl,
        provider: config.provider,
        modelName: config.modelName,
        phase: 'model_discovery_parse',
        payload,
      })
    }

    return payload.data
      .flatMap((item) => {
        if (!isRecord(item) || typeof item.id !== 'string') {
          return []
        }

        return [{
          id: item.id,
          ownedBy: typeof item.owned_by === 'string' ? item.owned_by : null,
        }]
      })
      .sort((left, right) => left.id.localeCompare(right.id))
  }

  async completeJSON(input: ProviderCompletionInput): Promise<ProviderCompletionResult> {
    try {
      const payload = await performRequest(
        input.config,
        buildRequestBody(input, { includeResponseFormat: true }),
        { phase: 'response_format' },
      )

      const content = extractContent(payload).trim()
      if (content) {
        return {
          content,
          raw: payload,
        }
      }

      if (!isDeepSeek(input.config)) {
        throw new AppError('LLM_BAD_RESPONSE', 'LLM 返回了空 content。', {
          provider: input.config.provider,
          endpoint: input.config.endpoint,
          modelName: input.config.modelName,
          phase: 'response_format_empty_content',
          payload,
        })
      }

      const retryPayload = await performRequest(
        input.config,
        buildRequestBody(input, { includeResponseFormat: true, forceJsonHint: true }),
        { phase: 'response_format_retry_with_json_hint' },
      )

      const retryContent = extractContent(retryPayload).trim()
      if (!retryContent) {
        throw new AppError('LLM_BAD_RESPONSE', 'DeepSeek JSON 模式返回空 content。', {
          provider: input.config.provider,
          endpoint: input.config.endpoint,
          modelName: input.config.modelName,
          phase: 'response_format_retry_empty_content',
          payload: retryPayload,
        })
      }

      return {
        content: retryContent,
        raw: retryPayload,
      }
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== 'LLM_HTTP_ERROR') {
        throw error
      }

      const payload = await performRequest(
        input.config,
        buildRequestBody(input, {
          includeResponseFormat: false,
          forceJsonHint: true,
        }),
        {
          phase: 'fallback_without_response_format',
        },
      )

      return {
        content: extractContent(payload),
        raw: payload,
      }
    }
  }

  async testConnection(config: ResolvedLLMConfig): Promise<LLMConnectionTestResult> {
    const startedAt = Date.now()
    const availableModels = await this.discoverModels(config)
    const probeModel = chooseProbeModel(config, availableModels)

    if (!probeModel) {
      throw new AppError('LLM_MODEL_REQUIRED', '模型列表为空，无法完成连通性测试。')
    }

    const result = await this.completeJSON({
      config: {
        ...config,
        modelName: probeModel,
      },
      systemPrompt: 'Reply with one json object only. Output json and nothing else.',
      userPrompt: 'Return {"ping":"pong","ok":true} as json.',
    })

    return {
      ok: true,
      provider: config.provider,
      endpoint: config.endpoint,
      model: probeModel,
      latencyMs: Date.now() - startedAt,
      message: result.content,
      availableModels,
    }
  }
}
