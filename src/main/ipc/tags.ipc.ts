import { ipcMain } from 'electron'

import { IPC_CHANNELS } from '@shared/ipc-channels'
import type { EntryTagAssignInput, UserTag, UserTagInput } from '@shared/types/tag'

import { TagsService } from '../services/tags/tags.service'
import { wrapIPC } from './wrap-ipc'

export function registerTagsIPC(): () => void {
  const tagsService = new TagsService()

  ipcMain.handle(IPC_CHANNELS.TAG_LIST, async () =>
    wrapIPC<UserTag[]>(() => tagsService.list(), { channel: IPC_CHANNELS.TAG_LIST }),
  )

  ipcMain.handle(IPC_CHANNELS.TAG_CREATE, async (_event, payload: UserTagInput) =>
    wrapIPC<UserTag>(() => tagsService.create(payload), { channel: IPC_CHANNELS.TAG_CREATE, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.TAG_UPDATE, async (_event, payload: UserTagInput) =>
    wrapIPC<UserTag>(() => tagsService.update(payload), { channel: IPC_CHANNELS.TAG_UPDATE, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.TAG_DELETE, async (_event, payload: { id: string }) =>
    wrapIPC<boolean>(() => tagsService.delete(payload.id), { channel: IPC_CHANNELS.TAG_DELETE, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.TAG_ASSIGN, async (_event, payload: EntryTagAssignInput) =>
    wrapIPC<UserTag[]>(() => tagsService.assign(payload), { channel: IPC_CHANNELS.TAG_ASSIGN, payload }),
  )

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.TAG_LIST)
    ipcMain.removeHandler(IPC_CHANNELS.TAG_CREATE)
    ipcMain.removeHandler(IPC_CHANNELS.TAG_UPDATE)
    ipcMain.removeHandler(IPC_CHANNELS.TAG_DELETE)
    ipcMain.removeHandler(IPC_CHANNELS.TAG_ASSIGN)
  }
}
