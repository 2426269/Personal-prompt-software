export type StorageLocationKey = 'userData' | 'databaseDir' | 'imageCache' | 'exports'

export interface StorageInfo {
  userDataPath: string
  defaultUserDataPath: string
  usingCustomUserDataPath: boolean
  bootstrapConfigPath: string
  databasePath: string
  databaseDirPath: string
  imageCachePath: string
  exportsPath: string
}

export interface DatabaseBackupExportResult {
  cancelled: boolean
  filePath: string | null
  bytes: number
}

export interface DatabaseBackupImportResult {
  cancelled: boolean
  filePath: string | null
  databasePath: string
}

export interface AppDataMigrationResult {
  cancelled: boolean
  sourcePath: string
  targetPath: string | null
  copiedFiles: number
  requiresRestart: boolean
}

export interface OpenStorageLocationInput {
  target: StorageLocationKey
}

export interface OpenStorageLocationResult {
  target: StorageLocationKey
  openedPath: string
}
