import { ipcMain } from 'electron'

import { IPC_CHANNELS } from '@shared/ipc-channels'
import type {
  AppDataMigrationResult,
  DatabaseBackupExportResult,
  DatabaseBackupImportResult,
  OpenStorageLocationInput,
  OpenStorageLocationResult,
  StorageInfo,
} from '@shared/types/storage'

import { StorageService } from '../services/storage/storage.service'
import { wrapIPC } from './wrap-ipc'

export function registerStorageIPC(): () => void {
  const service = new StorageService()

  ipcMain.handle(IPC_CHANNELS.STORAGE_INFO, async () =>
    wrapIPC<StorageInfo>(() => service.getStorageInfo(), {
      channel: IPC_CHANNELS.STORAGE_INFO,
    }),
  )

  ipcMain.handle(IPC_CHANNELS.STORAGE_EXPORT_DATABASE, async () =>
    wrapIPC<DatabaseBackupExportResult>(() => service.exportDatabaseBackup(), {
      channel: IPC_CHANNELS.STORAGE_EXPORT_DATABASE,
    }),
  )

  ipcMain.handle(IPC_CHANNELS.STORAGE_IMPORT_DATABASE, async () =>
    wrapIPC<DatabaseBackupImportResult>(() => service.importDatabaseBackup(), {
      channel: IPC_CHANNELS.STORAGE_IMPORT_DATABASE,
    }),
  )

  ipcMain.handle(IPC_CHANNELS.STORAGE_MIGRATE_APP_DATA, async () =>
    wrapIPC<AppDataMigrationResult>(() => service.migrateAppDataDirectory(), {
      channel: IPC_CHANNELS.STORAGE_MIGRATE_APP_DATA,
    }),
  )

  ipcMain.handle(IPC_CHANNELS.STORAGE_OPEN_LOCATION, async (_event, payload: OpenStorageLocationInput) =>
    wrapIPC<OpenStorageLocationResult>(() => service.openStorageLocation(payload), {
      channel: IPC_CHANNELS.STORAGE_OPEN_LOCATION,
      payload,
    }),
  )

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.STORAGE_INFO)
    ipcMain.removeHandler(IPC_CHANNELS.STORAGE_EXPORT_DATABASE)
    ipcMain.removeHandler(IPC_CHANNELS.STORAGE_IMPORT_DATABASE)
    ipcMain.removeHandler(IPC_CHANNELS.STORAGE_MIGRATE_APP_DATA)
    ipcMain.removeHandler(IPC_CHANNELS.STORAGE_OPEN_LOCATION)
  }
}
