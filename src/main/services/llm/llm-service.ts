import { AppError } from '@main/ipc/wrap-ipc'
import type {
  AnalysisCategory,
  AnalysisSettingsCommon,
  AnalysisTagItem,
  AnalyzeEntryInput,
  AnalyzeEntryResult,
  EntryAnalysisResult,
  LLMConnectionTestInput,
  LLMConnectionTestResult,
  LLMModelDescriptor,
  LLMModelConfigInput,
  LLMModelConfigSummary,
} from '@shared/types/llm'
import type { PromptTag } from '@shared/types/importer'
import type { PromptTemplateMode } from '@shared/types/template'

import {
  AnalyzedTemplatesRepository,
  type AnalyzedTemplateRow,
} from '../../db/repositories/analyzed-templates.repo'
import { EntriesRepository } from '../../db/repositories/entries.repo'
import { ImagesRepository } from '../../db/repositories/images.repo'
import {
  LLMModelConfigsRepository,
  type LLMModelConfigRow,
} from '../../db/repositories/llm-model-configs.repo'
import { PromptTemplatesRepository } from '../../db/repositories/prompt-templates.repo'
import { TagsRepository } from '../../db/repositories/tags.repo'
import { TemplatesService } from '../templates/templates.service'
import { writeStructuredLog } from '../../logging'
import {
  OpenAICompatibleProvider,
  type ResolvedLLMConfig,
} from './providers/openai-compatible-provider'

const CATEGORY_LABELS: Record<string, string> = {
  artist_tags: '画师串 / 作者风格',
  quality_tags: '质量词',
  lighting_tags: '光影词',
  style_tags: '风格词',
  composition_tags: '构图词',
  subject_tags: '主体设定',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseJsonObject<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function clampConfidence(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null
  }

  return Math.max(0, Math.min(1, value))
}

function normalizeWeight(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function normalizePromptTags(value: unknown): PromptTag[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return []
    }

    const nameCandidate = item.name
    const textCandidate = item.text
    const name = typeof nameCandidate === 'string'
      ? nameCandidate
      : typeof textCandidate === 'string'
        ? textCandidate
        : null

    if (!name) {
      return []
    }

    const weight = normalizeWeight(item.weight)
    return weight === null ? [{ text: name }] : [{ text: name, weight }]
  })
}

function roundWeight(value: number): number {
  return Number(value.toFixed(4))
}

function normalizePromptSnippet(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function extractExplicitWeightedTags(text: string): Array<{ text: string; weight: number; syntax: string }> {
  const results: Array<{ text: string; weight: number; syntax: string }> = []
  const regex = /\(([^()<>:\n][^()<>:\n]*?)\s*:\s*([-+]?[0-9]*\.?[0-9]+)\)/g

  for (const match of text.matchAll(regex)) {
    const snippet = normalizePromptSnippet(match[1] ?? '')
    const parsedWeight = Number(match[2])

    if (!snippet || !Number.isFinite(parsedWeight)) {
      continue
    }

    results.push({
      text: snippet,
      weight: roundWeight(parsedWeight),
      syntax: 'explicit_parentheses',
    })
  }

  return results
}

function extractLoraWeightHints(text: string): Array<{ text: string; weight: number; syntax: string }> {
  const results: Array<{ text: string; weight: number; syntax: string }> = []
  const regex = /<lora:([^:>]+)(?::([-+]?[0-9]*\.?[0-9]+))?>/gi

  for (const match of text.matchAll(regex)) {
    const snippet = normalizePromptSnippet(match[1] ?? '')
    const parsedWeight = Number(match[2] ?? '1')

    if (!snippet || !Number.isFinite(parsedWeight)) {
      continue
    }

    results.push({
      text: snippet,
      weight: roundWeight(parsedWeight),
      syntax: 'lora',
    })
  }

  return results
}

function extractNAIWeightHints(text: string): Array<{ text: string; weight: number; syntax: string }> {
  const results: Array<{ text: string; weight: number; syntax: string }> = []
  const increaseRegex = /(\{+)([^{}[\]\n][^{}[\]\n]*?)(\}+)/g
  const decreaseRegex = /(\[+)([^[\]{}\n][^[\]{}\n]*?)(\]+)/g

  for (const match of text.matchAll(increaseRegex)) {
    const pairs = Math.min(match[1]?.length ?? 0, match[3]?.length ?? 0)
    const snippet = normalizePromptSnippet(match[2] ?? '')
    if (!snippet || pairs <= 0) {
      continue
    }

    results.push({
      text: snippet,
      weight: roundWeight(Math.pow(1.05, pairs)),
      syntax: 'nai_braces',
    })
  }

  for (const match of text.matchAll(decreaseRegex)) {
    const pairs = Math.min(match[1]?.length ?? 0, match[3]?.length ?? 0)
    const snippet = normalizePromptSnippet(match[2] ?? '')
    if (!snippet || pairs <= 0) {
      continue
    }

    results.push({
      text: snippet,
      weight: roundWeight(Math.pow(1 / 1.05, pairs)),
      syntax: 'nai_brackets',
    })
  }

  return results
}

function buildPromptWeightHints(promptText: string): Array<{ text: string; weight: number; syntax: string }> {
  if (!promptText.trim()) {
    return []
  }

  const combined = [
    ...extractExplicitWeightedTags(promptText),
    ...extractLoraWeightHints(promptText),
    ...extractNAIWeightHints(promptText),
  ]

  const deduped = new Map<string, { text: string; weight: number; syntax: string }>()
  for (const item of combined) {
    const key = `${item.syntax}:${item.text.toLowerCase()}`
    if (!deduped.has(key)) {
      deduped.set(key, item)
    }
  }

  return [...deduped.values()]
}

function normalizeAnalysisItems(value: unknown): AnalysisTagItem[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((item) => {
    if (typeof item === 'string') {
      return [{
        text: item,
        weight: null,
        enabled: true,
        note: null,
        source: 'llm',
        confidence: 0.7,
      }]
    }

    if (!isRecord(item)) {
      return []
    }

    const text = item.text
    if (typeof text !== 'string') {
      return []
    }

    return [{
      text,
      weight: normalizeWeight(item.weight),
      enabled: item.enabled !== false,
      note: typeof item.note === 'string' ? item.note : null,
      source: item.manual === true ? 'manual' : 'llm',
      confidence: clampConfidence(item.confidence) ?? 0.6,
    }]
  })
}

function stripCodeFence(value: string): string {
  return value.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim()
}

function extractJsonObject(value: string): string {
  const stripped = stripCodeFence(value)
  const start = stripped.indexOf('{')
  const end = stripped.lastIndexOf('}')

  if (start === -1 || end === -1 || end <= start) {
    throw new AppError('LLM_JSON_PARSE_FAILED', 'LLM 未返回有效 JSON 对象。')
  }

  return stripped.slice(start, end + 1)
}

function normalizeAnalysisResponse(payload: unknown): {
  categories: AnalysisCategory[]
  removedSpecific: string[]
  settingsCommon: AnalysisSettingsCommon
  customCategories: Record<string, AnalysisTagItem[]>
} {
  if (!isRecord(payload)) {
    throw new AppError('LLM_JSON_PARSE_FAILED', 'LLM JSON 响应为空或格式错误。')
  }

  const categorySource = payload.categories
  let categories: AnalysisCategory[] = []

  if (Array.isArray(categorySource)) {
    categories = categorySource.flatMap((item) => {
      if (!isRecord(item) || typeof item.key !== 'string') {
        return []
      }

      const key = item.key
      const label = typeof item.label === 'string' ? item.label : CATEGORY_LABELS[key] ?? key
      return [{
        key,
        label,
        items: normalizeAnalysisItems(item.items),
      }]
    })
  } else if (isRecord(categorySource)) {
    categories = Object.entries(categorySource).map(([key, value]) => ({
      key,
      label: CATEGORY_LABELS[key] ?? key,
      items: normalizeAnalysisItems(value),
    }))
  } else {
    categories = Object.entries(CATEGORY_LABELS)
      .map(([key, label]) => ({ key, label, items: normalizeAnalysisItems(payload[key]) }))
      .filter((category) => category.items.length > 0)
  }

  const settingsSource = isRecord(payload.settings_common)
    ? payload.settings_common
    : isRecord(payload.settings)
      ? payload.settings
      : {}

  const customCategories = isRecord(payload.custom_categories)
    ? Object.fromEntries(
        Object.entries(payload.custom_categories).map(([key, value]) => [key, normalizeAnalysisItems(value)]),
      )
    : {}

  return {
    categories,
    removedSpecific: normalizeStringArray(payload.removed_specific ?? payload.removedSpecific),
    settingsCommon: {
      model: typeof settingsSource.model === 'string' ? settingsSource.model : null,
      sampler: typeof settingsSource.sampler === 'string' ? settingsSource.sampler : null,
      steps: typeof settingsSource.steps === 'number' ? settingsSource.steps : null,
      cfg:
        typeof settingsSource.cfg === 'number'
          ? settingsSource.cfg
          : typeof settingsSource.cfgScale === 'number'
            ? settingsSource.cfgScale
            : null,
      seed: typeof settingsSource.seed === 'number' ? settingsSource.seed : null,
      width: typeof settingsSource.width === 'number' ? settingsSource.width : null,
      height: typeof settingsSource.height === 'number' ? settingsSource.height : null,
      loras: normalizePromptTags(settingsSource.loras),
    },
    customCategories,
  }
}

function stripRawImageWorkflowFields(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null
  }

  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !['ai_json', 'prompt_text', 'aiJson', 'promptText'].includes(key)),
  )
}

function shouldStripAiJsonPromptField(path: string[], key: string): boolean {
  if (['parameters', 'positive_prompt', 'negative_prompt', 'uc', 'v4_prompt', 'v4_negative_prompt'].includes(key)) {
    return true
  }

  const isRootField = path.length === 0
  const isCommentField = path.length === 1 && path[0] === 'comment'

  if ((isRootField || isCommentField) && ['prompt', 'positive', 'negative'].includes(key)) {
    return true
  }

  return false
}

function stripPromptFieldsFromAiJsonValue(value: unknown, path: string[] = []): unknown {
  if (Array.isArray(value)) {
    return value.map((item, index) => stripPromptFieldsFromAiJsonValue(item, [...path, String(index)]))
  }

  if (!isRecord(value)) {
    return value
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !shouldStripAiJsonPromptField(path, key))
      .map(([key, nestedValue]) => [key, stripPromptFieldsFromAiJsonValue(nestedValue, [...path, key])]),
  )
}

function sanitizeAiJsonForPromptPayload(aiJson: string, promptText: string): string {
  if (!promptText.trim() || !aiJson.trim()) {
    return aiJson
  }

  try {
    const parsed = JSON.parse(aiJson) as unknown
    const sanitized = stripPromptFieldsFromAiJsonValue(parsed)
    return JSON.stringify(sanitized, null, 2)
  } catch {
    return aiJson
  }
}

function findRawImageByIndex(rawPayload: unknown, imageIndex: number, fallbackPosition: number): Record<string, unknown> | null {
  if (!isRecord(rawPayload) || !Array.isArray(rawPayload.images)) {
    return null
  }

  const rawImages = rawPayload.images as unknown[]
  const matched = rawImages.find((item) => {
    if (!isRecord(item)) {
      return false
    }

    const rawIndex = item.index
    return typeof rawIndex === 'number' && rawIndex === imageIndex
  }) ?? rawImages[fallbackPosition]

  return stripRawImageWorkflowFields(matched)
}

function buildImagePayload(
  image: { index: number; promptText: string; aiJson: string },
): {
  index: number
  promptText: string
  aiJson: string
  weightHints: Array<{ text: string; weight: number; syntax: string }>
} {
  const sanitizedAiJson = sanitizeAiJsonForPromptPayload(image.aiJson, image.promptText)

  return {
    index: image.index,
    promptText: image.promptText,
    aiJson: sanitizedAiJson,
    weightHints: buildPromptWeightHints(`${image.promptText}\n${sanitizedAiJson}`),
  }
}

function buildImagesPayload(
  images: Array<{ index: number; promptText: string; aiJson: string }>,
): Array<{
  index: number
  promptText: string
  aiJson: string
  weightHints: Array<{ text: string; weight: number; syntax: string }>
}> {
  return images.map((image) => buildImagePayload(image))
}

export class LLMService {
  constructor(
    private readonly entriesRepository = new EntriesRepository(),
    private readonly imagesRepository = new ImagesRepository(),
    private readonly tagsRepository = new TagsRepository(),
    private readonly templatesService = new TemplatesService(new PromptTemplatesRepository()),
    private readonly modelConfigsRepository = new LLMModelConfigsRepository(),
    private readonly analyzedTemplatesRepository = new AnalyzedTemplatesRepository(),
    private readonly provider = new OpenAICompatibleProvider(),
  ) {}

  listConfigs(): LLMModelConfigSummary[] {
    return this.modelConfigsRepository.list().map((row) => this.toConfigSummary(row))
  }

  saveConfig(input: LLMModelConfigInput): LLMModelConfigSummary {
    if (!input.endpoint.trim()) {
      throw new AppError('LLM_ENDPOINT_REQUIRED', 'LLM endpoint 不能为空。')
    }

    if (!input.modelName.trim()) {
      throw new AppError('LLM_MODEL_REQUIRED', '请先测试连接并选择一个可用模型。')
    }

    if (input.advanced.maxTokens != null && input.advanced.maxTokens <= 0) {
      throw new AppError('LLM_MAX_TOKENS_INVALID', 'max_tokens 必须大于 0。')
    }

    const id = this.modelConfigsRepository.upsert(input)
    const row = this.modelConfigsRepository.getById(id)
    if (!row) {
      throw new AppError('LLM_CONFIG_SAVE_FAILED', 'LLM 模型配置保存失败。')
    }

    return this.toConfigSummary(row)
  }

  deleteConfig(id: string): boolean {
    return this.modelConfigsRepository.delete(id)
  }

  async testConnection(input: LLMConnectionTestInput): Promise<LLMConnectionTestResult> {
    const config = input.config
      ? this.resolveTransientConfig(input.config, input.configId ?? input.config.id ?? null, { requireModel: false })
      : this.resolveConfig(input.configId ?? null)

    try {
      const result = await this.provider.testConnection(config)
      writeStructuredLog({
        module: 'llm',
        level: 'info',
        action: 'config.test',
        summary: `LLM 连通测试成功：${config.provider}:${result.model}`,
        request: {
          endpoint: config.endpoint,
          provider: config.provider,
          modelName: result.model,
        },
        response: result,
      })
      return result
    } catch (error) {
      writeStructuredLog({
        module: 'llm',
        level: 'error',
        action: 'config.test',
        summary: `LLM 连通测试失败：${config.provider}:${config.modelName}`,
        request: {
          endpoint: config.endpoint,
          provider: config.provider,
          modelName: config.modelName,
        },
        error,
      })
      throw error
    }
  }

  async discoverModels(input: LLMConnectionTestInput): Promise<LLMModelDescriptor[]> {
    const config = input.config
      ? this.resolveTransientConfig(input.config, input.configId ?? input.config.id ?? null, { requireModel: false })
      : this.resolveConfig(input.configId ?? null)

    return this.provider.discoverModels(config)
  }

  async analyzeEntry(input: AnalyzeEntryInput): Promise<AnalyzeEntryResult> {
    const entry = this.entriesRepository.getById(input.entryId)
    if (!entry) {
      throw new AppError('ENTRY_NOT_FOUND', '待分析条目不存在。')
    }

    const allImages = this.imagesRepository.listByEntryId(input.entryId)
    const images =
      input.imageIndex == null
        ? allImages
        : allImages.filter((image) => image.index === input.imageIndex)

    if (input.imageIndex != null && images.length === 0) {
      throw new AppError('ENTRY_IMAGE_NOT_FOUND', '指定的图片索引不存在，无法执行单图分析。')
    }

    const userTags = this.tagsRepository.getByEntryId(input.entryId).map((tag) => tag.name)
    const template = input.templateId ? this.templatesService.get(input.templateId) : this.templatesService.getDefault()
    if (!template) {
      throw new AppError('TEMPLATE_NOT_FOUND', '分析模板不存在。')
    }

    const config = this.resolveConfig(input.configId ?? null)
    const mode: PromptTemplateMode = 'full'
    const parsedRaw = parseJsonObject<Record<string, unknown> | null>(entry.raw_json, null)
    const promptPayloads = buildImagesPayload(images)
    const currentImagePayload = promptPayloads[0] ?? null
    const rawPayload = JSON.stringify(
      {
        entry: {
          id: entry.id,
          title: entry.title,
          customName: entry.custom_name,
          caption: entry.caption,
          type: entry.type,
          sourceTags: parseJsonObject<string[]>(entry.tags, []),
          userTags,
          sourceUrl: entry.source_url,
          postDate: entry.post_date,
          views: entry.views,
          bookmarks: entry.bookmarks,
        },
        analysisTarget: {
          mode: input.imageIndex == null ? 'entry' : 'single_image',
          imageIndex: input.imageIndex ?? null,
        },
        rawContext: {
          work: parsedRaw && isRecord(parsedRaw.work) ? parsedRaw.work : null,
        },
        currentImage:
          currentImagePayload == null
            ? null
            : {
                ...findRawImageByIndex(parsedRaw, currentImagePayload.index, 0),
                index: currentImagePayload.index,
                promptText: currentImagePayload.promptText,
                aiJson: currentImagePayload.aiJson,
                weightHints: currentImagePayload.weightHints,
              },
      },
      null,
      2,
    )
    const userPayload = rawPayload
    writeStructuredLog({
      module: 'llm',
      level: 'info',
      action: 'analyze.request',
      summary: `开始分析条目 ${input.entryId}${input.imageIndex != null ? ` 图片 #${input.imageIndex + 1}` : ''}`,
      entryId: input.entryId,
      imageIndex: input.imageIndex ?? null,
      request: {
        config: {
          id: config.id,
          name: config.name,
          provider: config.provider,
          endpoint: config.endpoint,
          modelName: config.modelName,
        },
        template: {
          id: template.id,
          name: template.name,
        },
        payloadStats: {
          charLength: userPayload.length,
          selectedImageCount: promptPayloads.length,
          hasRawWork: parsedRaw && isRecord(parsedRaw.work),
        },
        systemPrompt: template.systemPrompt,
        userPayload,
      },
    })

    try {
      const completion = await this.provider.completeJSON({
        config,
        systemPrompt: template.systemPrompt,
        userPrompt: userPayload,
      })

      const parsedResponse: unknown = JSON.parse(extractJsonObject(completion.content))
      const normalized = normalizeAnalysisResponse(parsedResponse)
      this.analyzedTemplatesRepository.save({
        entryId: input.entryId,
        imageIndex: input.imageIndex ?? null,
        templateId: template.id,
        configId: config.id,
        categories: normalized.categories,
        removedSpecific: normalized.removedSpecific,
        settingsCommon: normalized.settingsCommon,
        customCategories: normalized.customCategories,
        aiModelUsed: `${config.provider}:${config.modelName}`,
        nsfwMode: mode,
        promptType: entry.type,
        rawResponse: completion.content,
        sanitizedPayload: userPayload,
      })

      const saved = this.analyzedTemplatesRepository.getByEntryIdAndImageIndex(input.entryId, input.imageIndex ?? null)
      if (!saved) {
        throw new AppError('ANALYSIS_SAVE_FAILED', '分析结果已生成但落库失败。')
      }

      const result = {
        analysis: this.toAnalysisResult(saved, template.name),
        template: {
          id: template.id,
          name: template.name,
        },
        config: {
          id: config.id,
          name: config.name,
        },
      }

      writeStructuredLog({
        module: 'llm',
        level: 'info',
        action: 'analyze.response',
        summary: `分析完成：条目 ${input.entryId}${input.imageIndex != null ? ` 图片 #${input.imageIndex + 1}` : ''}`,
        entryId: input.entryId,
        imageIndex: input.imageIndex ?? null,
        response: {
          rawResponse: completion.content,
          analysis: result.analysis,
        },
      })

      return result
    } catch (error) {
      writeStructuredLog({
        module: 'llm',
        level: 'error',
        action: 'analyze.error',
        summary: `分析失败：条目 ${input.entryId}${input.imageIndex != null ? ` 图片 #${input.imageIndex + 1}` : ''}`,
        entryId: input.entryId,
        imageIndex: input.imageIndex ?? null,
        request: {
          config: {
            id: config.id,
            name: config.name,
            provider: config.provider,
            endpoint: config.endpoint,
            modelName: config.modelName,
          },
          template: {
            id: template.id,
            name: template.name,
          },
          payloadStats: {
            charLength: userPayload.length,
            selectedImageCount: promptPayloads.length,
            hasRawWork: parsedRaw && isRecord(parsedRaw.work),
          },
          systemPrompt: template.systemPrompt,
          userPayload,
        },
        error,
      })
      throw error
    }
  }

  getAnalysisForEntry(entryId: string): EntryAnalysisResult | null {
    const row = this.analyzedTemplatesRepository.getByEntryId(entryId)
    if (!row) {
      return null
    }

    const templateName = row.template_id
      ? this.templatesService.get(row.template_id)?.name ?? null
      : null

    return this.toAnalysisResult(row, templateName)
  }

  listAnalysesForEntry(entryId: string): EntryAnalysisResult[] {
    return this.analyzedTemplatesRepository.listByEntryId(entryId).map((row) => {
      const templateName = row.template_id
        ? this.templatesService.get(row.template_id)?.name ?? null
        : null

      return this.toAnalysisResult(row, templateName)
    })
  }

  private resolveTransientConfig(
    input: LLMModelConfigInput,
    fallbackConfigId: string | null = null,
    options?: { requireModel?: boolean },
  ): ResolvedLLMConfig {
    if (!input.endpoint.trim()) {
      throw new AppError('LLM_ENDPOINT_REQUIRED', 'LLM endpoint 不能为空。')
    }

    if ((options?.requireModel ?? true) && !input.modelName.trim()) {
      throw new AppError('LLM_MODEL_REQUIRED', 'LLM 模型名不能为空。')
    }

    const savedRow = fallbackConfigId ? this.modelConfigsRepository.getById(fallbackConfigId) : null
    const savedApiKey = savedRow ? this.modelConfigsRepository.getApiKey(savedRow.id) : null
    const resolvedApiKey = input.apiKey === undefined ? savedApiKey : (input.apiKey ?? null)

    if (!resolvedApiKey && input.provider !== 'ollama') {
      throw new AppError('LLM_API_KEY_REQUIRED', '该模型配置需要 API Key。')
    }

    return {
      id: fallbackConfigId ?? input.id ?? 'transient',
      name: input.name,
      provider: input.provider,
      endpoint: input.endpoint,
      apiKey: resolvedApiKey,
      modelName: input.modelName,
      temperature: input.temperature,
      maxTokens: input.advanced.maxTokens,
      strictJsonMode: input.advanced.strictJsonMode,
      thinkingEnabled: input.advanced.thinkingEnabled,
    }
  }

  private resolveConfig(configId: string | null): ResolvedLLMConfig {
    const row = configId ? this.modelConfigsRepository.getById(configId) : this.modelConfigsRepository.getDefault()
    if (!row) {
      throw new AppError('LLM_CONFIG_NOT_FOUND', '未找到可用的 LLM 模型配置。')
    }

    const apiKey = this.modelConfigsRepository.getApiKey(row.id)
    if (!apiKey && row.provider !== 'ollama') {
      throw new AppError('LLM_API_KEY_REQUIRED', '当前模型配置缺少 API Key。')
    }

    return {
      id: row.id,
      name: row.name,
      provider: row.provider,
      endpoint: row.endpoint,
      apiKey,
      modelName: row.model_name,
      temperature: row.temperature,
      maxTokens: row.max_tokens,
      strictJsonMode: row.strict_json_mode === 1,
      thinkingEnabled: row.thinking_enabled === 1,
    }
  }

  private toConfigSummary(row: LLMModelConfigRow): LLMModelConfigSummary {
    return {
      id: row.id,
      name: row.name,
      provider: row.provider,
      endpoint: row.endpoint,
      modelName: row.model_name,
      temperature: row.temperature,
      advanced: {
        maxTokens: row.max_tokens,
        strictJsonMode: row.strict_json_mode === 1,
        thinkingEnabled: row.thinking_enabled === 1,
      },
      isDefault: row.is_default === 1,
      hasApiKey: !!row.api_key_encrypted && row.api_key_encrypted.length > 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  private toAnalysisResult(row: AnalyzedTemplateRow, templateName: string | null): EntryAnalysisResult {
    return {
      id: row.id,
      entryId: row.entry_id,
      imageIndex: row.image_index,
      templateId: row.template_id,
      configId: row.config_id,
      templateName,
      nsfwMode: row.nsfw_mode,
      promptType: row.prompt_type,
      categories: parseJsonObject<AnalysisCategory[]>(row.template_json, []),
      removedSpecific: parseJsonObject<string[]>(row.removed_specific, []),
      settingsCommon: parseJsonObject<AnalysisSettingsCommon>(row.settings_common, {
        model: null,
        sampler: null,
        steps: null,
        cfg: null,
        seed: null,
        width: null,
        height: null,
        loras: [],
      }),
      customCategories: parseJsonObject<Record<string, AnalysisTagItem[]>>(row.custom_categories, {}),
      aiModelUsed: row.ai_model_used,
      rawResponse: row.raw_response,
      sanitizedPayload: row.sanitized_payload,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }
}

