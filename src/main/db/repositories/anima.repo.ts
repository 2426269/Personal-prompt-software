import { randomUUID } from 'node:crypto'

import type { Database } from 'better-sqlite3'

import type {
  AnimaArtistDetail,
  AnimaArtistListParams,
  AnimaArtistListResult,
  AnimaArtistSummary,
  AnimaFolder,
} from '@shared/types/anima'

import { getDatabase } from '../database'

interface AnimaLibraryMetaRow {
  source_path: string | null
  total_artists: number
  imported_at: string | null
}

interface AnimaArtistListRow {
  id: string
  name: string
  post_count: number
  page_bucket: number
  uniqueness_score: number | null
  image_rel_path: string
  is_favorited: number
  folder_ids: string | null
}

interface AnimaFolderNameRow {
  folder_id: string
  name: string
}

interface CountRow {
  count: number
}

interface NameIdRow {
  id: string
  name: string
}

export interface StoredAnimaArtist {
  id: string
  name: string
  searchName: string
  postCount: number
  pageBucket: number
  uniquenessScore: number | null
  imageRelPath: string
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&')
}

function mapArtistRow(row: AnimaArtistListRow, libraryRootPath: string | null): AnimaArtistSummary {
  const previewPath = libraryRootPath ? `${libraryRootPath}\\${row.image_rel_path.replace(/\//g, '\\')}` : null
  return {
    id: row.id,
    name: row.name,
    postCount: row.post_count,
    pageBucket: row.page_bucket,
    uniquenessScore: row.uniqueness_score,
    previewImage: {
      localPath: previewPath,
    },
    isFavorited: row.is_favorited === 1,
    folderIds: row.folder_ids ? row.folder_ids.split(',').filter(Boolean) : [],
  }
}

export class AnimaRepository {
  private readonly db: Database

  constructor(db: Database = getDatabase()) {
    this.db = db
  }

  getMeta(): AnimaLibraryMetaRow | null {
    const stmt = this.db.prepare<[], AnimaLibraryMetaRow>(`
      SELECT source_path, total_artists, imported_at
      FROM anima_library_meta
      WHERE id = 1
      LIMIT 1
    `)

    return stmt.get() ?? null
  }

  replaceLibrary(sourcePath: string, artists: StoredAnimaArtist[]): void {
    const deleteArtists = this.db.prepare('DELETE FROM anima_artists')
    const upsertMeta = this.db.prepare(`
      INSERT INTO anima_library_meta (id, source_path, total_artists, imported_at, updated_at)
      VALUES (1, @source_path, @total_artists, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        source_path=excluded.source_path,
        total_artists=excluded.total_artists,
        imported_at=CURRENT_TIMESTAMP,
        updated_at=CURRENT_TIMESTAMP
    `)
    const insertArtist = this.db.prepare(`
      INSERT INTO anima_artists (
        id,
        name,
        search_name,
        post_count,
        page_bucket,
        uniqueness_score,
        image_rel_path,
        imported_at
      ) VALUES (
        @id,
        @name,
        @search_name,
        @post_count,
        @page_bucket,
        @uniqueness_score,
        @image_rel_path,
        CURRENT_TIMESTAMP
      )
    `)
    const pruneFavorites = this.db.prepare(`
      DELETE FROM anima_favorites
      WHERE artist_id NOT IN (SELECT id FROM anima_artists)
    `)
    const pruneFolderItems = this.db.prepare(`
      DELETE FROM anima_folder_items
      WHERE artist_id NOT IN (SELECT id FROM anima_artists)
    `)

    const tx = this.db.transaction(() => {
      deleteArtists.run()
      for (const artist of artists) {
        insertArtist.run({
          id: artist.id,
          name: artist.name,
          search_name: artist.searchName,
          post_count: artist.postCount,
          page_bucket: artist.pageBucket,
          uniqueness_score: artist.uniquenessScore,
          image_rel_path: artist.imageRelPath,
        })
      }
      upsertMeta.run({
        source_path: sourcePath,
        total_artists: artists.length,
      })
      pruneFavorites.run()
      pruneFolderItems.run()
    })

    tx()
  }

  countFavorites(): number {
    return this.db.prepare<[], CountRow>('SELECT COUNT(*) AS count FROM anima_favorites').get()?.count ?? 0
  }

  countFolders(): number {
    return this.db.prepare<[], CountRow>('SELECT COUNT(*) AS count FROM anima_folders').get()?.count ?? 0
  }

  listArtists(params: Required<Pick<AnimaArtistListParams, 'page' | 'pageSize'>> & Omit<AnimaArtistListParams, 'page' | 'pageSize'>, libraryRootPath: string | null): AnimaArtistListResult {
    const page = Math.max(1, params.page)
    const pageSize = Math.min(50000, Math.max(1, params.pageSize))
    const offset = (page - 1) * pageSize

    const whereClauses: string[] = []
    const values: Record<string, unknown> = {
      limit: pageSize,
      offset,
    }

    if (params.searchQuery?.trim()) {
      values.search = `%${escapeLikePattern(params.searchQuery.trim().toLowerCase())}%`
      whereClauses.push('(LOWER(a.name) LIKE @search ESCAPE \'\\\\\' OR LOWER(a.search_name) LIKE @search ESCAPE \'\\\\\')')
    }

    if (params.favoritesOnly) {
      whereClauses.push('af.artist_id IS NOT NULL')
    }

    if (params.folderId) {
      whereClauses.push('EXISTS (SELECT 1 FROM anima_folder_items afi_filter WHERE afi_filter.artist_id = a.id AND afi_filter.folder_id = @folder_id)')
      values.folder_id = params.folderId
    }

    if (params.ids?.length) {
      const placeholders = params.ids.map((_, index) => `@id_${index}`)
      whereClauses.push(`a.id IN (${placeholders.join(', ')})`)
      params.ids.forEach((id, index) => {
        values[`id_${index}`] = id
      })
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''
    const orderColumn = {
      name: 'a.name COLLATE NOCASE',
      post_count: 'a.post_count',
      uniqueness_score: 'COALESCE(a.uniqueness_score, 0)',
      favorited_at: 'af.created_at',
    }[params.sortBy ?? 'name']
    const orderDirection = params.sortOrder === 'asc' ? 'ASC' : 'DESC'

    const countStatement = this.db.prepare<Record<string, unknown>, CountRow>(`
      SELECT COUNT(DISTINCT a.id) AS count
      FROM anima_artists a
      LEFT JOIN anima_favorites af ON af.artist_id = a.id
      ${whereSql}
    `)
    const total = countStatement.get(values)?.count ?? 0

    const listStatement = this.db.prepare<Record<string, unknown>, AnimaArtistListRow>(`
      SELECT
        a.id,
        a.name,
        a.post_count,
        a.page_bucket,
        a.uniqueness_score,
        a.image_rel_path,
        CASE WHEN af.artist_id IS NULL THEN 0 ELSE 1 END AS is_favorited,
        GROUP_CONCAT(DISTINCT afi.folder_id) AS folder_ids
      FROM anima_artists a
      LEFT JOIN anima_favorites af ON af.artist_id = a.id
      LEFT JOIN anima_folder_items afi ON afi.artist_id = a.id
      ${whereSql}
      GROUP BY a.id
      ORDER BY ${orderColumn} ${orderDirection}, a.name COLLATE NOCASE ASC
      LIMIT @limit OFFSET @offset
    `)

    const rows = listStatement.all(values)

    return {
      items: rows.map((row) => mapArtistRow(row, libraryRootPath)),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    }
  }

  getArtist(id: string, libraryRootPath: string | null): AnimaArtistDetail | null {
    const statement = this.db.prepare<[string], AnimaArtistListRow>(`
      SELECT
        a.id,
        a.name,
        a.post_count,
        a.page_bucket,
        a.uniqueness_score,
        a.image_rel_path,
        CASE WHEN af.artist_id IS NULL THEN 0 ELSE 1 END AS is_favorited,
        GROUP_CONCAT(DISTINCT afi.folder_id) AS folder_ids
      FROM anima_artists a
      LEFT JOIN anima_favorites af ON af.artist_id = a.id
      LEFT JOIN anima_folder_items afi ON afi.artist_id = a.id
      WHERE a.id = ?
      GROUP BY a.id
      LIMIT 1
    `)

    const row = statement.get(id)
    if (!row) {
      return null
    }

    const folderNamesStmt = this.db.prepare<[string], AnimaFolderNameRow>(`
      SELECT afi.folder_id, af.name
      FROM anima_folder_items afi
      INNER JOIN anima_folders af ON af.id = afi.folder_id
      WHERE afi.artist_id = ?
      ORDER BY af.name COLLATE NOCASE ASC
    `)
    const folderRows = folderNamesStmt.all(id)
    const summary = mapArtistRow(row, libraryRootPath)

    return {
      ...summary,
      folderNames: folderRows.map((item) => item.name),
    }
  }

  setFavorite(artistId: string, isFavorited: boolean): boolean {
    if (isFavorited) {
      const statement = this.db.prepare(`
        INSERT INTO anima_favorites (artist_id, created_at)
        VALUES (?, CURRENT_TIMESTAMP)
        ON CONFLICT(artist_id) DO NOTHING
      `)
      statement.run(artistId)
      return true
    }

    this.db.prepare('DELETE FROM anima_favorites WHERE artist_id = ?').run(artistId)
    return true
  }

  listFolders(): AnimaFolder[] {
    const statement = this.db.prepare<[], {
      id: string
      name: string
      artist_count: number
      created_at: string
      updated_at: string
    }>(`
      SELECT
        af.id,
        af.name,
        COUNT(afi.artist_id) AS artist_count,
        af.created_at,
        af.updated_at
      FROM anima_folders af
      LEFT JOIN anima_folder_items afi ON afi.folder_id = af.id
      GROUP BY af.id
      ORDER BY af.name COLLATE NOCASE ASC
    `)

    return statement.all().map((row) => ({
      id: row.id,
      name: row.name,
      artistCount: row.artist_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  }

  saveFolder(input: { id?: string; name: string }): AnimaFolder {
    const id = input.id ?? randomUUID()
    const trimmedName = input.name.trim()

    this.db.prepare(`
      INSERT INTO anima_folders (id, name, created_at, updated_at)
      VALUES (@id, @name, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        updated_at=CURRENT_TIMESTAMP
    `).run({
      id,
      name: trimmedName,
    })

    return this.listFolders().find((folder) => folder.id === id)!
  }

  deleteFolder(id: string): boolean {
    this.db.prepare('DELETE FROM anima_folders WHERE id = ?').run(id)
    return true
  }

  setArtistFolders(artistId: string, folderIds: string[]): boolean {
    const uniqueFolderIds = [...new Set(folderIds.filter(Boolean))]
    const deleteAll = this.db.prepare('DELETE FROM anima_folder_items WHERE artist_id = ?')
    const insertStmt = this.db.prepare(`
      INSERT INTO anima_folder_items (folder_id, artist_id, created_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(folder_id, artist_id) DO NOTHING
    `)

    const tx = this.db.transaction(() => {
      deleteAll.run(artistId)
      for (const folderId of uniqueFolderIds) {
        insertStmt.run(folderId, artistId)
      }
    })

    tx()
    return true
  }

  listArtistsByIds(ids: string[], libraryRootPath: string | null): AnimaArtistSummary[] {
    if (ids.length === 0) {
      return []
    }

    const placeholders = ids.map(() => '?').join(', ')
    const statement = this.db.prepare<string[], AnimaArtistListRow>(`
      SELECT
        a.id,
        a.name,
        a.post_count,
        a.page_bucket,
        a.uniqueness_score,
        a.image_rel_path,
        CASE WHEN af.artist_id IS NULL THEN 0 ELSE 1 END AS is_favorited,
        GROUP_CONCAT(DISTINCT afi.folder_id) AS folder_ids
      FROM anima_artists a
      LEFT JOIN anima_favorites af ON af.artist_id = a.id
      LEFT JOIN anima_folder_items afi ON afi.artist_id = a.id
      WHERE a.id IN (${placeholders})
      GROUP BY a.id
    `)

    const byId = new Map(statement.all(...ids).map((row) => [row.id, mapArtistRow(row, libraryRootPath)]))
    return ids.flatMap((id) => {
      const item = byId.get(id)
      return item ? [item] : []
    })
  }

  listFavoriteArtistIds(): string[] {
    const statement = this.db.prepare<[], { artist_id: string }>(`
      SELECT artist_id
      FROM anima_favorites
      ORDER BY created_at DESC
    `)

    return statement.all().map((row) => row.artist_id)
  }

  listArtistNamePairs(): NameIdRow[] {
    const statement = this.db.prepare<[], NameIdRow>(`
      SELECT id, name
      FROM anima_artists
      ORDER BY name COLLATE NOCASE ASC
    `)

    return statement.all()
  }
}
