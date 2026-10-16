import { ipcMain } from 'electron'

import { IPC_CHANNELS } from '@shared/ipc-channels'
import type {
  ComfyCancelInput,
  ComfyCancelResult,
  ComfyConnectionInput,
  ComfyConnectionResult,
  ComfyQueueStatusInput,
  ComfyQueueStatusResult,
  ComfySubmitInput,
  ComfySubmitResult,
} from '@shared/types/comfy'

import { ComfyService } from '../services/comfy/comfy-service'
import { wrapIPC } from './wrap-ipc'

export function registerComfyIPC(): () => void {
  const comfyService = new ComfyService()

  ipcMain.handle(IPC_CHANNELS.COMFY_TEST_CONNECTION, async (_event, payload: ComfyConnectionInput) =>
    wrapIPC<ComfyConnectionResult>(() => comfyService.testConnection(payload), { channel: IPC_CHANNELS.COMFY_TEST_CONNECTION, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.COMFY_SUBMIT, async (_event, payload: ComfySubmitInput) =>
    wrapIPC<ComfySubmitResult>(() => comfyService.submit(payload), { channel: IPC_CHANNELS.COMFY_SUBMIT, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.COMFY_STATUS, async (_event, payload: ComfyQueueStatusInput) =>
    wrapIPC<ComfyQueueStatusResult>(() => comfyService.getQueueStatus(payload), { channel: IPC_CHANNELS.COMFY_STATUS, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.COMFY_CANCEL, async (_event, payload: ComfyCancelInput) =>
    wrapIPC<ComfyCancelResult>(() => comfyService.cancel(payload), { channel: IPC_CHANNELS.COMFY_CANCEL, payload }),
  )

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.COMFY_TEST_CONNECTION)
    ipcMain.removeHandler(IPC_CHANNELS.COMFY_SUBMIT)
    ipcMain.removeHandler(IPC_CHANNELS.COMFY_STATUS)
    ipcMain.removeHandler(IPC_CHANNELS.COMFY_CANCEL)
  }
}
