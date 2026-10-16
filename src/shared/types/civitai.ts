import type { RemoteModelKind } from './remote'

export type CivitaiSearchSource = 'version_id' | 'hash' | 'name_guess'
export type CivitaiSearchConfidence = 'exact' | 'guessed'

export interface CivitaiConfigSummary {
  hasApiKey: boolean
  updatedAt: string | null
}

export interface CivitaiConfigInput {
  apiKey?: string | null
}

export interface CivitaiConfigTestResult {
  ok: boolean
  latencyMs: number
  message: string
}

export interface CivitaiSearchInput {
  kind: RemoteModelKind
  query?: string | null
  hash?: string | null
  modelId?: number | null
  modelVersionId?: number | null
  forceRefresh?: boolean
}

export interface CivitaiModelMatch {
  source: CivitaiSearchSource
  modelId: number
  modelVersionId: number | null
  name: string
  versionName: string | null
  modelType: string | null
  rating: number | null
  downloadUrl: string | null
  thumbnailUrl: string | null
  pageUrl: string
  confidence: CivitaiSearchConfidence
}
