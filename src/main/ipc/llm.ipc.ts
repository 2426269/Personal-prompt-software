import { ipcMain } from 'electron'

import { IPC_CHANNELS } from '@shared/ipc-channels'
import type {
  AnalyzeEntryInput,
  AnalyzeEntryResult,
  LLMConnectionTestInput,
  LLMConnectionTestResult,
  LLMModelConfigInput,
  LLMModelConfigSummary,
} from '@shared/types/llm'

import { LLMService } from '../services/llm/llm-service'
import { wrapIPC } from './wrap-ipc'

const llmService = new LLMService()

export function registerLLMIPC(): () => void {
  ipcMain.handle(IPC_CHANNELS.LLM_CONFIG_LIST, async () =>
    wrapIPC<LLMModelConfigSummary[]>(() => llmService.listConfigs()),
  )

  ipcMain.handle(IPC_CHANNELS.LLM_CONFIG_SAVE, async (_event, payload: LLMModelConfigInput) =>
    wrapIPC<LLMModelConfigSummary>(() => llmService.saveConfig(payload)),
  )

  ipcMain.handle(IPC_CHANNELS.LLM_CONFIG_DELETE, async (_event, payload: { id: string }) =>
    wrapIPC<boolean>(() => llmService.deleteConfig(payload.id)),
  )

  ipcMain.handle(IPC_CHANNELS.LLM_CONFIG_TEST, async (_event, payload: LLMConnectionTestInput) =>
    wrapIPC<LLMConnectionTestResult>(() => llmService.testConnection(payload)),
  )

  ipcMain.handle(IPC_CHANNELS.LLM_ANALYZE, async (_event, payload: AnalyzeEntryInput) =>
    wrapIPC<AnalyzeEntryResult>(() => llmService.analyzeEntry(payload)),
  )

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.LLM_CONFIG_LIST)
    ipcMain.removeHandler(IPC_CHANNELS.LLM_CONFIG_SAVE)
    ipcMain.removeHandler(IPC_CHANNELS.LLM_CONFIG_DELETE)
    ipcMain.removeHandler(IPC_CHANNELS.LLM_CONFIG_TEST)
    ipcMain.removeHandler(IPC_CHANNELS.LLM_ANALYZE)
  }
}
