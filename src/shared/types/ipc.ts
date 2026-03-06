import type {
  EntryDeleteInput,
  EntryDeleteResult,
  EntryDetail,
  EntryListParams,
  EntryListResult,
  EntryUpdateInput,
} from './entry'
import type {
  AitagImportResult,
  DetectTypeResult,
  ParsedComfyUIPrompt,
  ParsedNAIPrompt,
  ParsedSDPrompt,
  PromptSourceType,
} from './importer'

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
  importFromText: (text: string) => Promise<IPCResponse<{ entryId: string; type: PromptSourceType; parsed: unknown }>>
  importFromFile: (filePath: string) => Promise<IPCResponse<{ entryId: string; type: PromptSourceType; parsed: unknown }>>

  listEntries: (params: EntryListParams) => Promise<IPCResponse<EntryListResult>>
  getEntry: (id: string) => Promise<IPCResponse<EntryDetail | null>>
  updateEntry: (input: EntryUpdateInput) => Promise<IPCResponse<boolean>>
  deleteEntry: (input: EntryDeleteInput) => Promise<IPCResponse<EntryDeleteResult>>
}
