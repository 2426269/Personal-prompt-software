import { randomUUID } from 'node:crypto'

import type { Database } from 'better-sqlite3'

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
}
