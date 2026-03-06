import { randomUUID } from 'node:crypto'

import type { Database } from 'better-sqlite3'

import type { EntryTagAssignInput, UserTagInput } from '@shared/types/tag'

import { getDatabase } from '../database'

export interface UserTagRow {
  id: string
  name: string
  color: string
  created_at: string
  updated_at: string | null
}

export class TagsRepository {
  private readonly db: Database

  constructor(db: Database = getDatabase()) {
    this.db = db
  }

  list(): UserTagRow[] {
    const statement = this.db.prepare<[], UserTagRow>(`
      SELECT id, name, color, created_at, updated_at
      FROM user_tags
      ORDER BY name COLLATE NOCASE ASC
    `)

    return statement.all()
  }

  getByEntryId(entryId: string): UserTagRow[] {
    const statement = this.db.prepare<[string], UserTagRow>(`
      SELECT ut.id, ut.name, ut.color, ut.created_at, ut.updated_at
      FROM entry_tags et
      INNER JOIN user_tags ut ON ut.id = et.tag_id
      WHERE et.entry_id = ?
      ORDER BY ut.name COLLATE NOCASE ASC
    `)

    return statement.all(entryId)
  }

  create(input: UserTagInput): string {
    const id = input.id ?? randomUUID()
    this.db.prepare(`
      INSERT INTO user_tags (id, name, color, updated_at)
      VALUES (@id, @name, @color, CURRENT_TIMESTAMP)
    `).run({
      id,
      name: input.name,
      color: input.color,
    })

    return id
  }

  update(input: UserTagInput): boolean {
    if (!input.id) {
      return false
    }

    const result = this.db.prepare(`
      UPDATE user_tags
      SET name = @name, color = @color, updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run({
      id: input.id,
      name: input.name,
      color: input.color,
    })

    return result.changes > 0
  }

  delete(id: string): boolean {
    return this.db.prepare('DELETE FROM user_tags WHERE id = ?').run(id).changes > 0
  }

  assignToEntry(input: EntryTagAssignInput): void {
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM entry_tags WHERE entry_id = ?').run(input.entryId)

      const insertStatement = this.db.prepare(`
        INSERT INTO entry_tags (entry_id, tag_id)
        VALUES (?, ?)
      `)

      for (const tagId of input.tagIds) {
        insertStatement.run(input.entryId, tagId)
      }
    })

    tx()
  }
}
