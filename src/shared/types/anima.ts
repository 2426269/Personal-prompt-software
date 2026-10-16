export type AnimaArtistSortBy = 'name' | 'post_count' | 'uniqueness_score' | 'favorited_at'
export type AnimaSortOrder = 'asc' | 'desc'
export type AnimaExportFormat = 'txt' | 'json'

export interface AnimaImageRef {
  localPath: string | null
}

export interface AnimaLibraryStatus {
  imported: boolean
  sourcePath: string | null
  libraryRootPath: string | null
  totalArtists: number
  importedAt: string | null
  favoritesCount: number
  folderCount: number
}

export interface AnimaArtistSummary {
  id: string
  name: string
  postCount: number
  pageBucket: number
  uniquenessScore: number | null
  previewImage: AnimaImageRef
  isFavorited: boolean
  folderIds: string[]
}

export interface AnimaArtistDetail extends AnimaArtistSummary {
  folderNames: string[]
}

export interface AnimaFolder {
  id: string
  name: string
  artistCount: number
  createdAt: string
  updatedAt: string
}

export interface AnimaArtistListParams {
  page?: number
  pageSize?: number
  searchQuery?: string
  sortBy?: AnimaArtistSortBy
  sortOrder?: AnimaSortOrder
  favoritesOnly?: boolean
  folderId?: string | null
  ids?: string[]
}

export interface AnimaArtistListResult {
  items: AnimaArtistSummary[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface AnimaImportInput {
  sourcePath?: string | null
}

export interface AnimaImportResult {
  cancelled: boolean
  sourcePath: string | null
  totalArtists: number
  libraryRootPath: string | null
  importedAt: string | null
}

export interface AnimaToggleFavoriteInput {
  artistId: string
  isFavorited: boolean
}

export interface AnimaFolderSaveInput {
  id?: string
  name: string
}

export interface AnimaFolderDeleteInput {
  id: string
}

export interface AnimaArtistFolderUpdateInput {
  artistId: string
  folderIds: string[]
}

export interface AnimaExportInput {
  format: AnimaExportFormat
  artistIds?: string[]
  favoritesOnly?: boolean
}

export interface AnimaExportResult {
  cancelled: boolean
  filePath: string | null
  artistCount: number
}

export interface AnimaImportFavoritesResult {
  cancelled: boolean
  filePath: string | null
  importedFavorites: number
  importedFolders: number
}
