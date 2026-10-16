import fs from 'node:fs'
import path from 'node:path'

import { app } from 'electron'

import type { AppLogLevel, AppLogModule } from '@shared/types/logs'

import { AppLogsService } from './services/logs/app-logs.service'

let appLogsService: AppLogsService | null = null

function resolveLogDir(): string {
  try {
    return app.getPath('userData')
  } catch {
    return process.cwd()
  }
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\n${error.stack ?? ''}`.trim()
  }

  return String(error)
}

function getAppLogsService(): AppLogsService {
  if (!appLogsService) {
    appLogsService = new AppLogsService()
  }

  return appLogsService
}

export function appendMainLog(fileName: string, message: string): void {
  const logDir = resolveLogDir()
  const logPath = path.join(logDir, fileName)
  fs.mkdirSync(path.dirname(logPath), { recursive: true })
  fs.appendFileSync(logPath, `${new Date().toISOString()} ${message}\n`, 'utf8')
}

export function writeStructuredLog(input: {
  module: AppLogModule
  level: AppLogLevel
  action: string
  summary: string
  entryId?: string | null
  imageIndex?: number | null
  request?: unknown
  response?: unknown
  error?: unknown
  tags?: string[]
}): void {
  try {
    getAppLogsService().write(input)
  } catch {
    // Ignore structured log write failures before database initialization.
  }
}

export function logMainError(scope: string, error: unknown): void {
  appendMainLog('main-process.log', `[${scope}] ${formatUnknownError(error)}`)
  writeStructuredLog({
    module: 'main',
    level: 'error',
    action: scope,
    summary: `主进程异常：${scope}`,
    error,
  })
}
