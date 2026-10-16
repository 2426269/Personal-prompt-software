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
  importFromUrl: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.ENTRY_IMPORT_URL, { input }) as ReturnType<AppIPC['importFromUrl']>,
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

  getImageCacheStatus: async () =>
    ipcRenderer.invoke(IPC_CHANNELS.IMAGE_CACHE_STATUS) as ReturnType<AppIPC['getImageCacheStatus']>,
  cleanupImageCache: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.IMAGE_CACHE_CLEANUP, input) as ReturnType<AppIPC['cleanupImageCache']>,
  getStorageInfo: async () =>
    ipcRenderer.invoke(IPC_CHANNELS.STORAGE_INFO) as ReturnType<AppIPC['getStorageInfo']>,
  exportDatabaseBackup: async () =>
    ipcRenderer.invoke(IPC_CHANNELS.STORAGE_EXPORT_DATABASE) as ReturnType<AppIPC['exportDatabaseBackup']>,
  importDatabaseBackup: async () =>
    ipcRenderer.invoke(IPC_CHANNELS.STORAGE_IMPORT_DATABASE) as ReturnType<AppIPC['importDatabaseBackup']>,
  migrateAppDataDirectory: async () =>
    ipcRenderer.invoke(IPC_CHANNELS.STORAGE_MIGRATE_APP_DATA) as ReturnType<AppIPC['migrateAppDataDirectory']>,
  openStorageLocation: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.STORAGE_OPEN_LOCATION, input) as ReturnType<AppIPC['openStorageLocation']>,

  getAnimaLibraryStatus: async () =>
    ipcRenderer.invoke(IPC_CHANNELS.ANIMA_STATUS) as ReturnType<AppIPC['getAnimaLibraryStatus']>,
  importAnimaLibrary: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.ANIMA_IMPORT, input) as ReturnType<AppIPC['importAnimaLibrary']>,
  listAnimaArtists: async (params) =>
    ipcRenderer.invoke(IPC_CHANNELS.ANIMA_LIST_ARTISTS, params) as ReturnType<AppIPC['listAnimaArtists']>,
  getAnimaArtist: async (id) =>
    ipcRenderer.invoke(IPC_CHANNELS.ANIMA_GET_ARTIST, { id }) as ReturnType<AppIPC['getAnimaArtist']>,
  toggleAnimaFavorite: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.ANIMA_TOGGLE_FAVORITE, input) as ReturnType<AppIPC['toggleAnimaFavorite']>,
  listAnimaFolders: async () =>
    ipcRenderer.invoke(IPC_CHANNELS.ANIMA_LIST_FOLDERS) as ReturnType<AppIPC['listAnimaFolders']>,
  saveAnimaFolder: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.ANIMA_SAVE_FOLDER, input) as ReturnType<AppIPC['saveAnimaFolder']>,
  deleteAnimaFolder: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.ANIMA_DELETE_FOLDER, input) as ReturnType<AppIPC['deleteAnimaFolder']>,
  setAnimaArtistFolders: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.ANIMA_SET_ARTIST_FOLDERS, input) as ReturnType<AppIPC['setAnimaArtistFolders']>,
  exportAnimaArtists: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.ANIMA_EXPORT, input) as ReturnType<AppIPC['exportAnimaArtists']>,
  importAnimaFavorites: async () =>
    ipcRenderer.invoke(IPC_CHANNELS.ANIMA_IMPORT_FAVORITES) as ReturnType<AppIPC['importAnimaFavorites']>,

  getSpellbookStatus: async () =>
    ipcRenderer.invoke(IPC_CHANNELS.SPELLBOOK_STATUS) as ReturnType<AppIPC['getSpellbookStatus']>,
  syncSpellbookLibrary: async () =>
    ipcRenderer.invoke(IPC_CHANNELS.SPELLBOOK_SYNC) as ReturnType<AppIPC['syncSpellbookLibrary']>,
  listSpellbookEntries: async (params) =>
    ipcRenderer.invoke(IPC_CHANNELS.SPELLBOOK_LIST, params) as ReturnType<AppIPC['listSpellbookEntries']>,
  getSpellbookEntry: async (id) =>
    ipcRenderer.invoke(IPC_CHANNELS.SPELLBOOK_GET, { id }) as ReturnType<AppIPC['getSpellbookEntry']>,

  listTemplates: async () =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_TEMPLATES_LIST) as ReturnType<AppIPC['listTemplates']>,
  getTemplate: async (id) =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_TEMPLATES_GET, { id }) as ReturnType<AppIPC['getTemplate']>,
  saveTemplate: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_TEMPLATES_SAVE, input) as ReturnType<AppIPC['saveTemplate']>,
  deleteTemplate: async (id) =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_TEMPLATES_DELETE, { id }) as ReturnType<AppIPC['deleteTemplate']>,

  listPromptPresets: async () =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_PROMPT_PRESETS_LIST) as ReturnType<AppIPC['listPromptPresets']>,
  getPromptPreset: async (id) =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_PROMPT_PRESETS_GET, { id }) as ReturnType<AppIPC['getPromptPreset']>,
  savePromptPreset: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_PROMPT_PRESETS_SAVE, input) as ReturnType<AppIPC['savePromptPreset']>,
  deletePromptPreset: async (id) =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_PROMPT_PRESETS_DELETE, { id }) as ReturnType<AppIPC['deletePromptPreset']>,

  listLLMConfigs: async () =>
    ipcRenderer.invoke(IPC_CHANNELS.LLM_CONFIG_LIST) as ReturnType<AppIPC['listLLMConfigs']>,
  saveLLMConfig: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.LLM_CONFIG_SAVE, input) as ReturnType<AppIPC['saveLLMConfig']>,
  deleteLLMConfig: async (id) =>
    ipcRenderer.invoke(IPC_CHANNELS.LLM_CONFIG_DELETE, { id }) as ReturnType<AppIPC['deleteLLMConfig']>,
  testLLMConfig: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.LLM_CONFIG_TEST, input) as ReturnType<AppIPC['testLLMConfig']>,
  discoverLLMModels: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.LLM_CONFIG_DISCOVER_MODELS, input) as ReturnType<AppIPC['discoverLLMModels']>,
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

  listWorkflows: async (params) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKFLOW_LIST, params) as ReturnType<AppIPC['listWorkflows']>,
  getWorkflow: async (id) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKFLOW_GET, { id }) as ReturnType<AppIPC['getWorkflow']>,
  cleanWorkflow: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKFLOW_CLEAN, input) as ReturnType<AppIPC['cleanWorkflow']>,
  refreshWorkflow: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKFLOW_REFRESH, input) as ReturnType<AppIPC['refreshWorkflow']>,
  exportWorkflow: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKFLOW_EXPORT, input) as ReturnType<AppIPC['exportWorkflow']>,
  setDefaultWorkflow: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKFLOW_SET_DEFAULT, input) as ReturnType<
      AppIPC['setDefaultWorkflow']
    >,
  bindWorkflow: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKFLOW_BIND, input) as ReturnType<AppIPC['bindWorkflow']>,
  unbindWorkflow: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKFLOW_UNBIND, input) as ReturnType<AppIPC['unbindWorkflow']>,
  guessWorkflowSlotMap: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.SLOTMAP_GUESS, input) as ReturnType<AppIPC['guessWorkflowSlotMap']>,
  saveWorkflowSlotMap: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.SLOTMAP_SAVE, input) as ReturnType<AppIPC['saveWorkflowSlotMap']>,

  testComfyConnection: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.COMFY_TEST_CONNECTION, input) as ReturnType<AppIPC['testComfyConnection']>,
  submitComfyPrompt: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.COMFY_SUBMIT, input) as ReturnType<AppIPC['submitComfyPrompt']>,
  getComfyQueueStatus: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.COMFY_STATUS, input) as ReturnType<AppIPC['getComfyQueueStatus']>,
  cancelComfyTask: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.COMFY_CANCEL, input) as ReturnType<AppIPC['cancelComfyTask']>,
  testNaiConnection: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.NAI_TEST_CONNECTION, input) as ReturnType<AppIPC['testNaiConnection']>,
  submitNaiGeneration: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.NAI_SUBMIT, input) as ReturnType<AppIPC['submitNaiGeneration']>,

  listRemoteProfiles: async () =>
    ipcRenderer.invoke(IPC_CHANNELS.REMOTE_PROFILE_LIST) as ReturnType<AppIPC['listRemoteProfiles']>,
  getRemoteProfile: async (id) =>
    ipcRenderer.invoke(IPC_CHANNELS.REMOTE_PROFILE_GET, { id }) as ReturnType<AppIPC['getRemoteProfile']>,
  saveRemoteProfile: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.REMOTE_PROFILE_SAVE, input) as ReturnType<AppIPC['saveRemoteProfile']>,
  deleteRemoteProfile: async (id) =>
    ipcRenderer.invoke(IPC_CHANNELS.REMOTE_PROFILE_DELETE, { id }) as ReturnType<AppIPC['deleteRemoteProfile']>,
  scanRemoteModels: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.REMOTE_MODEL_SCAN, input) as ReturnType<AppIPC['scanRemoteModels']>,
  getRemoteModelIndex: async (profileId) =>
    ipcRenderer.invoke(IPC_CHANNELS.REMOTE_MODEL_INDEX, { profileId }) as ReturnType<AppIPC['getRemoteModelIndex']>,
  onRemoteModelScanProgress: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: Parameters<typeof listener>[0]) => {
      listener(payload)
    }
    ipcRenderer.on(IPC_CHANNELS.REMOTE_MODEL_SCAN_PROGRESS, wrapped)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.REMOTE_MODEL_SCAN_PROGRESS, wrapped)
    }
  },
  scanRemoteLoras: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.REMOTE_LORA_SCAN, input) as ReturnType<AppIPC['scanRemoteLoras']>,
  getRemoteLoraIndex: async (profileId) =>
    ipcRenderer.invoke(IPC_CHANNELS.REMOTE_LORA_INDEX, { profileId }) as ReturnType<AppIPC['getRemoteLoraIndex']>,

  getCivitaiConfig: async () =>
    ipcRenderer.invoke(IPC_CHANNELS.CIVITAI_CONFIG_GET) as ReturnType<AppIPC['getCivitaiConfig']>,
  saveCivitaiConfig: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.CIVITAI_CONFIG_SAVE, input) as ReturnType<AppIPC['saveCivitaiConfig']>,
  testCivitaiConfig: async () =>
    ipcRenderer.invoke(IPC_CHANNELS.CIVITAI_CONFIG_TEST) as ReturnType<AppIPC['testCivitaiConfig']>,
  getCivitaiByHash: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.CIVITAI_GET_BY_HASH, input) as ReturnType<AppIPC['getCivitaiByHash']>,
  getCivitaiByVersion: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.CIVITAI_GET_BY_VERSION, input) as ReturnType<AppIPC['getCivitaiByVersion']>,
  searchCivitaiModel: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.CIVITAI_SEARCH_MODEL, input) as ReturnType<AppIPC['searchCivitaiModel']>,

  listLogs: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.LOGS_LIST, input) as ReturnType<AppIPC['listLogs']>,
  getLog: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.LOGS_GET, input) as ReturnType<AppIPC['getLog']>,
  getLogSummary: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.LOGS_SUMMARY, input) as ReturnType<AppIPC['getLogSummary']>,
  clearLogs: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.LOGS_CLEAR, input) as ReturnType<AppIPC['clearLogs']>,
  exportLogs: async (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.LOGS_EXPORT, input) as ReturnType<AppIPC['exportLogs']>,
}

contextBridge.exposeInMainWorld('api', api)

