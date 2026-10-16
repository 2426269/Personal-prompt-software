import { ipcMain } from 'electron'

import { IPC_CHANNELS } from '@shared/ipc-channels'
import type {
  CivitaiConfigSummary,
  CivitaiConfigInput,
  CivitaiConfigTestResult,
  CivitaiModelMatch,
  CivitaiSearchInput,
} from '@shared/types/civitai'

import { CivitaiService } from '../services/civitai/civitai.service'
import { wrapIPC } from './wrap-ipc'

export function registerCivitaiIPC(): () => void {
  const civitaiService = new CivitaiService()

  ipcMain.handle(IPC_CHANNELS.CIVITAI_CONFIG_GET, async () =>
    wrapIPC<CivitaiConfigSummary>(() => civitaiService.getConfig(), { channel: IPC_CHANNELS.CIVITAI_CONFIG_GET }),
  )

  ipcMain.handle(IPC_CHANNELS.CIVITAI_CONFIG_SAVE, async (_event, payload: CivitaiConfigInput) =>
    wrapIPC<CivitaiConfigSummary>(() => civitaiService.saveConfig(payload), { channel: IPC_CHANNELS.CIVITAI_CONFIG_SAVE, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.CIVITAI_CONFIG_TEST, async () =>
    wrapIPC<CivitaiConfigTestResult>(() => civitaiService.testConfig(), { channel: IPC_CHANNELS.CIVITAI_CONFIG_TEST }),
  )

  ipcMain.handle(IPC_CHANNELS.CIVITAI_GET_BY_HASH, async (_event, payload: CivitaiSearchInput) =>
    wrapIPC<CivitaiModelMatch | null>(() => civitaiService.getByHash(payload), { channel: IPC_CHANNELS.CIVITAI_GET_BY_HASH, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.CIVITAI_GET_BY_VERSION, async (_event, payload: CivitaiSearchInput) =>
    wrapIPC<CivitaiModelMatch | null>(() => civitaiService.getByVersion(payload), { channel: IPC_CHANNELS.CIVITAI_GET_BY_VERSION, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.CIVITAI_SEARCH_MODEL, async (_event, payload: CivitaiSearchInput) =>
    wrapIPC<CivitaiModelMatch | null>(() => civitaiService.searchModel(payload), { channel: IPC_CHANNELS.CIVITAI_SEARCH_MODEL, payload }),
  )

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.CIVITAI_CONFIG_GET)
    ipcMain.removeHandler(IPC_CHANNELS.CIVITAI_CONFIG_SAVE)
    ipcMain.removeHandler(IPC_CHANNELS.CIVITAI_CONFIG_TEST)
    ipcMain.removeHandler(IPC_CHANNELS.CIVITAI_GET_BY_HASH)
    ipcMain.removeHandler(IPC_CHANNELS.CIVITAI_GET_BY_VERSION)
    ipcMain.removeHandler(IPC_CHANNELS.CIVITAI_SEARCH_MODEL)
  }
}
