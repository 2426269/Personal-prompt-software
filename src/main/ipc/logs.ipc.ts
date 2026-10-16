import { ipcMain } from 'electron'

import { IPC_CHANNELS } from '@shared/ipc-channels'
import type {
  AppLogClearInput,
  AppLogClearResult,
  AppLogDetailInput,
  AppLogExportInput,
  AppLogExportResult,
  AppLogListInput,
  AppLogListResult,
  AppLogRecord,
  AppLogSummary,
} from '@shared/types/logs'

import { AppLogsService } from '../services/logs/app-logs.service'
import { wrapIPC } from './wrap-ipc'

export function registerLogsIPC(): () => void {
  const logsService = new AppLogsService()

  ipcMain.handle(IPC_CHANNELS.LOGS_LIST, async (_event, payload?: AppLogListInput) =>
    wrapIPC<AppLogListResult>(() => logsService.list(payload ?? {}), { channel: IPC_CHANNELS.LOGS_LIST, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.LOGS_GET, async (_event, payload: AppLogDetailInput) =>
    wrapIPC<AppLogRecord | null>(() => logsService.get(payload.id), { channel: IPC_CHANNELS.LOGS_GET, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.LOGS_SUMMARY, async (_event, payload?: AppLogListInput) =>
    wrapIPC<AppLogSummary>(() => logsService.getSummary(payload ?? {}), { channel: IPC_CHANNELS.LOGS_SUMMARY, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.LOGS_CLEAR, async (_event, payload?: AppLogClearInput) =>
    wrapIPC<AppLogClearResult>(() => logsService.clear(payload ?? {}), { channel: IPC_CHANNELS.LOGS_CLEAR, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.LOGS_EXPORT, async (_event, payload: AppLogExportInput) =>
    wrapIPC<AppLogExportResult>(() => logsService.export(payload), { channel: IPC_CHANNELS.LOGS_EXPORT, payload }),
  )

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.LOGS_LIST)
    ipcMain.removeHandler(IPC_CHANNELS.LOGS_GET)
    ipcMain.removeHandler(IPC_CHANNELS.LOGS_SUMMARY)
    ipcMain.removeHandler(IPC_CHANNELS.LOGS_CLEAR)
    ipcMain.removeHandler(IPC_CHANNELS.LOGS_EXPORT)
  }
}
