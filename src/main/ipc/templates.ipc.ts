import { ipcMain } from 'electron'

import { IPC_CHANNELS } from '@shared/ipc-channels'
import type { PromptTemplate, PromptTemplateInput } from '@shared/types/template'

import { TemplatesService } from '../services/templates/templates.service'
import { wrapIPC } from './wrap-ipc'

export function registerTemplatesIPC(): () => void {
  const templatesService = new TemplatesService()
  
  ipcMain.handle(IPC_CHANNELS.DB_TEMPLATES_LIST, async () =>
    wrapIPC<PromptTemplate[]>(() => templatesService.list(), { channel: IPC_CHANNELS.DB_TEMPLATES_LIST }),
  )

  ipcMain.handle(IPC_CHANNELS.DB_TEMPLATES_GET, async (_event, payload: { id: string }) =>
    wrapIPC<PromptTemplate | null>(() => templatesService.get(payload.id), { channel: IPC_CHANNELS.DB_TEMPLATES_GET, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.DB_TEMPLATES_SAVE, async (_event, payload: PromptTemplateInput) =>
    wrapIPC<PromptTemplate>(() => templatesService.save(payload), { channel: IPC_CHANNELS.DB_TEMPLATES_SAVE, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.DB_TEMPLATES_DELETE, async (_event, payload: { id: string }) =>
    wrapIPC<boolean>(() => templatesService.delete(payload.id), { channel: IPC_CHANNELS.DB_TEMPLATES_DELETE, payload }),
  )

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.DB_TEMPLATES_LIST)
    ipcMain.removeHandler(IPC_CHANNELS.DB_TEMPLATES_GET)
    ipcMain.removeHandler(IPC_CHANNELS.DB_TEMPLATES_SAVE)
    ipcMain.removeHandler(IPC_CHANNELS.DB_TEMPLATES_DELETE)
  }
}
