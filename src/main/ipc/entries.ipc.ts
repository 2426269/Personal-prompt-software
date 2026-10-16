import { ipcMain } from 'electron'

import { IPC_CHANNELS } from '@shared/ipc-channels'
import type {
    EntryDeleteInput,
    EntryDeleteResult,
    EntryDetail,
    EntryListParams,
    EntryListResult,
    EntryUpdateInput,
} from '@shared/types/entry'

import { EntriesService } from '../services/entries/entries.service'
import { wrapIPC } from './wrap-ipc'

export function registerEntriesIPC(): () => void {
  const entriesService = new EntriesService()

  ipcMain.handle(IPC_CHANNELS.DB_ENTRIES_LIST, async (_event, payload: EntryListParams) =>
    wrapIPC<EntryListResult>(() => entriesService.list(payload), { channel: IPC_CHANNELS.DB_ENTRIES_LIST, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.DB_ENTRIES_GET, async (_event, payload: { id: string }) =>
    wrapIPC<EntryDetail | null>(() => entriesService.get(payload.id), { channel: IPC_CHANNELS.DB_ENTRIES_GET, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.DB_ENTRIES_UPDATE, async (_event, payload: EntryUpdateInput) =>
    wrapIPC<boolean>(() => entriesService.update(payload), { channel: IPC_CHANNELS.DB_ENTRIES_UPDATE, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.DB_ENTRIES_DELETE, async (_event, payload: EntryDeleteInput) =>
    wrapIPC<EntryDeleteResult>(() => entriesService.delete(payload), { channel: IPC_CHANNELS.DB_ENTRIES_DELETE, payload }),
  )

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.DB_ENTRIES_LIST)
    ipcMain.removeHandler(IPC_CHANNELS.DB_ENTRIES_GET)
    ipcMain.removeHandler(IPC_CHANNELS.DB_ENTRIES_UPDATE)
    ipcMain.removeHandler(IPC_CHANNELS.DB_ENTRIES_DELETE)
  }
}
