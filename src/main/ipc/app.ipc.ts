import { ipcMain } from 'electron'

import { IPC_CHANNELS } from '@shared/ipc-channels'
import type { PingPayload } from '@shared/types/ipc'

import { wrapIPC } from './wrap-ipc'

export function registerAppIPC(): () => void {
  ipcMain.handle(IPC_CHANNELS.APP_PING, async () =>
    wrapIPC<PingPayload>(() => ({
      message: 'pong',
      timestamp: new Date().toISOString(),
    })),
  )

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.APP_PING)
  }
}
