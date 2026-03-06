export type ImageCacheCleanupMode = 'orphans' | 'missing_refs' | 'all'

export interface ImageCacheStatus {
  cacheRoot: string
  totalBytes: number
  fileCount: number
  referencedFileCount: number
  orphanFileCount: number
  orphanBytes: number
  missingReferenceCount: number
}

export interface ImageCacheCleanupInput {
  mode: ImageCacheCleanupMode
}

export interface ImageCacheCleanupResult {
  mode: ImageCacheCleanupMode
  deletedFiles: number
  freedBytes: number
  clearedReferences: number
  cacheRoot: string
}
