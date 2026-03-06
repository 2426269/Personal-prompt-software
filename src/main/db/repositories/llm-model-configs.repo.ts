import { randomUUID } from 'node:crypto'

import type { Database } from 'better-sqlite3'
import { safeStorage } from 'electron'

import type { LLMModelConfigInput, LLMProvider } from '@shared/types/llm'

import { getDatabase } from '../database'

export interface LLMModelConfigRow {
  id: string
  name: string
  provider: LLMProvider
  endpoint: string
  api_key_encrypted: Buffer | null
  model_name: string
  temperature: number
  is_default: number
  created_at: string
  updated_at: string
}

function encryptSecret(value: string | null | undefined): Buffer | null {
  if (!value) {
    return null
  }

  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(value)
  }

  return Buffer.from(value, 'utf8')
}

function decryptSecret(value: Buffer | null): string | null {
  if (!value || value.length === 0) {
    return null
  }

  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.decryptString(value)
  }

  return value.toString('utf8')
}

export class LLMModelConfigsRepository {
  private readonly db: Database

  constructor(db: Database = getDatabase()) {
    this.db = db
  }

  list(): LLMModelConfigRow[] {
    const statement = this.db.prepare<[], LLMModelConfigRow>(`
      SELECT id, name, provider, endpoint, api_key_encrypted, model_name, temperature, is_default, created_at, updated_at
      FROM ai_model_configs
      ORDER BY is_default DESC, updated_at DESC, created_at DESC
    `)

    return statement.all()
  }

  getById(id: string): LLMModelConfigRow | null {
    const statement = this.db.prepare<[string], LLMModelConfigRow>(`
      SELECT id, name, provider, endpoint, api_key_encrypted, model_name, temperature, is_default, created_at, updated_at
      FROM ai_model_configs
      WHERE id = ?
      LIMIT 1
    `)

    return statement.get(id) ?? null
  }

  getDefault(): LLMModelConfigRow | null {
    const statement = this.db.prepare<[], LLMModelConfigRow>(`
      SELECT id, name, provider, endpoint, api_key_encrypted, model_name, temperature, is_default, created_at, updated_at
      FROM ai_model_configs
      WHERE is_default = 1
      LIMIT 1
    `)

    return statement.get() ?? null
  }

  getApiKey(id: string): string | null {
    const row = this.getById(id)
    return row ? decryptSecret(row.api_key_encrypted) : null
  }

  upsert(input: LLMModelConfigInput): string {
    const existing = input.id ? this.getById(input.id) : null
    const id = input.id ?? randomUUID()
    const encryptedSecret = input.apiKey === undefined
      ? (existing?.api_key_encrypted ?? null)
      : encryptSecret(input.apiKey)
    const isDefault = input.isDefault === true ? 1 : 0

    const tx = this.db.transaction(() => {
      if (isDefault === 1) {
        this.db.prepare('UPDATE ai_model_configs SET is_default = 0, updated_at = CURRENT_TIMESTAMP').run()
      }

      this.db.prepare(`
        INSERT INTO ai_model_configs (
          id,
          name,
          provider,
          endpoint,
          api_key_encrypted,
          model_name,
          temperature,
          is_default,
          updated_at
        ) VALUES (
          @id,
          @name,
          @provider,
          @endpoint,
          @api_key_encrypted,
          @model_name,
          @temperature,
          @is_default,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          provider = excluded.provider,
          endpoint = excluded.endpoint,
          api_key_encrypted = excluded.api_key_encrypted,
          model_name = excluded.model_name,
          temperature = excluded.temperature,
          is_default = excluded.is_default,
          updated_at = CURRENT_TIMESTAMP
      `).run({
        id,
        name: input.name,
        provider: input.provider,
        endpoint: input.endpoint,
        api_key_encrypted: encryptedSecret,
        model_name: input.modelName,
        temperature: input.temperature,
        is_default: isDefault,
      })
    })

    tx()
    return id
  }

  delete(id: string): boolean {
    return this.db.prepare('DELETE FROM ai_model_configs WHERE id = ?').run(id).changes > 0
  }
}
