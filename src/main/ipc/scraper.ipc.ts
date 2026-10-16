import { ipcMain } from 'electron'

import { IPC_CHANNELS } from '@shared/ipc-channels'
import type { AitagImportResult } from '@shared/types/importer'

import { AitagScraperService } from '../services/scraper/aitag-client'
import { wrapIPC } from './wrap-ipc'

export function registerScraperIPC(): () => void {
  const scraperService = new AitagScraperService()

  const handler = async (
    channel: typeof IPC_CHANNELS.SCRAPER_AITAG_IMPORT | typeof IPC_CHANNELS.ENTRY_IMPORT_URL,
    _event: Electron.IpcMainInvokeEvent,
    payload: { input: string },
  ) =>
    wrapIPC<AitagImportResult>(() => scraperService.importByInput(payload.input), { channel, payload })

  ipcMain.handle(IPC_CHANNELS.SCRAPER_AITAG_IMPORT, async (event, payload: { input: string }) =>
    handler(IPC_CHANNELS.SCRAPER_AITAG_IMPORT, event, payload),
  )
  ipcMain.handle(IPC_CHANNELS.ENTRY_IMPORT_URL, async (event, payload: { input: string }) =>
    handler(IPC_CHANNELS.ENTRY_IMPORT_URL, event, payload),
  )

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.SCRAPER_AITAG_IMPORT)
    ipcMain.removeHandler(IPC_CHANNELS.ENTRY_IMPORT_URL)
  }
}
