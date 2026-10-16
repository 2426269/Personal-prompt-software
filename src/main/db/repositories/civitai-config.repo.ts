import type { Database } from 'better-sqlite3'
import { safeStorage } from 'electron'

import type { CivitaiConfigInput, CivitaiConfigSummary } from '@shared/types/civitai'

import { getDatabase } from '../database'

interface CivitaiConfigRow {
  id: string
  api_key_encrypted: Buffer | null
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

export class CivitaiConfigRepository {
  private readonly db: Database

  constructor(db: Database = getDatabase()) {
    this.db = db
  }

  get(): CivitaiConfigSummary {
    const row = this.db.prepare<[], CivitaiConfigRow>(`
      SELECT id, api_key_encrypted, created_at, updated_at
      FROM civitai_config
      WHERE id = 'default'
      LIMIT 1
    `).get()

    return {
      hasApiKey: Boolean(row?.api_key_encrypted && row.api_key_encrypted.length > 0),
      updatedAt: row?.updated_at ?? null,
    }
  }

  getApiKey(): string | null {
    const row = this.db.prepare<[], CivitaiConfigRow>(`
      SELECT id, api_key_encrypted, created_at, updated_at
      FROM civitai_config
      WHERE id = 'default'
      LIMIT 1
    `).get()

    return row ? decryptSecret(row.api_key_encrypted) : null
  }

  save(input: CivitaiConfigInput): CivitaiConfigSummary {
    const encrypted = input.apiKey === undefined ? this.getExistingEncrypted() : encryptSecret(input.apiKey)
    this.db.prepare(`
      INSERT INTO civitai_config (id, api_key_encrypted, updated_at)
      VALUES ('default', @api_key_encrypted, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        api_key_encrypted = excluded.api_key_encrypted,
        updated_at = CURRENT_TIMESTAMP
    `).run({ api_key_encrypted: encrypted })

    return this.get()
  }

  private getExistingEncrypted(): Buffer | null {
    const row = this.db.prepare<[], Pick<CivitaiConfigRow, 'api_key_encrypted'>>(`
      SELECT api_key_encrypted
      FROM civitai_config
      WHERE id = 'default'
      LIMIT 1
    `).get()

    return row?.api_key_encrypted ?? null
  }
}
