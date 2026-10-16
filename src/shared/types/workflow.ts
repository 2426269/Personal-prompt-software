import type { ComfyUIWorkflowFormat } from './importer'

export type WorkflowSlotType =
  | 'positive_prompt'
  | 'negative_prompt'
  | 'sampler'
  | 'checkpoint'
  | 'lora'
  | 'load_image'

export type WorkflowExportType = 'original' | 'clean' | 'api_prompt' | 'slot_map'
export type WorkflowBindingTarget = 'original' | 'clean' | 'preferred_test' | 'all'
export type WorkflowRunnableSource = 'clean_json' | 'api_prompt_json' | 'original_json' | null

export interface WorkflowSlotMapItem {
  nodeId: string
  classType: string
  slotType: WorkflowSlotType
  path: string
  currentValue: unknown
  title?: string | null
  editableKeys?: string[]
  widgetIndexes?: Record<string, number>
}

export interface WorkflowCleanRules {
  clearPrompts?: boolean
  placeholderPositive?: string
  placeholderNegative?: string
  randomizeSeed?: boolean
  clearLoadImages?: boolean
  stripUiMetadata?: boolean
  anonymizePaths?: boolean
  removeNoteNodes?: boolean
}

export interface WorkflowBinding {
  entryId: string
  originalWorkflowId: string | null
  cleanWorkflowId: string | null
  preferredTestWorkflowId: string | null
  updatedAt: string
}

export interface WorkflowSummary {
  id: string
  name: string
  tags: string[]
  notes: string | null
  format: ComfyUIWorkflowFormat
  nodeCount: number
  derivedFromEntryId: string | null
  isDefaultTest: boolean
  runnable: boolean
  runnableSource: WorkflowRunnableSource
  nonRunnableReason: string | null
  createdAt: string
  updatedAt: string
}

export interface WorkflowDetail extends WorkflowSummary {
  originalJson: string
  cleanJson: string | null
  apiPromptJson: string | null
  slotMap: WorkflowSlotMapItem[]
}

export interface WorkflowListParams {
  derivedFromEntryId?: string
}

export interface WorkflowCleanInput {
  workflowId?: string
  workflowJson?: string | Record<string, unknown>
  rules?: WorkflowCleanRules
}

export interface WorkflowCleanResult {
  format: ComfyUIWorkflowFormat
  nodeCount: number
  workflowJson: string
  slotMap: WorkflowSlotMapItem[]
  runnable: boolean
  runnableSource: WorkflowRunnableSource
  nonRunnableReason: string | null
}

export interface WorkflowSetDefaultInput {
  workflowId: string
  isDefault: boolean
}

export interface WorkflowExportInput {
  workflowId: string
  type: WorkflowExportType
}

export interface WorkflowBindInput {
  entryId: string
  workflowId: string
  target?: WorkflowBindingTarget
}

export interface WorkflowUnbindInput {
  entryId: string
  target?: WorkflowBindingTarget
}

export interface WorkflowSlotMapGuessInput {
  workflowJson: string | Record<string, unknown>
}

export interface WorkflowSlotMapSaveInput {
  workflowId: string
  slotMap: WorkflowSlotMapItem[]
}

export interface WorkflowRefreshInput {
  workflowId: string
  rules?: WorkflowCleanRules
}
