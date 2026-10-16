export interface ComfyConnectionInput {
  baseUrl: string
  historyRoute?: string
  clientId?: string
  timeoutMs?: number
}

export interface ComfyConnectionResult {
  ok: boolean
  normalizedBaseUrl: string
  historyRoute: string
  queueRunning: number
  queuePending: number
  system: {
    os: string | null
    comfyuiVersion: string | null
    pythonVersion: string | null
  }
  device: {
    name: string | null
    type: string | null
    vramTotal: number | null
    vramFree: number | null
  } | null
}

export interface ComfyPromptOverrides {
  positivePrompt: string
  negativePrompt?: string
  seed?: number | null
  steps?: number | null
  cfg?: number | null
  samplerName?: string | null
  scheduler?: string | null
  denoise?: number | null
  checkpoint?: string | null
}

export interface ComfyTransientWorkflowInput {
  name?: string
  workflowJson: string | Record<string, unknown>
  runnableWorkflowJson?: string | Record<string, unknown> | null
}

export interface ComfySubmitInput {
  connection: ComfyConnectionInput
  workflowId?: string
  entryId?: string
  imageIndex?: number | null
  transientWorkflow?: ComfyTransientWorkflowInput
  overrides: ComfyPromptOverrides
}

export interface ComfySubmitResult {
  promptId: string
  clientId: string
  workflowId: string | null
  entryId: string | null
  imageIndex: number | null
  status: 'queued'
  queuedAt: string
  normalizedBaseUrl: string
}

export interface ComfyGeneratedImage {
  nodeId: string
  filename: string
  subfolder: string
  type: string
  url: string
}

export type ComfyQueueState = 'queued' | 'running' | 'completed' | 'failed' | 'not_found'

export interface ComfyQueueStatusInput {
  connection: ComfyConnectionInput
  promptId: string
}

export interface ComfyQueueStatusResult {
  promptId: string
  state: ComfyQueueState
  queueRunning: number
  queuePending: number
  completed: boolean
  images: ComfyGeneratedImage[]
  errorMessage: string | null
  normalizedBaseUrl: string
}

export interface ComfyCancelInput {
  connection: ComfyConnectionInput
  promptId?: string
}

export interface ComfyCancelResult {
  interrupted: boolean
  promptId: string | null
}
