import type { AitagImage, PromptSourceType, PromptTag } from './importer'
import type { EntryAnalysisResult } from './llm'
import type { UserTag } from './tag'

export type EntrySortBy = 'created_at' | 'updated_at' | 'post_date' | 'bookmarks' | 'views'
export type EntrySortOrder = 'asc' | 'desc'
export type EntryDeleteMode = 'soft' | 'hard'

export interface EntryListParams {
  page: number
  pageSize: number
  sortBy: EntrySortBy
  sortOrder: EntrySortOrder
  includeDeleted?: boolean
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
  type: Exclude<PromptSourceType, 'Unknown'>
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

export interface EntryDetail {
  id: string
  pixivId: string | null
  authorId: string | null
  authorName: string | null
  title: string
  customName: string | null
  displayTitle: string
  caption: string
  type: Exclude<PromptSourceType, 'Unknown'>
  sourceUrl: string | null
  postDate: string | null
  views: number
  bookmarks: number
  isFavorited: boolean
  sourceTags: string[]
  userTags: string[]
  userTagRecords: UserTag[]
  loras: PromptTag[]
  rawJson: string
  images: AitagImage[]
  analysis: EntryAnalysisResult | null
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
