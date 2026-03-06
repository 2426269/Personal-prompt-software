export type PromptTemplateMode = 'sanitize' | 'full'
export type PromptTemplateItemSource = 'system' | 'llm' | 'manual'

export interface PromptTemplateItem {
  id: string
  text: string
  weight: number | null
  enabled: boolean
  note: string | null
  source: PromptTemplateItemSource
  confidence: number | null
}

export interface PromptTemplateCategory {
  id: string
  name: string
  enabled: boolean
  note: string | null
  items: PromptTemplateItem[]
}

export interface PromptTemplate {
  id: string
  name: string
  description: string | null
  systemPrompt: string
  templateJson: PromptTemplateCategory[]
  mode: PromptTemplateMode
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface PromptTemplateInput {
  id?: string
  name: string
  description?: string | null
  systemPrompt: string
  templateJson?: PromptTemplateCategory[]
  mode?: PromptTemplateMode
  isDefault?: boolean
}
