import { contextBridge } from 'electron'

import type { AppIPC } from '@shared/types/ipc'

const api: AppIPC = {
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node,
  },
}

contextBridge.exposeInMainWorld('api', api)
