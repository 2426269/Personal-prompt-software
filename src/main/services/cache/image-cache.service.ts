import fs from 'node:fs/promises'
import path from 'node:path'

import { app } from 'electron'

import type {
  ImageCacheCleanupInput,
  ImageCacheCleanupResult,
  ImageCacheStatus,
} from '@shared/types/image-cache'

import { ImagesRepository } from '../../db/repositories/images.repo'

interface CacheFileRecord {
  path: string
  size: number
}

function normalizeFilePath(filePath: string): string {
  return path.normalize(filePath)
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

async function collectFiles(root: string): Promise<CacheFileRecord[]> {
  if (!(await pathExists(root))) {
    return []
  }

  const dirents = await fs.readdir(root, { withFileTypes: true })
  const nested = await Promise.all(
    dirents.map(async (entry) => {
      const fullPath = path.join(root, entry.name)
      if (entry.isDirectory()) {
        return collectFiles(fullPath)
      }

      if (!entry.isFile()) {
        return []
      }

      const stats = await fs.stat(fullPath)
      return [{ path: normalizeFilePath(fullPath), size: stats.size }]
    }),
  )

  return nested.flat()
}

async function deleteFiles(files: CacheFileRecord[]): Promise<{ deletedFiles: number; freedBytes: number }> {
  let deletedFiles = 0
  let freedBytes = 0

  for (const file of files) {
    try {
      await fs.unlink(file.path)
      deletedFiles += 1
      freedBytes += file.size
    } catch {
      continue
    }
  }

  return { deletedFiles, freedBytes }
}

export class ImageCacheService {
  private readonly cacheRoot: string

  constructor(
    private readonly imagesRepository = new ImagesRepository(),
    cacheRoot?: string,
  ) {
    this.cacheRoot = cacheRoot ?? path.join(app.getPath('userData'), 'cache', 'aitag')
  }

  async getStatus(): Promise<ImageCacheStatus> {
    const files = await collectFiles(this.cacheRoot)
    const referencedPaths = this.imagesRepository.listLocalPaths().map(normalizeFilePath)
    const referencedSet = new Set(referencedPaths)

    const orphanFiles = files.filter((file) => !referencedSet.has(file.path))
    const existingFileSet = new Set(files.map((file) => file.path))
    const missingReferenceCount = referencedPaths.filter((filePath) => !existingFileSet.has(filePath)).length

    return {
      cacheRoot: this.cacheRoot,
      totalBytes: files.reduce((sum, file) => sum + file.size, 0),
      fileCount: files.length,
      referencedFileCount: files.length - orphanFiles.length,
      orphanFileCount: orphanFiles.length,
      orphanBytes: orphanFiles.reduce((sum, file) => sum + file.size, 0),
      missingReferenceCount,
    }
  }

  async cleanup(input: ImageCacheCleanupInput): Promise<ImageCacheCleanupResult> {
    const files = await collectFiles(this.cacheRoot)
    const referencedPaths = this.imagesRepository.listLocalPaths().map(normalizeFilePath)
    const referencedSet = new Set(referencedPaths)
    const fileSet = new Set(files.map((file) => file.path))

    if (input.mode === 'orphans') {
      const orphanFiles = files.filter((file) => !referencedSet.has(file.path))
      const deleted = await deleteFiles(orphanFiles)
      return {
        mode: input.mode,
        deletedFiles: deleted.deletedFiles,
        freedBytes: deleted.freedBytes,
        clearedReferences: 0,
        cacheRoot: this.cacheRoot,
      }
    }

    if (input.mode === 'missing_refs') {
      const missingPaths = referencedPaths.filter((filePath) => !fileSet.has(filePath))
      const clearedReferences = this.imagesRepository.clearLocalPaths(missingPaths)
      return {
        mode: input.mode,
        deletedFiles: 0,
        freedBytes: 0,
        clearedReferences,
        cacheRoot: this.cacheRoot,
      }
    }

    const deleted = await deleteFiles(files)
    const clearedReferences = this.imagesRepository.clearAllLocalPaths()
    return {
      mode: input.mode,
      deletedFiles: deleted.deletedFiles,
      freedBytes: deleted.freedBytes,
      clearedReferences,
      cacheRoot: this.cacheRoot,
    }
  }
}
