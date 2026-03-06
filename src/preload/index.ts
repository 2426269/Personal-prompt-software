import { contextBridge, ipcRenderer } from 'electron'

import { IPC_CHANNELS } from '@shared/ipc-channels'
import type { AppIPC } from '@shared/types/ipc'

const api: AppIPC = {
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node,
  },
  ping: async () =>
    ipcRenderer.invoke(IPC_CHANNELS.APP_PING) as ReturnType<AppIPC['ping']>,

  detectPromptType: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.PARSER_DETECT_TYPE, { input }) as ReturnType<
      AppIPC['detectPromptType']
    >,
  parseNAI: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.PARSER_PARSE_NAI, { input }) as ReturnType<AppIPC['parseNAI']>,
  parseSD: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.PARSER_PARSE_SD, { input }) as ReturnType<AppIPC['parseSD']>,
  parseComfyUI: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.PARSER_PARSE_COMFYUI, { input }) as ReturnType<
      AppIPC['parseComfyUI']
    >,

  importFromAitag: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.SCRAPER_AITAG_IMPORT, { input }) as ReturnType<
      AppIPC['importFromAitag']
    >,
  importFromText: async (text) =>
    ipcRenderer.invoke(IPC_CHANNELS.ENTRY_IMPORT_TEXT, { text }) as ReturnType<
      AppIPC['importFromText']
    >,
  importFromFile: async (filePath) =>
    ipcRenderer.invoke(IPC_CHANNELS.ENTRY_IMPORT_FILE, { filePath }) as ReturnType<
      AppIPC['importFromFile']
    >,

  listEntries: async (params) =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_ENTRIES_LIST, params) as ReturnType<AppIPC['listEntries']>,
  getEntry: async (id) =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_ENTRIES_GET, { id }) as ReturnType<AppIPC['getEntry']>,
  updateEntry: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_ENTRIES_UPDATE, input) as ReturnType<AppIPC['updateEntry']>,
  deleteEntry: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_ENTRIES_DELETE, input) as ReturnType<AppIPC['deleteEntry']>,

  listTemplates: async () =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_TEMPLATES_LIST) as ReturnType<AppIPC['listTemplates']>,
  getTemplate: async (id) =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_TEMPLATES_GET, { id }) as ReturnType<AppIPC['getTemplate']>,
  saveTemplate: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_TEMPLATES_SAVE, input) as ReturnType<AppIPC['saveTemplate']>,
  deleteTemplate: async (id) =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_TEMPLATES_DELETE, { id }) as ReturnType<AppIPC['deleteTemplate']>,

  listLLMConfigs: async () =>
    ipcRenderer.invoke(IPC_CHANNELS.LLM_CONFIG_LIST) as ReturnType<AppIPC['listLLMConfigs']>,
  saveLLMConfig: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.LLM_CONFIG_SAVE, input) as ReturnType<AppIPC['saveLLMConfig']>,
  deleteLLMConfig: async (id) =>
    ipcRenderer.invoke(IPC_CHANNELS.LLM_CONFIG_DELETE, { id }) as ReturnType<AppIPC['deleteLLMConfig']>,
  testLLMConfig: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.LLM_CONFIG_TEST, input) as ReturnType<AppIPC['testLLMConfig']>,
  analyzeEntry: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.LLM_ANALYZE, input) as ReturnType<AppIPC['analyzeEntry']>,

  listTags: async () =>
    ipcRenderer.invoke(IPC_CHANNELS.TAG_LIST) as ReturnType<AppIPC['listTags']>,
  createTag: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.TAG_CREATE, input) as ReturnType<AppIPC['createTag']>,
  updateTag: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.TAG_UPDATE, input) as ReturnType<AppIPC['updateTag']>,
  deleteTag: async (id) =>
    ipcRenderer.invoke(IPC_CHANNELS.TAG_DELETE, { id }) as ReturnType<AppIPC['deleteTag']>,
  assignTagsToEntry: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.TAG_ASSIGN, input) as ReturnType<AppIPC['assignTagsToEntry']>,
}

contextBridge.exposeInMainWorld('api', api)
