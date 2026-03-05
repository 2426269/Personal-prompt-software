import { contextBridge, ipcRenderer } from 'electron'

import { IPC_CHANNELS } from '@shared/ipc-channels'
import type { AppIPC } from '@shared/types/ipc'

const api: AppIPC = {
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node,
  },
  ping: async () =>
    ipcRenderer.invoke(IPC_CHANNELS.APP_PING) as ReturnType<AppIPC['ping']>,
}

contextBridge.exposeInMainWorld('api', api)
