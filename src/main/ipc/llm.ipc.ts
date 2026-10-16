import { ipcMain } from 'electron'

import { IPC_CHANNELS } from '@shared/ipc-channels'
import type {
    AnalyzeEntryInput,
    AnalyzeEntryResult,
    LLMConnectionTestInput,
    LLMConnectionTestResult,
    LLMModelDescriptor,
    LLMModelConfigInput,
    LLMModelConfigSummary,
} from '@shared/types/llm'

import { LLMService } from '../services/llm/llm-service'
import { wrapIPC } from './wrap-ipc'

export function registerLLMIPC(): () => void {
  const llmService = new LLMService()

  ipcMain.handle(IPC_CHANNELS.LLM_CONFIG_LIST, async () =>
    wrapIPC<LLMModelConfigSummary[]>(() => llmService.listConfigs(), { channel: IPC_CHANNELS.LLM_CONFIG_LIST }),
  )

  ipcMain.handle(IPC_CHANNELS.LLM_CONFIG_SAVE, async (_event, payload: LLMModelConfigInput) =>
    wrapIPC<LLMModelConfigSummary>(() => llmService.saveConfig(payload), { channel: IPC_CHANNELS.LLM_CONFIG_SAVE, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.LLM_CONFIG_DELETE, async (_event, payload: { id: string }) =>
    wrapIPC<boolean>(() => llmService.deleteConfig(payload.id), { channel: IPC_CHANNELS.LLM_CONFIG_DELETE, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.LLM_CONFIG_TEST, async (_event, payload: LLMConnectionTestInput) =>
    wrapIPC<LLMConnectionTestResult>(() => llmService.testConnection(payload), { channel: IPC_CHANNELS.LLM_CONFIG_TEST, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.LLM_CONFIG_DISCOVER_MODELS, async (_event, payload: LLMConnectionTestInput) =>
    wrapIPC<LLMModelDescriptor[]>(() => llmService.discoverModels(payload), { channel: IPC_CHANNELS.LLM_CONFIG_DISCOVER_MODELS, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.LLM_ANALYZE, async (_event, payload: AnalyzeEntryInput) =>
    wrapIPC<AnalyzeEntryResult>(() => llmService.analyzeEntry(payload), { channel: IPC_CHANNELS.LLM_ANALYZE, payload }),
  )

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.LLM_CONFIG_LIST)
    ipcMain.removeHandler(IPC_CHANNELS.LLM_CONFIG_SAVE)
    ipcMain.removeHandler(IPC_CHANNELS.LLM_CONFIG_DELETE)
    ipcMain.removeHandler(IPC_CHANNELS.LLM_CONFIG_TEST)
    ipcMain.removeHandler(IPC_CHANNELS.LLM_CONFIG_DISCOVER_MODELS)
    ipcMain.removeHandler(IPC_CHANNELS.LLM_ANALYZE)
  }
}
