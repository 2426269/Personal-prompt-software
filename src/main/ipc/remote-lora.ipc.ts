import { ipcMain } from 'electron'

import { IPC_CHANNELS } from '@shared/ipc-channels'
import type {
  RemoteModelIndexItem,
  RemoteModelScanProgress,
  RemoteModelScanInput,
  RemoteModelScanResult,
  RemoteProfileInput,
  RemoteProfileSummary,
} from '@shared/types/remote'

import { RemoteLoraService } from '../services/remote/remote-lora.service'
import { wrapIPC } from './wrap-ipc'

export function registerRemoteLoraIPC(): () => void {
  const remoteLoraService = new RemoteLoraService()

  ipcMain.handle(IPC_CHANNELS.REMOTE_PROFILE_LIST, async () =>
    wrapIPC<RemoteProfileSummary[]>(() => remoteLoraService.listProfiles(), { channel: IPC_CHANNELS.REMOTE_PROFILE_LIST }),
  )

  ipcMain.handle(IPC_CHANNELS.REMOTE_PROFILE_GET, async (_event, payload: { id: string }) =>
    wrapIPC<RemoteProfileSummary | null>(() => remoteLoraService.getProfile(payload.id), { channel: IPC_CHANNELS.REMOTE_PROFILE_GET, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.REMOTE_PROFILE_SAVE, async (_event, payload: RemoteProfileInput) =>
    wrapIPC<RemoteProfileSummary>(() => remoteLoraService.saveProfile(payload), { channel: IPC_CHANNELS.REMOTE_PROFILE_SAVE, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.REMOTE_PROFILE_DELETE, async (_event, payload: { id: string }) =>
    wrapIPC<boolean>(() => remoteLoraService.deleteProfile(payload.id), { channel: IPC_CHANNELS.REMOTE_PROFILE_DELETE, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.REMOTE_MODEL_SCAN, async (event, payload: RemoteModelScanInput) =>
    wrapIPC<RemoteModelScanResult>(() => remoteLoraService.scanModels(payload, (progress: RemoteModelScanProgress) => {
      event.sender.send(IPC_CHANNELS.REMOTE_MODEL_SCAN_PROGRESS, progress)
    }), { channel: IPC_CHANNELS.REMOTE_MODEL_SCAN, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.REMOTE_MODEL_INDEX, async (_event, payload: { profileId: string }) =>
    wrapIPC<RemoteModelIndexItem[]>(() => remoteLoraService.getModelIndex(payload.profileId), { channel: IPC_CHANNELS.REMOTE_MODEL_INDEX, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.REMOTE_LORA_SCAN, async (event, payload: RemoteModelScanInput) =>
    wrapIPC<RemoteModelScanResult>(() => remoteLoraService.scanLoras(payload, (progress: RemoteModelScanProgress) => {
      event.sender.send(IPC_CHANNELS.REMOTE_MODEL_SCAN_PROGRESS, progress)
    }), { channel: IPC_CHANNELS.REMOTE_LORA_SCAN, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.REMOTE_LORA_INDEX, async (_event, payload: { profileId: string }) =>
    wrapIPC<RemoteModelIndexItem[]>(() => remoteLoraService.getLoraIndex(payload.profileId), { channel: IPC_CHANNELS.REMOTE_LORA_INDEX, payload }),
  )

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.REMOTE_PROFILE_LIST)
    ipcMain.removeHandler(IPC_CHANNELS.REMOTE_PROFILE_GET)
    ipcMain.removeHandler(IPC_CHANNELS.REMOTE_PROFILE_SAVE)
    ipcMain.removeHandler(IPC_CHANNELS.REMOTE_PROFILE_DELETE)
    ipcMain.removeHandler(IPC_CHANNELS.REMOTE_MODEL_SCAN)
    ipcMain.removeHandler(IPC_CHANNELS.REMOTE_MODEL_INDEX)
    ipcMain.removeHandler(IPC_CHANNELS.REMOTE_LORA_SCAN)
    ipcMain.removeHandler(IPC_CHANNELS.REMOTE_LORA_INDEX)
  }
}
