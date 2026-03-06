import { randomUUID } from 'node:crypto'

import type { Database } from 'better-sqlite3'

import type { AitagImage } from '@shared/types/importer'

import { getDatabase } from '../database'

export interface ImageLocalPathRow {
  local_path: string | null
}

export class ImagesRepository {
  private readonly db: Database

  constructor(db: Database = getDatabase()) {
    this.db = db
  }

  replaceForEntry(entryId: string, images: AitagImage[]): void {
    const deleteStatement = this.db.prepare('DELETE FROM images WHERE entry_id = ?')
    const insertStatement = this.db.prepare(
      `
      INSERT INTO images (
        id,
        entry_id,
        image_index,
        original_url,
        local_path,
        ai_json,
        prompt_text
      ) VALUES (
        @id,
        @entry_id,
        @image_index,
        @original_url,
        @local_path,
        @ai_json,
        @prompt_text
      )
      `,
    )

    const tx = this.db.transaction(() => {
      deleteStatement.run(entryId)

      for (const image of images) {
        insertStatement.run({
          id: randomUUID(),
          entry_id: entryId,
          image_index: image.index,
          original_url: image.originalUrl,
          local_path: image.localPath,
          ai_json: image.aiJson,
          prompt_text: image.promptText,
        })
      }
    })

    tx()
  }

  listByEntryId(entryId: string): AitagImage[] {
    const statement = this.db.prepare<
      [string],
      {
        image_index: number
        ai_json: string | null
        prompt_text: string | null
        original_url: string | null
        local_path: string | null
      }
    >(`
      SELECT image_index, ai_json, prompt_text, original_url, local_path
      FROM images
      WHERE entry_id = ?
      ORDER BY image_index ASC
    `)

    return statement.all(entryId).map((row) => ({
      index: row.image_index,
      aiJson: row.ai_json ?? '',
      promptText: row.prompt_text ?? '',
      originalUrl: row.original_url ?? '',
      localPath: row.local_path,
    }))
  }

  listLocalPaths(): string[] {
    const statement = this.db.prepare<[], ImageLocalPathRow>(`
      SELECT local_path
      FROM images
      WHERE local_path IS NOT NULL AND local_path != ''
    `)

    return statement
      .all()
      .flatMap((row) => (typeof row.local_path === 'string' && row.local_path.length > 0 ? [row.local_path] : []))
  }

  clearLocalPaths(paths: string[]): number {
    if (paths.length === 0) {
      return 0
    }

    const placeholders = paths.map(() => '?').join(', ')
    const statement = this.db.prepare(`
      UPDATE images
      SET local_path = NULL
      WHERE local_path IN (${placeholders})
    `)

    return statement.run(...paths).changes
  }

  clearAllLocalPaths(): number {
    const statement = this.db.prepare(`
      UPDATE images
      SET local_path = NULL
      WHERE local_path IS NOT NULL AND local_path != ''
    `)

    return statement.run().changes
  }
}
