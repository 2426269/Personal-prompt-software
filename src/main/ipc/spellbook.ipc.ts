import { ipcMain } from 'electron'

import { IPC_CHANNELS } from '@shared/ipc-channels'
import type {
  SpellbookEntryDetail,
  SpellbookEntrySummary,
  SpellbookLibraryStatus,
  SpellbookListParams,
  SpellbookSyncResult,
} from '@shared/types/spellbook'

import { SpellbookService } from '../services/spellbook/spellbook.service'
import { wrapIPC } from './wrap-ipc'

export function registerSpellbookIPC(): () => void {
  const service = new SpellbookService()

  ipcMain.handle(IPC_CHANNELS.SPELLBOOK_STATUS, async () =>
    wrapIPC<SpellbookLibraryStatus>(() => service.getStatus(), { channel: IPC_CHANNELS.SPELLBOOK_STATUS }),
  )

  ipcMain.handle(IPC_CHANNELS.SPELLBOOK_SYNC, async () =>
    wrapIPC<SpellbookSyncResult>(() => service.syncLibrary(), { channel: IPC_CHANNELS.SPELLBOOK_SYNC }),
  )

  ipcMain.handle(IPC_CHANNELS.SPELLBOOK_LIST, async (_event, payload?: SpellbookListParams) =>
    wrapIPC<SpellbookEntrySummary[]>(() => service.listEntries(payload), { channel: IPC_CHANNELS.SPELLBOOK_LIST, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.SPELLBOOK_GET, async (_event, payload: { id: string }) =>
    wrapIPC<SpellbookEntryDetail | null>(() => service.getEntry(payload.id), { channel: IPC_CHANNELS.SPELLBOOK_GET, payload }),
  )

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.SPELLBOOK_STATUS)
    ipcMain.removeHandler(IPC_CHANNELS.SPELLBOOK_SYNC)
    ipcMain.removeHandler(IPC_CHANNELS.SPELLBOOK_LIST)
    ipcMain.removeHandler(IPC_CHANNELS.SPELLBOOK_GET)
  }
}
