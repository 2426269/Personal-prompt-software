import { randomUUID } from 'node:crypto'

import type { Database } from 'better-sqlite3'

import type { EntryListParams, EntrySortBy, EntrySortOrder, EntryUpdateInput } from '@shared/types/entry'

import { getDatabase } from '../database'

export interface UpsertEntryInput {
  entryId?: string
  pixivId: string
  authorId: string
  authorName?: string | null
  title: string
  caption: string
  type: 'NAI' | 'SD' | 'ComfyUI'
  tags: string[]
  sourceUrl: string
  postDate: string | null
  views: number | null
  bookmarks: number | null
  rawJson: string
}

interface ExistingEntryRow {
  id: string
}

export interface EntryListRow {
  id: string
  pixiv_id: string | null
  author_id: string | null
  author_name: string | null
  title: string
  custom_name: string | null
  caption: string
  type: 'NAI' | 'SD' | 'ComfyUI'
  tags: string | null
  source_url: string | null
  post_date: string | null
  views: number
  bookmarks: number
  is_favorited: number
  deleted_at: string | null
  created_at: string
  updated_at: string
  image_count: number
  cover_original_url: string | null
  cover_local_path: string | null
  cover_ai_json: string | null
  cover_prompt_text: string | null
}

export interface EntryDetailRow {
  id: string
  pixiv_id: string | null
  author_id: string | null
  author_name: string | null
  title: string
  custom_name: string | null
  caption: string
  type: 'NAI' | 'SD' | 'ComfyUI'
  tags: string | null
  source_url: string | null
  post_date: string | null
  views: number
  bookmarks: number
  is_favorited: number
  raw_json: string
  deleted_at: string | null
  created_at: string
  updated_at: string
}

const SORT_COLUMN_MAP: Record<EntrySortBy, string> = {
  bookmarks: 'e.bookmarks',
  created_at: 'e.created_at',
  post_date: 'e.post_date',
  updated_at: 'e.updated_at',
  views: 'e.views',
}

const SORT_ORDER_MAP: Record<EntrySortOrder, string> = {
  asc: 'ASC',
  desc: 'DESC',
}

export class EntriesRepository {
  private readonly db: Database

  constructor(db: Database = getDatabase()) {
    this.db = db
  }

  findByPixivId(pixivId: string): ExistingEntryRow | null {
    const stmt = this.db.prepare<[string], ExistingEntryRow>(
      'SELECT id FROM entries WHERE pixiv_id = ? LIMIT 1',
    )
    return stmt.get(pixivId) ?? null
  }

  upsert(input: UpsertEntryInput): string {
    const existing = input.pixivId ? this.findByPixivId(input.pixivId) : null
    const entryId = input.entryId ?? existing?.id ?? randomUUID()

    const statement = this.db.prepare(
      `
      INSERT INTO entries (
        id,
        pixiv_id,
        author_id,
        author_name,
        title,
        caption,
        type,
        tags,
        source_url,
        post_date,
        views,
        bookmarks,
        raw_json,
        updated_at
      ) VALUES (
        @id,
        @pixiv_id,
        @author_id,
        @author_name,
        @title,
        @caption,
        @type,
        @tags,
        @source_url,
        @post_date,
        @views,
        @bookmarks,
        @raw_json,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT(id) DO UPDATE SET
        pixiv_id=excluded.pixiv_id,
        author_id=excluded.author_id,
        author_name=excluded.author_name,
        title=excluded.title,
        caption=excluded.caption,
        type=excluded.type,
        tags=excluded.tags,
        source_url=excluded.source_url,
        post_date=excluded.post_date,
        views=excluded.views,
        bookmarks=excluded.bookmarks,
        raw_json=excluded.raw_json,
        deleted_at=NULL,
        updated_at=CURRENT_TIMESTAMP
      `,
    )

    statement.run({
      id: entryId,
      pixiv_id: input.pixivId,
      author_id: input.authorId,
      author_name: input.authorName ?? null,
      title: input.title,
      caption: input.caption,
      type: input.type,
      tags: JSON.stringify(input.tags),
      source_url: input.sourceUrl,
      post_date: input.postDate,
      views: input.views ?? 0,
      bookmarks: input.bookmarks ?? 0,
      raw_json: input.rawJson,
    })

    return entryId
  }

  list(params: EntryListParams): { rows: EntryListRow[]; total: number } {
    const page = Math.max(1, params.page)
    const pageSize = Math.min(200, Math.max(1, params.pageSize))
    const offset = (page - 1) * pageSize
    const sortColumn = SORT_COLUMN_MAP[params.sortBy] ?? SORT_COLUMN_MAP.created_at
    const sortOrder = SORT_ORDER_MAP[params.sortOrder] ?? SORT_ORDER_MAP.desc
    const includeDeleted = params.includeDeleted === true
    const whereClause = includeDeleted ? '1=1' : 'e.deleted_at IS NULL'

    const countStatement = this.db.prepare<[], { total: number }>(
      `SELECT COUNT(*) AS total FROM entries e WHERE ${whereClause}`,
    )
    const total = countStatement.get()?.total ?? 0

    const listStatement = this.db.prepare<[number, number], EntryListRow>(`
      SELECT
        e.id,
        e.pixiv_id,
        e.author_id,
        e.author_name,
        e.title,
        e.custom_name,
        e.caption,
        e.type,
        e.tags,
        e.source_url,
        e.post_date,
        e.views,
        e.bookmarks,
        e.is_favorited,
        e.deleted_at,
        e.created_at,
        e.updated_at,
        (
          SELECT COUNT(*) FROM images i WHERE i.entry_id = e.id
        ) AS image_count,
        (
          SELECT i.original_url FROM images i WHERE i.entry_id = e.id ORDER BY i.image_index ASC LIMIT 1
        ) AS cover_original_url,
        (
          SELECT i.local_path FROM images i WHERE i.entry_id = e.id ORDER BY i.image_index ASC LIMIT 1
        ) AS cover_local_path,
        (
          SELECT i.ai_json FROM images i WHERE i.entry_id = e.id ORDER BY i.image_index ASC LIMIT 1
        ) AS cover_ai_json,
        (
          SELECT i.prompt_text FROM images i WHERE i.entry_id = e.id ORDER BY i.image_index ASC LIMIT 1
        ) AS cover_prompt_text
      FROM entries e
      WHERE ${whereClause}
      ORDER BY ${sortColumn} ${sortOrder}, e.created_at DESC
      LIMIT ? OFFSET ?
    `)

    return {
      rows: listStatement.all(pageSize, offset),
      total,
    }
  }

  getById(id: string): EntryDetailRow | null {
    const statement = this.db.prepare<[string], EntryDetailRow>(`
      SELECT
        e.id,
        e.pixiv_id,
        e.author_id,
        e.author_name,
        e.title,
        e.custom_name,
        e.caption,
        e.type,
        e.tags,
        e.source_url,
        e.post_date,
        e.views,
        e.bookmarks,
        e.is_favorited,
        e.raw_json,
        e.deleted_at,
        e.created_at,
        e.updated_at
      FROM entries e
      WHERE e.id = ?
      LIMIT 1
    `)

    return statement.get(id) ?? null
  }

  listUserTags(id: string): string[] {
    const statement = this.db.prepare<[string], { name: string }>(`
      SELECT ut.name
      FROM entry_tags et
      INNER JOIN user_tags ut ON ut.id = et.tag_id
      WHERE et.entry_id = ?
      ORDER BY ut.name ASC
    `)

    return statement.all(id).map((row) => row.name)
  }

  update(input: EntryUpdateInput): boolean {
    const updates: string[] = []
    const values: Record<string, string | number | null> = { id: input.id }

    if (input.customName !== undefined) {
      updates.push('custom_name = @custom_name')
      values.custom_name = input.customName
    }

    if (input.isFavorited !== undefined) {
      const favoritedValue = input.isFavorited ? 1 : 0
      updates.push('is_favorited = @is_favorited')
      updates.push('is_favorite = @is_favorite')
      values.is_favorited = favoritedValue
      values.is_favorite = favoritedValue
    }

    if (updates.length === 0) {
      return false
    }

    updates.push('updated_at = CURRENT_TIMESTAMP')

    const statement = this.db.prepare(`
      UPDATE entries
      SET ${updates.join(', ')}
      WHERE id = @id
    `)

    const result = statement.run(values)
    return result.changes > 0
  }

  softDelete(id: string): boolean {
    const statement = this.db.prepare(
      'UPDATE entries SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    )
    return statement.run(id).changes > 0
  }

  hardDelete(id: string): boolean {
    const statement = this.db.prepare('DELETE FROM entries WHERE id = ?')
    return statement.run(id).changes > 0
  }
}
