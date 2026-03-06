import { ipcMain } from 'electron'

import { IPC_CHANNELS } from '@shared/ipc-channels'
import type {
  ImageCacheCleanupInput,
  ImageCacheCleanupResult,
  ImageCacheStatus,
} from '@shared/types/image-cache'

import { ImageCacheService } from '../services/cache/image-cache.service'
import { wrapIPC } from './wrap-ipc'

const imageCacheService = new ImageCacheService()

export function registerImageCacheIPC(): () => void {
  ipcMain.handle(IPC_CHANNELS.IMAGE_CACHE_STATUS, async () =>
    wrapIPC<ImageCacheStatus>(() => imageCacheService.getStatus()),
  )

  ipcMain.handle(IPC_CHANNELS.IMAGE_CACHE_CLEANUP, async (_event, payload: ImageCacheCleanupInput) =>
    wrapIPC<ImageCacheCleanupResult>(() => imageCacheService.cleanup(payload)),
  )

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.IMAGE_CACHE_STATUS)
    ipcMain.removeHandler(IPC_CHANNELS.IMAGE_CACHE_CLEANUP)
  }
}
