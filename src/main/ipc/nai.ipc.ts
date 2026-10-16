import { ipcMain } from 'electron'

import { IPC_CHANNELS } from '@shared/ipc-channels'
import type {
  NAIConnectionInput,
  NAIConnectionResult,
  NAISubmitInput,
  NAISubmitResult,
} from '@shared/types/nai'

import { NAIService } from '../services/nai/nai-service'
import { wrapIPC } from './wrap-ipc'

export function registerNaiIPC(): () => void {
  const naiService = new NAIService()

  ipcMain.handle(IPC_CHANNELS.NAI_TEST_CONNECTION, async (_event, payload: NAIConnectionInput) =>
    wrapIPC<NAIConnectionResult>(() => naiService.testConnection(payload), {
      channel: IPC_CHANNELS.NAI_TEST_CONNECTION,
      payload,
    }),
  )

  ipcMain.handle(IPC_CHANNELS.NAI_SUBMIT, async (_event, payload: NAISubmitInput) =>
    wrapIPC<NAISubmitResult>(() => naiService.submit(payload), {
      channel: IPC_CHANNELS.NAI_SUBMIT,
      payload,
    }),
  )

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.NAI_TEST_CONNECTION)
    ipcMain.removeHandler(IPC_CHANNELS.NAI_SUBMIT)
  }
}
