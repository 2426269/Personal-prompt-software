export type SpellbookCategory = 'style_prompt' | 'tool_nav' | 'tag_reference'
export type SpellbookKind = 'site_page' | 'site_child_page' | 'external_link'
export type SpellbookSortBy = 'title' | 'updated_at'
export type SpellbookSortOrder = 'asc' | 'desc'

export interface SpellbookImageRef {
  localPath: string | null
  originalUrl: string
  caption: string | null
}

export interface SpellbookRelatedLink {
  title: string
  url: string
  isInternal: boolean
}

export interface SpellbookSection {
  heading: string
  blocks: string[]
}

export interface SpellbookEntrySummary {
  id: string
  parentEntryId: string | null
  title: string
  summary: string
  category: SpellbookCategory
  kind: SpellbookKind
  sourceUrl: string
  promptTextPreview: string | null
  modelHints: string[]
  tags: string[]
  coverImage: SpellbookImageRef | null
  imageCount: number
  childCount: number
  updatedAt: string | null
}

export interface SpellbookEntryDetail extends SpellbookEntrySummary {
  bodyText: string
  promptText: string | null
  promptCandidates: string[]
  sections: SpellbookSection[]
  relatedLinks: SpellbookRelatedLink[]
  images: SpellbookImageRef[]
  childEntries: SpellbookEntrySummary[]
}

export interface SpellbookLibraryStatus {
  synced: boolean
  rootUrl: string
  totalEntries: number
  totalImages: number
  lastSyncedAt: string | null
  entryCounts: {
    stylePrompt: number
    toolNav: number
    tagReference: number
  }
}

export interface SpellbookListParams {
  searchQuery?: string
  category?: SpellbookCategory | null
  includeChildren?: boolean
  sortBy?: SpellbookSortBy
  sortOrder?: SpellbookSortOrder
}

export interface SpellbookSyncResult {
  synced: boolean
  totalEntries: number
  totalImages: number
  lastSyncedAt: string | null
  rootUrl: string
}
