import type { AitagImage, PromptModelReference, PromptTag } from './importer'
import type { EntryAnalysisResult } from './llm'
import type { EntryRemoteModelCheck } from './remote'
import type { UserTag } from './tag'
import type { WorkflowBinding } from './workflow'

export type EntrySortBy = 'created_at' | 'updated_at' | 'post_date' | 'bookmarks' | 'views'
export type EntrySortOrder = 'asc' | 'desc'
export type EntryDeleteMode = 'soft' | 'hard'
export type EntryFilterType = 'all' | 'NAI' | 'SD' | 'ComfyUI'
export type EntrySearchMode = 'basic' | 'metadata'

export interface EntryListParams {
  page: number
  pageSize: number
  sortBy: EntrySortBy
  sortOrder: EntrySortOrder
  type?: EntryFilterType
  searchMode?: EntrySearchMode
  searchQuery?: string
  includeDeleted?: boolean
  favoritesOnly?: boolean
}

export interface EntryListItem {
  id: string
  pixivId: string | null
  authorId: string | null
  authorName: string | null
  title: string
  customName: string | null
  displayTitle: string
  caption: string
  type: 'NAI' | 'SD' | 'ComfyUI'
  sourceUrl: string | null
  postDate: string | null
  views: number
  bookmarks: number
  isFavorited: boolean
  tags: string[]
  userTags: string[]
  imageCount: number
  coverImage: AitagImage | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface EntryListResult {
  items: EntryListItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface EntryImageDetail extends AitagImage {
  parsedLoras: PromptTag[]
  parsedCheckpoints: PromptModelReference[]
  remoteLoraCheck: EntryRemoteModelCheck | null
  remoteCheckpointCheck: EntryRemoteModelCheck | null
}

export interface EntryDetail {
  id: string
  pixivId: string | null
  authorId: string | null
  authorName: string | null
  title: string
  customName: string | null
  displayTitle: string
  caption: string
  type: 'NAI' | 'SD' | 'ComfyUI'
  sourceUrl: string | null
  postDate: string | null
  views: number
  bookmarks: number
  isFavorited: boolean
  sourceTags: string[]
  userTags: string[]
  userTagRecords: UserTag[]
  loras: PromptTag[]
  checkpoints: PromptModelReference[]
  rawJson: string
  images: EntryImageDetail[]
  analysis: EntryAnalysisResult | null
  analyses: EntryAnalysisResult[]
  remoteLoraCheck: EntryRemoteModelCheck | null
  remoteCheckpointCheck: EntryRemoteModelCheck | null
  workflowBinding: WorkflowBinding | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface EntryUpdateInput {
  id: string
  customName?: string | null
  isFavorited?: boolean
}

export interface EntryDeleteInput {
  id: string
  mode: EntryDeleteMode
}

export interface EntryDeleteResult {
  id: string
  mode: EntryDeleteMode
  success: boolean
}
