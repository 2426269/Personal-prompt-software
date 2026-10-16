export type NAIAction = 'generate' | 'img2img'

export interface NAIConnectionInput {
  apiKey: string
  baseUrl?: string
  timeoutMs?: number
}

export interface NAIConnectionResult {
  ok: boolean
  normalizedBaseUrl: string
  accountEmail: string | null
  tier: string | null
  perksUnlimitedImageGeneration: boolean | null
  trainingStepsLeft: number | null
}

export interface NAIImageSourceInput {
  localPath?: string | null
  dataUrl?: string | null
}

export interface NAIParameters {
  width: number
  height: number
  steps: number
  scale: number
  sampler: string
  seed?: number | null
  strength?: number | null
  noise?: number | null
  cfgRescale?: number | null
  sm?: boolean
  smDyn?: boolean
  qualityToggle?: boolean
}

export interface NAISubmitInput {
  connection: NAIConnectionInput
  prompt: string
  negativePrompt?: string
  model: string
  action: NAIAction
  parameters: NAIParameters
  referenceImage?: NAIImageSourceInput | null
  entryId?: string
  imageIndex?: number | null
  presetId?: string | null
}

export interface NAIGeneratedImage {
  index: number
  src: string
  localPath: string | null
  mimeType: string
}

export interface NAISubmitResult {
  requestId: string
  entryId: string | null
  imageIndex: number | null
  presetId: string | null
  action: NAIAction
  model: string
  status: 'completed'
  queuedAt: string
  completedAt: string
  elapsedMs: number
  normalizedBaseUrl: string
  images: NAIGeneratedImage[]
}
