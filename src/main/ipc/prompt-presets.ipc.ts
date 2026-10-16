import { ipcMain } from 'electron'

import { IPC_CHANNELS } from '@shared/ipc-channels'
import type {
  PromptPresetDetail,
  PromptPresetSaveInput,
  PromptPresetSummary,
} from '@shared/types/preset'

import { PromptPresetsService } from '../services/presets/prompt-presets.service'
import { wrapIPC } from './wrap-ipc'

export function registerPromptPresetsIPC(): () => void {
  const promptPresetsService = new PromptPresetsService()

  ipcMain.handle(IPC_CHANNELS.DB_PROMPT_PRESETS_LIST, async () =>
    wrapIPC<PromptPresetSummary[]>(
      () => promptPresetsService.list(),
      { channel: IPC_CHANNELS.DB_PROMPT_PRESETS_LIST },
    ),
  )

  ipcMain.handle(IPC_CHANNELS.DB_PROMPT_PRESETS_GET, async (_event, payload: { id: string }) =>
    wrapIPC<PromptPresetDetail | null>(
      () => promptPresetsService.get(payload.id),
      { channel: IPC_CHANNELS.DB_PROMPT_PRESETS_GET, payload },
    ),
  )

  ipcMain.handle(IPC_CHANNELS.DB_PROMPT_PRESETS_SAVE, async (_event, payload: PromptPresetSaveInput) =>
    wrapIPC<PromptPresetDetail>(
      () => promptPresetsService.save(payload),
      { channel: IPC_CHANNELS.DB_PROMPT_PRESETS_SAVE, payload },
    ),
  )

  ipcMain.handle(IPC_CHANNELS.DB_PROMPT_PRESETS_DELETE, async (_event, payload: { id: string }) =>
    wrapIPC<boolean>(
      () => promptPresetsService.delete(payload.id),
      { channel: IPC_CHANNELS.DB_PROMPT_PRESETS_DELETE, payload },
    ),
  )

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.DB_PROMPT_PRESETS_LIST)
    ipcMain.removeHandler(IPC_CHANNELS.DB_PROMPT_PRESETS_GET)
    ipcMain.removeHandler(IPC_CHANNELS.DB_PROMPT_PRESETS_SAVE)
    ipcMain.removeHandler(IPC_CHANNELS.DB_PROMPT_PRESETS_DELETE)
  }
}
