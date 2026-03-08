export type PromptSourceType = 'NAI' | 'SD' | 'ComfyUI' | 'Unknown'

export interface DetectTypeResult {
  type: PromptSourceType
  confidence: number
  reasons: string[]
}

export interface PromptTag {
  text: string
  weight?: number
}

export interface ParsedNAIPrompt {
  type: 'NAI'
  prompt: string
  negativePrompt: string
  v4Prompt: Record<string, unknown> | null
  steps: number | null
  sampler: string | null
  scale: number | null
  seed: number | null
  width: number | null
  height: number | null
  model: string | null
  raw: Record<string, unknown>
}

export interface SDParameters {
  steps: number | null
  sampler: string | null
  cfgScale: number | null
  seed: number | null
  width: number | null
  height: number | null
  model: string | null
  clipSkip: number | null
  denoisingStrength: number | null
  hiresUpscale: number | null
  hiresSteps: number | null
  extras: Record<string, string>
}

export interface ParsedSDPrompt {
  type: 'SD'
  prompt: string
  negativePrompt: string
  loras: PromptTag[]
  embeddings: string[]
  parameters: SDParameters
  rawText: string
}

export type ComfyUIWorkflowFormat = 'api_prompt' | 'ui_workflow'

export interface ComfySamplerNode {
  nodeId: string
  steps: number | null
  cfg: number | null
  sampler: string | null
  scheduler: string | null
  seed: number | null
  denoise: number | null
}

export interface ParsedComfyUIPrompt {
  type: 'ComfyUI'
  format: ComfyUIWorkflowFormat
  nodeCount: number
  prompts: {
    positive: string[]
    negative: string[]
  }
  checkpoints: string[]
  loras: PromptTag[]
  samplers: ComfySamplerNode[]
  size: {
    width: number | null
    height: number | null
  }
  raw: Record<string, unknown>
}

export interface AitagImage {
  index: number
  aiJson: string
  promptText: string
  originalUrl: string
  localPath: string | null
}
// Force TS Language Server to refresh

export interface AitagWorkInfo {
  pixivId: string
  authorId: string
  title: string
  caption: string
  tags: string[]
  createDate: string | null
  totalView: number | null
  totalBookmarks: number | null
  sourceUrl: string
}

export interface AitagImportResult {
  detectedType: Exclude<PromptSourceType, 'Unknown'> | 'Unknown'
  work: AitagWorkInfo
  images: AitagImage[]
  entryId?: string
  raw: {
    work: Record<string, unknown>
    images: Record<string, unknown>[]
  }
}
