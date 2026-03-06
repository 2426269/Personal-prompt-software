import { randomUUID } from 'node:crypto'

import type { Database } from 'better-sqlite3'

import type { PromptTemplateInput, PromptTemplateMode } from '@shared/types/template'

import { getDatabase } from '../database'

export interface PromptTemplateRow {
  id: string
  name: string
  description: string | null
  system_prompt: string
  template_json: string
  mode: PromptTemplateMode
  is_default: number
  created_at: string
  updated_at: string
}

export class PromptTemplatesRepository {
  private readonly db: Database

  constructor(db: Database = getDatabase()) {
    this.db = db
  }

  count(): number {
    const statement = this.db.prepare<[], { count: number }>('SELECT COUNT(*) AS count FROM prompt_templates')
    return statement.get()?.count ?? 0
  }

  list(): PromptTemplateRow[] {
    const statement = this.db.prepare<[], PromptTemplateRow>(`
      SELECT id, name, description, system_prompt, template_json, mode, is_default, created_at, updated_at
      FROM prompt_templates
      ORDER BY is_default DESC, updated_at DESC, created_at DESC
    `)

    return statement.all()
  }

  getById(id: string): PromptTemplateRow | null {
    const statement = this.db.prepare<[string], PromptTemplateRow>(`
      SELECT id, name, description, system_prompt, template_json, mode, is_default, created_at, updated_at
      FROM prompt_templates
      WHERE id = ?
      LIMIT 1
    `)

    return statement.get(id) ?? null
  }

  getDefault(): PromptTemplateRow | null {
    const statement = this.db.prepare<[], PromptTemplateRow>(`
      SELECT id, name, description, system_prompt, template_json, mode, is_default, created_at, updated_at
      FROM prompt_templates
      WHERE is_default = 1
      LIMIT 1
    `)

    return statement.get() ?? null
  }

  upsert(input: PromptTemplateInput): string {
    const id = input.id ?? randomUUID()
    const isDefault = input.isDefault === true ? 1 : 0

    const tx = this.db.transaction(() => {
      if (isDefault === 1) {
        this.db.prepare('UPDATE prompt_templates SET is_default = 0, updated_at = CURRENT_TIMESTAMP').run()
      }

      this.db.prepare(`
        INSERT INTO prompt_templates (
          id,
          name,
          description,
          system_prompt,
          template_json,
          mode,
          is_default,
          updated_at
        ) VALUES (
          @id,
          @name,
          @description,
          @system_prompt,
          @template_json,
          @mode,
          @is_default,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          description = excluded.description,
          system_prompt = excluded.system_prompt,
          template_json = excluded.template_json,
          mode = excluded.mode,
          is_default = excluded.is_default,
          updated_at = CURRENT_TIMESTAMP
      `).run({
        id,
        name: input.name,
        description: input.description ?? null,
        system_prompt: input.systemPrompt,
        template_json: JSON.stringify(input.templateJson ?? []),
        mode: input.mode ?? 'sanitize',
        is_default: isDefault,
      })
    })

    tx()
    return id
  }

  delete(id: string): boolean {
    return this.db.prepare('DELETE FROM prompt_templates WHERE id = ?').run(id).changes > 0
  }
}
