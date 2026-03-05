import { ipcMain } from 'electron'

import { IPC_CHANNELS } from '@shared/ipc-channels'
import type { AitagImportResult } from '@shared/types/importer'

import { AitagScraperService } from '../services/scraper/aitag-client'
import { wrapIPC } from './wrap-ipc'

export function registerScraperIPC(): () => void {
  const scraperService = new AitagScraperService()

  const handler = async (_event: Electron.IpcMainInvokeEvent, payload: { input: string }) =>
    wrapIPC<AitagImportResult>(() => scraperService.importByInput(payload.input))

  ipcMain.handle(IPC_CHANNELS.SCRAPER_AITAG_IMPORT, handler)
  ipcMain.handle(IPC_CHANNELS.ENTRY_IMPORT_URL, handler)

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.SCRAPER_AITAG_IMPORT)
    ipcMain.removeHandler(IPC_CHANNELS.ENTRY_IMPORT_URL)
  }
}
