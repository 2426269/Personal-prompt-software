import type { PromptSourceType } from './importer'

export type PromptPresetSyntaxMode = 'nai' | 'sd'

export interface PromptPresetReferenceImage {
  originalUrl: string | null
  localPath: string | null
}

export interface PromptPresetItem {
  id: string
  text: string
  weight: number | null
  note: string | null
}

export interface PromptPresetSection {
  key: string
  label: string
  items: PromptPresetItem[]
}

export interface PromptPresetSummary {
  id: string
  name: string
  sourceEntryId: string
  sourceAnalysisId: string | null
  sourceImageIndex: number
  sourceEntryTitle: string
  sourcePromptType: Exclude<PromptSourceType, 'Unknown'>
  referenceImage: PromptPresetReferenceImage
  defaultSyntaxMode: PromptPresetSyntaxMode
  positiveItemCount: number
  negativeItemCount: number
  createdAt: string
  updatedAt: string
}

export interface PromptPresetDetail extends PromptPresetSummary {
  positiveSections: PromptPresetSection[]
  negativeSections: PromptPresetSection[]
}

export interface PromptPresetSaveInput {
  id?: string
  name: string
  sourceEntryId: string
  sourceAnalysisId?: string | null
  sourceImageIndex: number
  sourceEntryTitle: string
  sourcePromptType: Exclude<PromptSourceType, 'Unknown'>
  referenceImage: PromptPresetReferenceImage
  defaultSyntaxMode: PromptPresetSyntaxMode
  positiveSections: PromptPresetSection[]
  negativeSections: PromptPresetSection[]
}
