import fs from 'node:fs'
import path from 'node:path'

import { app, dialog, shell } from 'electron'

import type {
  AppDataMigrationResult,
  DatabaseBackupExportResult,
  DatabaseBackupImportResult,
  OpenStorageLocationInput,
  OpenStorageLocationResult,
  StorageInfo,
} from '@shared/types/storage'

import { closeDatabase, getDatabase, initDatabase } from '../../db/database'
import { AppError } from '../../ipc/wrap-ipc'
import {
  getDefaultUserDataPath,
  getStorageBootstrapPath,
  persistConfiguredUserDataPath,
} from '../../storage-path'
import { ImagesRepository } from '../../db/repositories/images.repo'

function getUserDataPath(): string {
  return app.getPath('userData')
}

function getDatabasePath(): string {
  return path.join(getUserDataPath(), 'promptforge.db')
}

function getDatabaseDirPath(): string {
  return path.dirname(getDatabasePath())
}

function getImageCachePath(): string {
  return path.join(getUserDataPath(), 'cache', 'aitag')
}

function getExportsPath(): string {
  return path.join(getUserDataPath(), 'exports')
}

function ensureDirectory(targetPath: string): void {
  fs.mkdirSync(targetPath, { recursive: true })
}

function timestampForFile(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function removeWalSidecars(databasePath: string): void {
  fs.rmSync(`${databasePath}-wal`, { force: true })
  fs.rmSync(`${databasePath}-shm`, { force: true })
}

function normalizeAbsolute(targetPath: string): string {
  const resolvedPath = path.resolve(targetPath)
  return process.platform === 'win32' ? resolvedPath.toLowerCase() : resolvedPath
}

function isSameOrNestedPath(basePath: string, candidatePath: string): boolean {
  const relative = path.relative(normalizeAbsolute(basePath), normalizeAbsolute(candidatePath))
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function countFilesRecursive(sourcePath: string): number {
  let total = 0

  for (const entry of fs.readdirSync(sourcePath, { withFileTypes: true })) {
    const entryPath = path.join(sourcePath, entry.name)
    if (entry.isDirectory()) {
      total += countFilesRecursive(entryPath)
      continue
    }

    total += 1
  }

  return total
}

function copyDirectoryContents(sourcePath: string, targetPath: string): void {
  ensureDirectory(targetPath)

  for (const entry of fs.readdirSync(sourcePath, { withFileTypes: true })) {
    const sourceEntryPath = path.join(sourcePath, entry.name)
    const targetEntryPath = path.join(targetPath, entry.name)

    if (entry.isDirectory()) {
      copyDirectoryContents(sourceEntryPath, targetEntryPath)
      continue
    }

    fs.copyFileSync(sourceEntryPath, targetEntryPath)
  }
}

function ensureDirectoryIsEmpty(targetPath: string): void {
  ensureDirectory(targetPath)
  const entries = fs.readdirSync(targetPath)
  if (entries.length > 0) {
    throw new AppError('MIGRATE_TARGET_NOT_EMPTY', '目标目录不是空文件夹，请先新建一个空目录再执行迁移。')
  }
}

function normalizeWindowsSeparators(targetPath: string): string {
  return path.resolve(targetPath).replace(/\//g, '\\')
}

function buildImageCachePath(rootPath: string): string {
  return path.join(rootPath, 'cache', 'aitag')
}

function repairImageLocalPathReferences(sourceUserDataPath: string, targetUserDataPath: string): number {
  const sourceCachePath = normalizeWindowsSeparators(buildImageCachePath(sourceUserDataPath))
  const targetCachePath = normalizeWindowsSeparators(buildImageCachePath(targetUserDataPath))

  const repo = new ImagesRepository()
  const prefixed = repo.rewriteLocalPathPrefix(sourceCachePath, targetCachePath)
  const repointed = repo.repointAllLocalPathsToCacheRoot(targetCachePath)
  return Math.max(prefixed, repointed)
}

export function repairCurrentAppDataImagePaths(): number {
  const currentUserDataPath = app.getPath('userData')
  const defaultUserDataPath = getDefaultUserDataPath()

  if (normalizeAbsolute(currentUserDataPath) === normalizeAbsolute(defaultUserDataPath)) {
    return 0
  }

  const repo = new ImagesRepository()
  const sourceCachePath = normalizeWindowsSeparators(buildImageCachePath(defaultUserDataPath))
  const currentCachePath = normalizeWindowsSeparators(buildImageCachePath(currentUserDataPath))

  if (repo.countByLocalPathPrefix(sourceCachePath) === 0) {
    return repo.repointAllLocalPathsToCacheRoot(currentCachePath)
  }

  return repairImageLocalPathReferences(defaultUserDataPath, currentUserDataPath)
}

export class StorageService {
  getStorageInfo(): StorageInfo {
    const userDataPath = getUserDataPath()
    const defaultUserDataPath = getDefaultUserDataPath()

    return {
      userDataPath,
      defaultUserDataPath,
      usingCustomUserDataPath: normalizeAbsolute(userDataPath) !== normalizeAbsolute(defaultUserDataPath),
      bootstrapConfigPath: getStorageBootstrapPath(),
      databasePath: getDatabasePath(),
      databaseDirPath: getDatabaseDirPath(),
      imageCachePath: getImageCachePath(),
      exportsPath: getExportsPath(),
    }
  }

  async exportDatabaseBackup(): Promise<DatabaseBackupExportResult> {
    const databasePath = getDatabasePath()
    ensureDirectory(getExportsPath())

    const defaultPath = path.join(getExportsPath(), `promptforge-backup-${timestampForFile()}.db`)
    const result = await dialog.showSaveDialog({
      title: '导出数据库备份',
      defaultPath,
      filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3', 'bak'] }],
    })

    if (result.canceled || !result.filePath) {
      return {
        cancelled: true,
        filePath: null,
        bytes: 0,
      }
    }

    const db = getDatabase()
    db.pragma('wal_checkpoint(TRUNCATE)')
    fs.copyFileSync(databasePath, result.filePath)

    return {
      cancelled: false,
      filePath: result.filePath,
      bytes: fs.statSync(result.filePath).size,
    }
  }

  async importDatabaseBackup(): Promise<DatabaseBackupImportResult> {
    const databasePath = getDatabasePath()
    const result = await dialog.showOpenDialog({
      title: '选择数据库备份文件',
      properties: ['openFile'],
      filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3', 'bak'] }],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return {
        cancelled: true,
        filePath: null,
        databasePath,
      }
    }

    const sourcePath = result.filePaths[0]
    if (!fs.existsSync(sourcePath)) {
      throw new AppError('BACKUP_NOT_FOUND', '选中的备份文件不存在。')
    }

    closeDatabase()
    removeWalSidecars(databasePath)
    ensureDirectory(getDatabaseDirPath())
    fs.copyFileSync(sourcePath, databasePath)
    initDatabase()

    return {
      cancelled: false,
      filePath: sourcePath,
      databasePath,
    }
  }

  async migrateAppDataDirectory(): Promise<AppDataMigrationResult> {
    const sourcePath = getUserDataPath()
    const result = await dialog.showOpenDialog({
      title: '选择新的应用数据目录（请先创建一个空文件夹）',
      properties: ['openDirectory', 'createDirectory'],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return {
        cancelled: true,
        sourcePath,
        targetPath: null,
        copiedFiles: 0,
        requiresRestart: false,
      }
    }

    const targetPath = result.filePaths[0]
    if (normalizeAbsolute(sourcePath) === normalizeAbsolute(targetPath)) {
      throw new AppError('MIGRATE_TARGET_SAME', '目标目录不能与当前应用数据目录相同。')
    }

    if (isSameOrNestedPath(sourcePath, targetPath) || isSameOrNestedPath(targetPath, sourcePath)) {
      throw new AppError('MIGRATE_TARGET_INVALID', '目标目录不能与当前应用数据目录互为父子目录。')
    }

    ensureDirectoryIsEmpty(targetPath)

    const databasePath = getDatabasePath()
    const previousUserDataPath = app.getPath('userData')
    const db = getDatabase()
    db.pragma('wal_checkpoint(TRUNCATE)')
    closeDatabase()

    const copiedFiles = countFilesRecursive(sourcePath)

    try {
      copyDirectoryContents(sourcePath, targetPath)

      removeWalSidecars(path.join(targetPath, 'promptforge.db'))
      persistConfiguredUserDataPath(targetPath)
      app.setPath('userData', targetPath)
      initDatabase()
      repairImageLocalPathReferences(sourcePath, targetPath)

      return {
        cancelled: false,
        sourcePath,
        targetPath,
        copiedFiles,
        requiresRestart: false,
      }
    } catch (error) {
      app.setPath('userData', previousUserDataPath)
      persistConfiguredUserDataPath(previousUserDataPath)
      removeWalSidecars(databasePath)
      initDatabase(databasePath)
      throw error
    }
  }

  async openStorageLocation(input: OpenStorageLocationInput): Promise<OpenStorageLocationResult> {
    const info = this.getStorageInfo()
    const targetPath = {
      userData: info.userDataPath,
      databaseDir: info.databaseDirPath,
      imageCache: info.imageCachePath,
      exports: info.exportsPath,
    }[input.target]

    ensureDirectory(targetPath)
    const error = await shell.openPath(targetPath)
    if (error) {
      throw new AppError('OPEN_PATH_FAILED', error)
    }

    return {
      target: input.target,
      openedPath: targetPath,
    }
  }
}
