import { ipcMain } from 'electron'

import { IPC_CHANNELS } from '@shared/ipc-channels'
import type {
    ImageCacheCleanupInput,
    ImageCacheCleanupResult,
    ImageCacheStatus,
} from '@shared/types/image-cache'

import { ImageCacheService } from '../services/cache/image-cache.service'
import { wrapIPC } from './wrap-ipc'

export function registerImageCacheIPC(): () => void {
  const imageCacheService = new ImageCacheService()

  ipcMain.handle(IPC_CHANNELS.IMAGE_CACHE_STATUS, async () =>
    wrapIPC<ImageCacheStatus>(() => imageCacheService.getStatus(), { channel: IPC_CHANNELS.IMAGE_CACHE_STATUS }),
  )

  ipcMain.handle(IPC_CHANNELS.IMAGE_CACHE_CLEANUP, async (_event, payload: ImageCacheCleanupInput) =>
    wrapIPC<ImageCacheCleanupResult>(() => imageCacheService.cleanup(payload), { channel: IPC_CHANNELS.IMAGE_CACHE_CLEANUP, payload }),
  )

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.IMAGE_CACHE_STATUS)
    ipcMain.removeHandler(IPC_CHANNELS.IMAGE_CACHE_CLEANUP)
  }
}
