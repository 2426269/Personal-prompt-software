import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

import { app, dialog } from 'electron'

import type {
  AnimaArtistDetail,
  AnimaArtistFolderUpdateInput,
  AnimaArtistListParams,
  AnimaArtistListResult,
  AnimaExportInput,
  AnimaExportResult,
  AnimaFolder,
  AnimaFolderDeleteInput,
  AnimaFolderSaveInput,
  AnimaImportFavoritesResult,
  AnimaImportInput,
  AnimaImportResult,
  AnimaLibraryStatus,
  AnimaToggleFavoriteInput,
} from '@shared/types/anima'

import { AnimaRepository, type StoredAnimaArtist } from '../../db/repositories/anima.repo'
import { AppError } from '../../ipc/wrap-ipc'

interface ParsedGalleryItem {
  id: string | number
  name: string
  post_count: number
  p: number
  uniqueness_score?: number | null
}

interface AnimaExportJson {
  version: 1
  exportedAt: string
  favorites: string[]
  artists: Array<{ id: string; name: string }>
  folders: Array<{ name: string; artistIds: string[] }>
}

const ANIMA_LIBRARY_DIRNAME = 'anima-style-explorer'
const ANIMA_IMAGES_DIRNAME = 'images'
const ANIMA_EXPORT_PAGE_SIZE = 50000

function normalizeSearchName(value: string): string {
  return value
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function getLibraryRootPath(): string {
  return path.join(app.getPath('userData'), ANIMA_LIBRARY_DIRNAME)
}

function getLibraryImagesPath(): string {
  return path.join(getLibraryRootPath(), ANIMA_IMAGES_DIRNAME)
}

function buildLibraryImageRelPath(pageBucket: number, artistId: string): string {
  return `${ANIMA_IMAGES_DIRNAME}/${pageBucket}/${artistId}.webp`
}

function ensureValidSourcePath(sourcePath: string): { dataPath: string; imagesPath: string } {
  const dataPath = path.join(sourcePath, 'app', 'data.js')
  const imagesPath = path.join(sourcePath, 'images')

  if (!fs.existsSync(sourcePath)) {
    throw new AppError('ANIMA_SOURCE_NOT_FOUND', `离线目录不存在：${sourcePath}`)
  }
  if (!fs.existsSync(dataPath)) {
    throw new AppError('ANIMA_DATA_NOT_FOUND', '未找到 Anima 离线数据文件 app/data.js。')
  }
  if (!fs.existsSync(imagesPath)) {
    throw new AppError('ANIMA_IMAGES_NOT_FOUND', '未找到 Anima 预览图目录 images。')
  }

  return { dataPath, imagesPath }
}

function parseAnimaGalleryData(dataPath: string): StoredAnimaArtist[] {
  const code = fs.readFileSync(dataPath, 'utf8')
  const sandbox: Record<string, unknown> = {}
  vm.createContext(sandbox)
  vm.runInContext(`${code}\nthis.__galleryData = galleryData;`, sandbox)
  const items = sandbox.__galleryData

  if (!Array.isArray(items)) {
    throw new AppError('ANIMA_PARSE_FAILED', 'Anima 离线数据格式无效。')
  }

  return (items as ParsedGalleryItem[]).map((item) => {
    const id = String(item.id)
    const pageBucket = Number(item.p) || 1
    return {
      id,
      name: item.name,
      searchName: normalizeSearchName(item.name),
      postCount: Number(item.post_count) || 0,
      pageBucket,
      uniquenessScore: item.uniqueness_score != null ? Number(item.uniqueness_score) : null,
      imageRelPath: buildLibraryImageRelPath(pageBucket, id),
    }
  })
}

function copyLibraryImages(imagesPath: string): void {
  const targetRoot = getLibraryRootPath()
  const targetImagesPath = getLibraryImagesPath()
  fs.mkdirSync(targetRoot, { recursive: true })
  fs.rmSync(targetImagesPath, { recursive: true, force: true })
  fs.cpSync(imagesPath, targetImagesPath, { recursive: true, force: true })
}

export class AnimaService {
  private readonly repo: AnimaRepository

  constructor(repo: AnimaRepository = new AnimaRepository()) {
    this.repo = repo
  }

  getStatus(): AnimaLibraryStatus {
    const meta = this.repo.getMeta()
    const libraryRootPath = fs.existsSync(getLibraryRootPath()) ? getLibraryRootPath() : null

    return {
      imported: Boolean(meta && libraryRootPath),
      sourcePath: meta?.source_path ?? null,
      libraryRootPath,
      totalArtists: meta?.total_artists ?? 0,
      importedAt: meta?.imported_at ?? null,
      favoritesCount: this.repo.countFavorites(),
      folderCount: this.repo.countFolders(),
    }
  }

  async importLibrary(input?: AnimaImportInput): Promise<AnimaImportResult> {
    const status = this.getStatus()
    const chosenSourcePath = input?.sourcePath?.trim() || status.sourcePath || null

    let sourcePath = chosenSourcePath
    if (!sourcePath) {
      const result = await dialog.showOpenDialog({
        title: '选择 Anima Style Explorer 离线目录',
        properties: ['openDirectory'],
      })
      if (result.canceled || result.filePaths.length === 0) {
        return {
          cancelled: true,
          sourcePath: null,
          totalArtists: status.totalArtists,
          libraryRootPath: status.libraryRootPath,
          importedAt: status.importedAt,
        }
      }
      sourcePath = result.filePaths[0]
    }

    const { dataPath, imagesPath } = ensureValidSourcePath(sourcePath)
    const artists = parseAnimaGalleryData(dataPath)
    copyLibraryImages(imagesPath)
    this.repo.replaceLibrary(sourcePath, artists)

    const nextStatus = this.getStatus()
    return {
      cancelled: false,
      sourcePath,
      totalArtists: nextStatus.totalArtists,
      libraryRootPath: nextStatus.libraryRootPath,
      importedAt: nextStatus.importedAt,
    }
  }

  listArtists(params?: AnimaArtistListParams): AnimaArtistListResult {
    return this.repo.listArtists({
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 120,
      searchQuery: params?.searchQuery,
      sortBy: params?.sortBy ?? 'post_count',
      sortOrder: params?.sortOrder ?? 'desc',
      favoritesOnly: params?.favoritesOnly ?? false,
      folderId: params?.folderId ?? null,
      ids: params?.ids ?? [],
    }, this.getStatus().libraryRootPath)
  }

  getArtist(id: string): AnimaArtistDetail | null {
    return this.repo.getArtist(id, this.getStatus().libraryRootPath)
  }

  toggleFavorite(input: AnimaToggleFavoriteInput): boolean {
    return this.repo.setFavorite(input.artistId, input.isFavorited)
  }

  listFolders(): AnimaFolder[] {
    return this.repo.listFolders()
  }

  saveFolder(input: AnimaFolderSaveInput): AnimaFolder {
    const name = input.name.trim()
    if (!name) {
      throw new AppError('ANIMA_FOLDER_NAME_REQUIRED', '文件夹名称不能为空。')
    }

    return this.repo.saveFolder({
      id: input.id,
      name,
    })
  }

  deleteFolder(input: AnimaFolderDeleteInput): boolean {
    return this.repo.deleteFolder(input.id)
  }

  setArtistFolders(input: AnimaArtistFolderUpdateInput): boolean {
    return this.repo.setArtistFolders(input.artistId, input.folderIds)
  }

  private resolveExportArtists(input: AnimaExportInput) {
    const status = this.getStatus()
    if (!status.imported) {
      throw new AppError('ANIMA_NOT_IMPORTED', '尚未导入 Anima 离线库。')
    }

    if (input.artistIds?.length) {
      return this.repo.listArtistsByIds(input.artistIds, status.libraryRootPath)
    }

    if (input.favoritesOnly) {
      return this.repo.listArtistsByIds(this.repo.listFavoriteArtistIds(), status.libraryRootPath)
    }

    return this.listArtists({
      page: 1,
      pageSize: ANIMA_EXPORT_PAGE_SIZE,
      sortBy: 'name',
      sortOrder: 'asc',
    }).items
  }

  async exportArtists(input: AnimaExportInput): Promise<AnimaExportResult> {
    const artists = this.resolveExportArtists(input)
    const defaultExtension = input.format === 'txt' ? 'txt' : 'json'
    const result = await dialog.showSaveDialog({
      title: input.format === 'txt' ? '导出画师串 TXT' : '导出画师收藏 JSON',
      defaultPath: path.join(app.getPath('documents'), `promptforge-anima-export.${defaultExtension}`),
      filters: [{ name: defaultExtension.toUpperCase(), extensions: [defaultExtension] }],
    })

    if (result.canceled || !result.filePath) {
      return {
        cancelled: true,
        filePath: null,
        artistCount: artists.length,
      }
    }

    if (input.format === 'txt') {
      fs.writeFileSync(result.filePath, artists.map((artist) => artist.name).join('\n'), 'utf8')
    } else {
      const artistIds = artists.map((artist) => artist.id)
      const folders = this.repo.listFolders().map((folder) => {
        const folderArtistIds = this.repo
          .listArtists({
            page: 1,
            pageSize: 999999,
            sortBy: 'name',
            sortOrder: 'asc',
            favoritesOnly: false,
            folderId: folder.id,
            ids: [],
          }, null)
          .items
          .map((artist) => artist.id)
          .filter((id) => artistIds.includes(id))

        return {
          name: folder.name,
          artistIds: folderArtistIds,
        }
      }).filter((folder) => folder.artistIds.length > 0)

      const payload: AnimaExportJson = {
        version: 1,
        exportedAt: new Date().toISOString(),
        favorites: artistIds,
        artists: artists.map((artist) => ({ id: artist.id, name: artist.name })),
        folders,
      }
      fs.writeFileSync(result.filePath, JSON.stringify(payload, null, 2), 'utf8')
    }

    return {
      cancelled: false,
      filePath: result.filePath,
      artistCount: artists.length,
    }
  }

  async importFavorites(): Promise<AnimaImportFavoritesResult> {
    const result = await dialog.showOpenDialog({
      title: '导入画师收藏 JSON',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return {
        cancelled: true,
        filePath: null,
        importedFavorites: 0,
        importedFolders: 0,
      }
    }

    const filePath = result.filePaths[0]
    const raw = fs.readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(raw) as Partial<AnimaExportJson>
    const pairs = this.repo.listArtistNamePairs()
    const validIds = new Set(pairs.map((pair) => pair.id))
    const idByName = new Map(pairs.map((pair) => [normalizeSearchName(pair.name), pair.id]))
    const resolvedImportArtistIds = new Map<string, string>()

    const favoriteIds = new Set<string>()
    for (const favoriteId of parsed.favorites ?? []) {
      if (validIds.has(favoriteId)) {
        favoriteIds.add(favoriteId)
        resolvedImportArtistIds.set(favoriteId, favoriteId)
      }
    }
    for (const artist of parsed.artists ?? []) {
      const resolvedId = artist.id && validIds.has(artist.id)
        ? artist.id
        : idByName.get(normalizeSearchName(artist.name))
      if (resolvedId) {
        favoriteIds.add(resolvedId)
        if (artist.id) {
          resolvedImportArtistIds.set(artist.id, resolvedId)
        }
      }
    }

    let importedFolders = 0
    for (const folder of parsed.folders ?? []) {
      if (!folder.name?.trim()) {
        continue
      }
      const savedFolder = this.repo.saveFolder({ name: folder.name.trim() })
      importedFolders += 1
      for (const importedArtistId of folder.artistIds ?? []) {
        const resolvedArtistId = resolvedImportArtistIds.get(importedArtistId) ?? importedArtistId
        const existing = this.repo.getArtist(resolvedArtistId, null)
        if (!existing) {
          continue
        }
        const nextFolderIds = [...new Set([...existing.folderIds, savedFolder.id])]
        this.repo.setArtistFolders(resolvedArtistId, nextFolderIds)
        favoriteIds.add(resolvedArtistId)
      }
    }

    for (const artistId of favoriteIds) {
      this.repo.setFavorite(artistId, true)
    }

    return {
      cancelled: false,
      filePath,
      importedFavorites: favoriteIds.size,
      importedFolders,
    }
  }
}
