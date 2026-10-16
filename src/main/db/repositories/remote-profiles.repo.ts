import { randomUUID } from 'node:crypto'

import type { Database } from 'better-sqlite3'
import { safeStorage } from 'electron'

import type { RemoteProfileInput } from '@shared/types/remote'

import { getDatabase } from '../database'

export interface RemoteProfileRow {
  id: string
  name: string
  comfy_base_url: string
  comfy_history_route: string
  ssh_host: string | null
  ssh_port: number
  ssh_user: string | null
  ssh_password_encrypted: Buffer | null
  comfy_root_path: string | null
  loras_paths: string
  is_default: number
  last_scanned_at: string | null
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

export class RemoteProfilesRepository {
  private readonly db: Database

  constructor(db: Database = getDatabase()) {
    this.db = db
  }

  list(): RemoteProfileRow[] {
    return this.db.prepare<[], RemoteProfileRow>(`
      SELECT
        id,
        name,
        comfy_base_url,
        comfy_history_route,
        ssh_host,
        ssh_port,
        ssh_user,
        ssh_password_encrypted,
        comfy_root_path,
        loras_paths,
        is_default,
        last_scanned_at,
        created_at,
        updated_at
      FROM remote_profiles
      ORDER BY is_default DESC, updated_at DESC, created_at DESC
    `).all()
  }

  getById(id: string): RemoteProfileRow | null {
    return this.db.prepare<[string], RemoteProfileRow>(`
      SELECT
        id,
        name,
        comfy_base_url,
        comfy_history_route,
        ssh_host,
        ssh_port,
        ssh_user,
        ssh_password_encrypted,
        comfy_root_path,
        loras_paths,
        is_default,
        last_scanned_at,
        created_at,
        updated_at
      FROM remote_profiles
      WHERE id = ?
      LIMIT 1
    `).get(id) ?? null
  }

  getDefault(): RemoteProfileRow | null {
    return this.db.prepare<[], RemoteProfileRow>(`
      SELECT
        id,
        name,
        comfy_base_url,
        comfy_history_route,
        ssh_host,
        ssh_port,
        ssh_user,
        ssh_password_encrypted,
        comfy_root_path,
        loras_paths,
        is_default,
        last_scanned_at,
        created_at,
        updated_at
      FROM remote_profiles
      WHERE is_default = 1
      LIMIT 1
    `).get() ?? null
  }

  getPassword(id: string): string | null {
    const row = this.getById(id)
    return row ? decryptSecret(row.ssh_password_encrypted) : null
  }

  upsert(input: RemoteProfileInput): string {
    const existing = input.id ? this.getById(input.id) : null
    const id = input.id ?? randomUUID()
    const encryptedPassword = input.sshPassword === undefined
      ? (existing?.ssh_password_encrypted ?? null)
      : encryptSecret(input.sshPassword)
    const isDefault = input.isDefault === true ? 1 : 0

    const transaction = this.db.transaction(() => {
      if (isDefault === 1) {
        this.db.prepare('UPDATE remote_profiles SET is_default = 0, updated_at = CURRENT_TIMESTAMP').run()
      }

      this.db.prepare(`
        INSERT INTO remote_profiles (
          id,
          name,
          comfy_base_url,
          comfy_history_route,
          ssh_host,
          ssh_port,
          ssh_user,
          ssh_password_encrypted,
          comfy_root_path,
          loras_paths,
          is_default,
          updated_at
        ) VALUES (
          @id,
          @name,
          @comfy_base_url,
          @comfy_history_route,
          @ssh_host,
          @ssh_port,
          @ssh_user,
          @ssh_password_encrypted,
          @comfy_root_path,
          @loras_paths,
          @is_default,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          comfy_base_url = excluded.comfy_base_url,
          comfy_history_route = excluded.comfy_history_route,
          ssh_host = excluded.ssh_host,
          ssh_port = excluded.ssh_port,
          ssh_user = excluded.ssh_user,
          ssh_password_encrypted = excluded.ssh_password_encrypted,
          comfy_root_path = excluded.comfy_root_path,
          loras_paths = excluded.loras_paths,
          is_default = excluded.is_default,
          updated_at = CURRENT_TIMESTAMP
      `).run({
        id,
        name: input.name,
        comfy_base_url: input.comfyBaseUrl,
        comfy_history_route: input.comfyHistoryRoute ?? '/history',
        ssh_host: input.sshHost?.trim() || null,
        ssh_port: input.sshPort,
        ssh_user: input.sshUser?.trim() || null,
        ssh_password_encrypted: encryptedPassword,
        comfy_root_path: input.comfyRootPath?.trim() || null,
        loras_paths: JSON.stringify(input.lorasPaths),
        is_default: isDefault,
      })
    })

    transaction()
    return id
  }

  delete(id: string): boolean {
    return this.db.prepare('DELETE FROM remote_profiles WHERE id = ?').run(id).changes > 0
  }

  setLastScannedAt(id: string, value: string): boolean {
    return this.db.prepare(`
      UPDATE remote_profiles
      SET last_scanned_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(value, id).changes > 0
  }
}
