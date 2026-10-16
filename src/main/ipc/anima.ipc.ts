import { ipcMain } from 'electron'

import { IPC_CHANNELS } from '@shared/ipc-channels'
import type {
  AnimaArtistDetail,
  AnimaArtistFolderUpdateInput,
  AnimaArtistListParams,
  AnimaArtistListResult,
  AnimaExportInput,
  AnimaExportResult,
  AnimaFolder,
  AnimaFolderDeleteInput,
  AnimaFolderSaveInput,
  AnimaImportFavoritesResult,
  AnimaImportInput,
  AnimaImportResult,
  AnimaLibraryStatus,
  AnimaToggleFavoriteInput,
} from '@shared/types/anima'

import { AnimaService } from '../services/anima/anima.service'
import { wrapIPC } from './wrap-ipc'

export function registerAnimaIPC(): () => void {
  const service = new AnimaService()

  ipcMain.handle(IPC_CHANNELS.ANIMA_STATUS, async () =>
    wrapIPC<AnimaLibraryStatus>(() => service.getStatus(), { channel: IPC_CHANNELS.ANIMA_STATUS }),
  )

  ipcMain.handle(IPC_CHANNELS.ANIMA_IMPORT, async (_event, payload?: AnimaImportInput) =>
    wrapIPC<AnimaImportResult>(() => service.importLibrary(payload), { channel: IPC_CHANNELS.ANIMA_IMPORT, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.ANIMA_LIST_ARTISTS, async (_event, payload?: AnimaArtistListParams) =>
    wrapIPC<AnimaArtistListResult>(() => service.listArtists(payload), { channel: IPC_CHANNELS.ANIMA_LIST_ARTISTS, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.ANIMA_GET_ARTIST, async (_event, payload: { id: string }) =>
    wrapIPC<AnimaArtistDetail | null>(() => service.getArtist(payload.id), { channel: IPC_CHANNELS.ANIMA_GET_ARTIST, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.ANIMA_TOGGLE_FAVORITE, async (_event, payload: AnimaToggleFavoriteInput) =>
    wrapIPC<boolean>(() => service.toggleFavorite(payload), { channel: IPC_CHANNELS.ANIMA_TOGGLE_FAVORITE, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.ANIMA_LIST_FOLDERS, async () =>
    wrapIPC<AnimaFolder[]>(() => service.listFolders(), { channel: IPC_CHANNELS.ANIMA_LIST_FOLDERS }),
  )

  ipcMain.handle(IPC_CHANNELS.ANIMA_SAVE_FOLDER, async (_event, payload: AnimaFolderSaveInput) =>
    wrapIPC<AnimaFolder>(() => service.saveFolder(payload), { channel: IPC_CHANNELS.ANIMA_SAVE_FOLDER, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.ANIMA_DELETE_FOLDER, async (_event, payload: AnimaFolderDeleteInput) =>
    wrapIPC<boolean>(() => service.deleteFolder(payload), { channel: IPC_CHANNELS.ANIMA_DELETE_FOLDER, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.ANIMA_SET_ARTIST_FOLDERS, async (_event, payload: AnimaArtistFolderUpdateInput) =>
    wrapIPC<boolean>(() => service.setArtistFolders(payload), { channel: IPC_CHANNELS.ANIMA_SET_ARTIST_FOLDERS, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.ANIMA_EXPORT, async (_event, payload: AnimaExportInput) =>
    wrapIPC<AnimaExportResult>(() => service.exportArtists(payload), { channel: IPC_CHANNELS.ANIMA_EXPORT, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.ANIMA_IMPORT_FAVORITES, async () =>
    wrapIPC<AnimaImportFavoritesResult>(() => service.importFavorites(), { channel: IPC_CHANNELS.ANIMA_IMPORT_FAVORITES }),
  )

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.ANIMA_STATUS)
    ipcMain.removeHandler(IPC_CHANNELS.ANIMA_IMPORT)
    ipcMain.removeHandler(IPC_CHANNELS.ANIMA_LIST_ARTISTS)
    ipcMain.removeHandler(IPC_CHANNELS.ANIMA_GET_ARTIST)
    ipcMain.removeHandler(IPC_CHANNELS.ANIMA_TOGGLE_FAVORITE)
    ipcMain.removeHandler(IPC_CHANNELS.ANIMA_LIST_FOLDERS)
    ipcMain.removeHandler(IPC_CHANNELS.ANIMA_SAVE_FOLDER)
    ipcMain.removeHandler(IPC_CHANNELS.ANIMA_DELETE_FOLDER)
    ipcMain.removeHandler(IPC_CHANNELS.ANIMA_SET_ARTIST_FOLDERS)
    ipcMain.removeHandler(IPC_CHANNELS.ANIMA_EXPORT)
    ipcMain.removeHandler(IPC_CHANNELS.ANIMA_IMPORT_FAVORITES)
  }
}
