import fs from 'node:fs'
import path from 'node:path'

import { app } from 'electron'

interface StorageBootstrapConfig {
  userDataPath?: string
}

const DEFAULT_USER_DATA_BASENAME = 'promptforge'
const STORAGE_BOOTSTRAP_FILE = 'promptforge-storage.json'

function getAppDataPath(): string {
  return app.getPath('appData')
}

export function getDefaultUserDataPath(): string {
  return path.join(getAppDataPath(), DEFAULT_USER_DATA_BASENAME)
}

export function getStorageBootstrapPath(): string {
  return path.join(getAppDataPath(), STORAGE_BOOTSTRAP_FILE)
}

function readBootstrapConfig(): StorageBootstrapConfig | null {
  const configPath = getStorageBootstrapPath()
  if (!fs.existsSync(configPath)) {
    return null
  }

  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8')) as StorageBootstrapConfig
  } catch {
    return null
  }
}

export function resolveConfiguredUserDataPath(): string {
  const configured = readBootstrapConfig()?.userDataPath?.trim()
  return configured || getDefaultUserDataPath()
}

export function applyConfiguredUserDataPath(): string {
  const targetPath = resolveConfiguredUserDataPath()
  app.setPath('userData', targetPath)
  return targetPath
}

export function persistConfiguredUserDataPath(targetPath: string | null): void {
  const configPath = getStorageBootstrapPath()
  const defaultUserDataPath = getDefaultUserDataPath()

  if (!targetPath || path.resolve(targetPath) === path.resolve(defaultUserDataPath)) {
    fs.rmSync(configPath, { force: true })
    return
  }

  fs.mkdirSync(path.dirname(configPath), { recursive: true })
  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        userDataPath: targetPath,
      },
      null,
      2,
    ),
    'utf8',
  )
}
