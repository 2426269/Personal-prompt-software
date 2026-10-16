import type {
  EntryDeleteInput,
  EntryDeleteResult,
  EntryDetail,
  EntryListParams,
  EntryListResult,
  EntryUpdateInput,
} from './entry'
import type { ImageCacheCleanupInput, ImageCacheCleanupResult, ImageCacheStatus } from './image-cache'
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
} from './anima'
import type {
  SpellbookEntryDetail,
  SpellbookEntrySummary,
  SpellbookLibraryStatus,
  SpellbookListParams,
  SpellbookSyncResult,
} from './spellbook'
import type {
  AnalyzeEntryInput,
  AnalyzeEntryResult,
  LLMConnectionTestInput,
  LLMConnectionTestResult,
  LLMModelDescriptor,
  LLMModelConfigInput,
  LLMModelConfigSummary,
} from './llm'
import type {
  AitagImportResult,
  DetectTypeResult,
  ParsedComfyUIPrompt,
  ParsedNAIPrompt,
  ParsedSDPrompt,
  PromptSourceType,
} from './importer'
import type { EntryTagAssignInput, UserTag, UserTagInput } from './tag'
import type { PromptTemplate, PromptTemplateInput } from './template'
import type {
  PromptPresetDetail,
  PromptPresetSaveInput,
  PromptPresetSummary,
} from './preset'
import type {
  ComfyCancelInput,
  ComfyCancelResult,
  ComfyConnectionInput,
  ComfyConnectionResult,
  ComfyQueueStatusInput,
  ComfyQueueStatusResult,
  ComfySubmitInput,
  ComfySubmitResult,
} from './comfy'
import type {
  NAIConnectionInput,
  NAIConnectionResult,
  NAISubmitInput,
  NAISubmitResult,
} from './nai'
import type {
  WorkflowBindInput,
  WorkflowCleanInput,
  WorkflowCleanResult,
  WorkflowDetail,
  WorkflowExportInput,
  WorkflowListParams,
  WorkflowRefreshInput,
  WorkflowSetDefaultInput,
  WorkflowSlotMapGuessInput,
  WorkflowSlotMapItem,
  WorkflowSlotMapSaveInput,
  WorkflowSummary,
  WorkflowUnbindInput,
} from './workflow'
import type {
  RemoteModelIndexItem,
  RemoteModelScanProgress,
  RemoteModelScanInput,
  RemoteModelScanResult,
  RemoteProfileInput,
  RemoteProfileSummary,
} from './remote'
import type {
  CivitaiConfigInput,
  CivitaiConfigSummary,
  CivitaiConfigTestResult,
  CivitaiModelMatch,
  CivitaiSearchInput,
} from './civitai'
import type {
  AppLogClearInput,
  AppLogClearResult,
  AppLogDetailInput,
  AppLogExportInput,
  AppLogExportResult,
  AppLogListInput,
  AppLogListResult,
  AppLogRecord,
  AppLogSummary,
} from './logs'
import type {
  AppDataMigrationResult,
  DatabaseBackupExportResult,
  DatabaseBackupImportResult,
  OpenStorageLocationInput,
  OpenStorageLocationResult,
  StorageInfo,
} from './storage'

export interface IPCError {
  code: string
  message: string
}

export interface IPCResponse<T> {
  success: boolean
  data?: T
  error?: IPCError
}

export interface PingPayload {
  message: 'pong'
  timestamp: string
}

export interface AppIPC {
  versions: {
    chrome: string
    electron: string
    node: string
  }
  ping: () => Promise<IPCResponse<PingPayload>>

  detectPromptType: (input: string) => Promise<IPCResponse<DetectTypeResult>>
  parseNAI: (input: string) => Promise<IPCResponse<ParsedNAIPrompt>>
  parseSD: (input: string) => Promise<IPCResponse<ParsedSDPrompt>>
  parseComfyUI: (input: string) => Promise<IPCResponse<ParsedComfyUIPrompt>>

  importFromAitag: (input: string) => Promise<IPCResponse<AitagImportResult>>
  importFromUrl: (input: string) => Promise<IPCResponse<AitagImportResult>>
  importFromText: (text: string) => Promise<IPCResponse<{ entryId: string; type: PromptSourceType; parsed: unknown }>>
  importFromFile: (filePath: string) => Promise<IPCResponse<{ entryId: string; type: PromptSourceType; parsed: unknown }>>

  listEntries: (params: EntryListParams) => Promise<IPCResponse<EntryListResult>>
  getEntry: (id: string) => Promise<IPCResponse<EntryDetail | null>>
  updateEntry: (input: EntryUpdateInput) => Promise<IPCResponse<boolean>>
  deleteEntry: (input: EntryDeleteInput) => Promise<IPCResponse<EntryDeleteResult>>

  getImageCacheStatus: () => Promise<IPCResponse<ImageCacheStatus>>
  cleanupImageCache: (input: ImageCacheCleanupInput) => Promise<IPCResponse<ImageCacheCleanupResult>>
  getStorageInfo: () => Promise<IPCResponse<StorageInfo>>
  exportDatabaseBackup: () => Promise<IPCResponse<DatabaseBackupExportResult>>
  importDatabaseBackup: () => Promise<IPCResponse<DatabaseBackupImportResult>>
  migrateAppDataDirectory: () => Promise<IPCResponse<AppDataMigrationResult>>
  openStorageLocation: (input: OpenStorageLocationInput) => Promise<IPCResponse<OpenStorageLocationResult>>

  getAnimaLibraryStatus: () => Promise<IPCResponse<AnimaLibraryStatus>>
  importAnimaLibrary: (input?: AnimaImportInput) => Promise<IPCResponse<AnimaImportResult>>
  listAnimaArtists: (params?: AnimaArtistListParams) => Promise<IPCResponse<AnimaArtistListResult>>
  getAnimaArtist: (id: string) => Promise<IPCResponse<AnimaArtistDetail | null>>
  toggleAnimaFavorite: (input: AnimaToggleFavoriteInput) => Promise<IPCResponse<boolean>>
  listAnimaFolders: () => Promise<IPCResponse<AnimaFolder[]>>
  saveAnimaFolder: (input: AnimaFolderSaveInput) => Promise<IPCResponse<AnimaFolder>>
  deleteAnimaFolder: (input: AnimaFolderDeleteInput) => Promise<IPCResponse<boolean>>
  setAnimaArtistFolders: (input: AnimaArtistFolderUpdateInput) => Promise<IPCResponse<boolean>>
  exportAnimaArtists: (input: AnimaExportInput) => Promise<IPCResponse<AnimaExportResult>>
  importAnimaFavorites: () => Promise<IPCResponse<AnimaImportFavoritesResult>>

  getSpellbookStatus: () => Promise<IPCResponse<SpellbookLibraryStatus>>
  syncSpellbookLibrary: () => Promise<IPCResponse<SpellbookSyncResult>>
  listSpellbookEntries: (params?: SpellbookListParams) => Promise<IPCResponse<SpellbookEntrySummary[]>>
  getSpellbookEntry: (id: string) => Promise<IPCResponse<SpellbookEntryDetail | null>>

  listTemplates: () => Promise<IPCResponse<PromptTemplate[]>>
  getTemplate: (id: string) => Promise<IPCResponse<PromptTemplate | null>>
  saveTemplate: (input: PromptTemplateInput) => Promise<IPCResponse<PromptTemplate>>
  deleteTemplate: (id: string) => Promise<IPCResponse<boolean>>

  listPromptPresets: () => Promise<IPCResponse<PromptPresetSummary[]>>
  getPromptPreset: (id: string) => Promise<IPCResponse<PromptPresetDetail | null>>
  savePromptPreset: (input: PromptPresetSaveInput) => Promise<IPCResponse<PromptPresetDetail>>
  deletePromptPreset: (id: string) => Promise<IPCResponse<boolean>>

  listLLMConfigs: () => Promise<IPCResponse<LLMModelConfigSummary[]>>
  saveLLMConfig: (input: LLMModelConfigInput) => Promise<IPCResponse<LLMModelConfigSummary>>
  deleteLLMConfig: (id: string) => Promise<IPCResponse<boolean>>
  testLLMConfig: (input: LLMConnectionTestInput) => Promise<IPCResponse<LLMConnectionTestResult>>
  discoverLLMModels: (input: LLMConnectionTestInput) => Promise<IPCResponse<LLMModelDescriptor[]>>
  analyzeEntry: (input: AnalyzeEntryInput) => Promise<IPCResponse<AnalyzeEntryResult>>

  listTags: () => Promise<IPCResponse<UserTag[]>>
  createTag: (input: UserTagInput) => Promise<IPCResponse<UserTag>>
  updateTag: (input: UserTagInput) => Promise<IPCResponse<UserTag>>
  deleteTag: (id: string) => Promise<IPCResponse<boolean>>
  assignTagsToEntry: (input: EntryTagAssignInput) => Promise<IPCResponse<UserTag[]>>

  listWorkflows: (params?: WorkflowListParams) => Promise<IPCResponse<WorkflowSummary[]>>
  getWorkflow: (id: string) => Promise<IPCResponse<WorkflowDetail | null>>
  cleanWorkflow: (input: WorkflowCleanInput) => Promise<IPCResponse<WorkflowCleanResult>>
  refreshWorkflow: (input: WorkflowRefreshInput) => Promise<IPCResponse<WorkflowDetail>>
  exportWorkflow: (input: WorkflowExportInput) => Promise<IPCResponse<string>>
  setDefaultWorkflow: (input: WorkflowSetDefaultInput) => Promise<IPCResponse<boolean>>
  bindWorkflow: (input: WorkflowBindInput) => Promise<IPCResponse<boolean>>
  unbindWorkflow: (input: WorkflowUnbindInput) => Promise<IPCResponse<boolean>>
  guessWorkflowSlotMap: (input: WorkflowSlotMapGuessInput) => Promise<IPCResponse<WorkflowSlotMapItem[]>>
  saveWorkflowSlotMap: (input: WorkflowSlotMapSaveInput) => Promise<IPCResponse<WorkflowDetail>>

  testComfyConnection: (input: ComfyConnectionInput) => Promise<IPCResponse<ComfyConnectionResult>>
  submitComfyPrompt: (input: ComfySubmitInput) => Promise<IPCResponse<ComfySubmitResult>>
  getComfyQueueStatus: (input: ComfyQueueStatusInput) => Promise<IPCResponse<ComfyQueueStatusResult>>
  cancelComfyTask: (input: ComfyCancelInput) => Promise<IPCResponse<ComfyCancelResult>>
  testNaiConnection: (input: NAIConnectionInput) => Promise<IPCResponse<NAIConnectionResult>>
  submitNaiGeneration: (input: NAISubmitInput) => Promise<IPCResponse<NAISubmitResult>>

  listRemoteProfiles: () => Promise<IPCResponse<RemoteProfileSummary[]>>
  getRemoteProfile: (id: string) => Promise<IPCResponse<RemoteProfileSummary | null>>
  saveRemoteProfile: (input: RemoteProfileInput) => Promise<IPCResponse<RemoteProfileSummary>>
  deleteRemoteProfile: (id: string) => Promise<IPCResponse<boolean>>
  scanRemoteModels: (input: RemoteModelScanInput) => Promise<IPCResponse<RemoteModelScanResult>>
  getRemoteModelIndex: (profileId: string) => Promise<IPCResponse<RemoteModelIndexItem[]>>
  onRemoteModelScanProgress: (listener: (progress: RemoteModelScanProgress) => void) => () => void
  scanRemoteLoras: (input: RemoteModelScanInput) => Promise<IPCResponse<RemoteModelScanResult>>
  getRemoteLoraIndex: (profileId: string) => Promise<IPCResponse<RemoteModelIndexItem[]>>

  getCivitaiConfig: () => Promise<IPCResponse<CivitaiConfigSummary>>
  saveCivitaiConfig: (input: CivitaiConfigInput) => Promise<IPCResponse<CivitaiConfigSummary>>
  testCivitaiConfig: () => Promise<IPCResponse<CivitaiConfigTestResult>>
  getCivitaiByHash: (input: CivitaiSearchInput) => Promise<IPCResponse<CivitaiModelMatch | null>>
  getCivitaiByVersion: (input: CivitaiSearchInput) => Promise<IPCResponse<CivitaiModelMatch | null>>
  searchCivitaiModel: (input: CivitaiSearchInput) => Promise<IPCResponse<CivitaiModelMatch | null>>

  listLogs: (input?: AppLogListInput) => Promise<IPCResponse<AppLogListResult>>
  getLog: (input: AppLogDetailInput) => Promise<IPCResponse<AppLogRecord | null>>
  getLogSummary: (input?: AppLogListInput) => Promise<IPCResponse<AppLogSummary>>
  clearLogs: (input?: AppLogClearInput) => Promise<IPCResponse<AppLogClearResult>>
  exportLogs: (input: AppLogExportInput) => Promise<IPCResponse<AppLogExportResult>>
}
