import type { PromptModelReference } from './importer'

export type RemoteModelKind = 'lora' | 'checkpoint' | 'vae'
export type RemoteModelMatchType = 'exact_version' | 'exact_hash' | 'name_guess' | 'none'

export interface RemoteProfileSummary {
  id: string
  name: string
  comfyBaseUrl: string
  comfyHistoryRoute: string
  sshHost: string | null
  sshPort: number
  sshUser: string | null
  comfyRootPath: string | null
  lorasPaths: string[]
  hasPassword: boolean
  isDefault: boolean
  indexedFileCount: number
  indexedLoraCount: number
  indexedCheckpointCount: number
  lastSyncedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface RemoteProfileInput {
  id?: string
  name: string
  comfyBaseUrl: string
  comfyHistoryRoute?: string
  sshHost?: string | null
  sshPort: number
  sshUser?: string | null
  sshPassword?: string | null
  comfyRootPath?: string | null
  lorasPaths: string[]
  isDefault?: boolean
}

export interface RemoteModelIndexItem {
  profileId: string
  kind: RemoteModelKind
  filename: string
  stem: string
  path: string
  fileSize: number | null
  modifiedAt: number | null
  sha256: string | null
  civitaiModelId: number | null
  civitaiModelVersionId: number | null
  lastIndexedAt: string | null
}

export type RemoteLoraIndexItem = RemoteModelIndexItem

export interface RemoteModelScanInput {
  profileId: string
}

export interface RemoteModelScanResult {
  profileId: string
  scannedCount: number
  scannedAt: string
  counts: Record<RemoteModelKind, number>
}

export type RemoteModelScanPhase = 'discovering' | 'hashing' | 'done'

export interface RemoteModelScanProgress {
  profileId: string
  phase: RemoteModelScanPhase
  processed: number
  total: number
  currentPath: string | null
}

export type RemoteLoraScanInput = RemoteModelScanInput
export type RemoteLoraScanResult = RemoteModelScanResult

export interface EntryRemoteModelMatch {
  model: PromptModelReference
  kind: RemoteModelKind
  exists: boolean
  matchedPath: string | null
  matchedHash: string | null
  matchType: RemoteModelMatchType
}

export interface EntryRemoteModelCheck {
  profileId: string
  profileName: string
  kind: RemoteModelKind
  isScanned: boolean
  items: EntryRemoteModelMatch[]
}

export type EntryLoraRemoteMatch = EntryRemoteModelMatch
export type EntryRemoteLoraCheck = EntryRemoteModelCheck
