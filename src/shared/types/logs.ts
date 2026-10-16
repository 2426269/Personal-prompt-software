export type AppLogModule = 'llm' | 'comfy' | 'civitai' | 'ssh' | 'remote_model' | 'ipc' | 'main'
export type AppLogLevel = 'debug' | 'info' | 'warn' | 'error'
export type AppLogTimeRange = '1h' | '24h' | '7d' | 'all'
export type AppLogExportFormat = 'json' | 'jsonl'

export interface AppLogRecord {
  id: string
  createdAt: string
  module: AppLogModule
  level: AppLogLevel
  action: string
  summary: string
  entryId: string | null
  imageIndex: number | null
  requestJson: unknown
  responseJson: unknown
  errorJson: unknown
  tags: string[]
}

export interface AppLogListInput {
  module?: AppLogModule | 'all'
  level?: AppLogLevel | 'all'
  timeRange?: AppLogTimeRange
  query?: string
  limit?: number
  offset?: number
}

export interface AppLogListResult {
  items: AppLogRecord[]
  total: number
}

export interface AppLogDetailInput {
  id: string
}

export interface AppLogSummaryItem {
  key: string
  count: number
  lastSeenAt: string | null
}

export interface AppLogSummary {
  total: number
  modules: AppLogSummaryItem[]
  problemTags: AppLogSummaryItem[]
}

export interface AppLogClearInput {
  module?: AppLogModule | 'all'
}

export interface AppLogClearResult {
  deletedCount: number
}

export interface AppLogExportInput {
  module?: AppLogModule | 'all'
  level?: AppLogLevel | 'all'
  timeRange?: AppLogTimeRange
  query?: string
  format: AppLogExportFormat
}

export interface AppLogExportResult {
  filePath: string
  recordCount: number
  format: AppLogExportFormat
}
