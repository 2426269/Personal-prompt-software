import type { PromptSourceType, PromptTag } from './importer'
import type { PromptTemplateMode } from './template'

export type LLMProvider = 'openai' | 'deepseek' | 'qwen' | 'glm' | 'ollama'
export type AnalysisItemSource = 'llm' | 'manual'

export interface LLMModelConfigSummary {
  id: string
  name: string
  provider: LLMProvider
  endpoint: string
  modelName: string
  temperature: number
  isDefault: boolean
  hasApiKey: boolean
  createdAt: string
  updatedAt: string
}

export interface LLMModelConfigInput {
  id?: string
  name: string
  provider: LLMProvider
  endpoint: string
  apiKey?: string | null
  modelName: string
  temperature: number
  isDefault?: boolean
}

export interface LLMConnectionTestInput {
  configId?: string | null
  config?: LLMModelConfigInput
}

export interface LLMConnectionTestResult {
  ok: boolean
  provider: LLMProvider
  endpoint: string
  model: string
  latencyMs: number
  message: string
}

export interface AnalysisTagItem {
  text: string
  weight: number | null
  enabled: boolean
  note: string | null
  source: AnalysisItemSource
  confidence: number | null
}

export interface AnalysisCategory {
  key: string
  label: string
  items: AnalysisTagItem[]
}

export interface AnalysisSettingsCommon {
  model: string | null
  sampler: string | null
  steps: number | null
  cfg: number | null
  seed: number | null
  width: number | null
  height: number | null
  loras: PromptTag[]
}

export interface EntryAnalysisResult {
  id: string
  entryId: string
  templateId: string | null
  configId: string | null
  templateName: string | null
  nsfwMode: PromptTemplateMode
  promptType: Exclude<PromptSourceType, 'Unknown'>
  categories: AnalysisCategory[]
  removedSpecific: string[]
  settingsCommon: AnalysisSettingsCommon
  customCategories: Record<string, AnalysisTagItem[]>
  aiModelUsed: string | null
  rawResponse: string | null
  sanitizedPayload: string | null
  createdAt: string
  updatedAt: string
}

export interface AnalyzeEntryInput {
  entryId: string
  configId?: string | null
  templateId?: string | null
  mode?: PromptTemplateMode
}

export interface AnalyzeEntryResult {
  analysis: EntryAnalysisResult
  template: {
    id: string | null
    name: string | null
  }
  config: {
    id: string | null
    name: string | null
  }
}
