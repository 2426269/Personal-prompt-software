import { ipcMain } from 'electron'

import { IPC_CHANNELS } from '@shared/ipc-channels'
import type {
    DetectTypeResult,
    ParsedComfyUIPrompt,
    ParsedNAIPrompt,
    ParsedSDPrompt,
} from '@shared/types/importer'

import { PromptTypeDetector } from '../services/parser/auto-detect'
import { ComfyUIParser } from '../services/parser/comfyui-parser'
import { LocalImportService } from '../services/parser/local-import'
import { NAIParser } from '../services/parser/nai-parser'
import { SDParser } from '../services/parser/sd-parser'
import { wrapIPC } from './wrap-ipc'

export function registerParserIPC(): () => void {
  const detector = new PromptTypeDetector()
  const naiParser = new NAIParser()
  const sdParser = new SDParser()
  const comfyuiParser = new ComfyUIParser()
  const localImportService = new LocalImportService()

  ipcMain.handle(IPC_CHANNELS.PARSER_DETECT_TYPE, async (_event, payload: { input: string }) =>
    wrapIPC<DetectTypeResult>(() => detector.detect(payload.input), { channel: IPC_CHANNELS.PARSER_DETECT_TYPE, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.PARSER_PARSE_NAI, async (_event, payload: { input: string }) =>
    wrapIPC<ParsedNAIPrompt>(() => naiParser.parse(payload.input), { channel: IPC_CHANNELS.PARSER_PARSE_NAI, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.PARSER_PARSE_SD, async (_event, payload: { input: string }) =>
    wrapIPC<ParsedSDPrompt>(() => sdParser.parse(payload.input), { channel: IPC_CHANNELS.PARSER_PARSE_SD, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.PARSER_PARSE_COMFYUI, async (_event, payload: { input: string }) =>
    wrapIPC<ParsedComfyUIPrompt>(() => comfyuiParser.parse(payload.input), { channel: IPC_CHANNELS.PARSER_PARSE_COMFYUI, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.ENTRY_IMPORT_TEXT, async (_event, payload: { text: string }) =>
    wrapIPC(() => localImportService.importFromText(payload.text), { channel: IPC_CHANNELS.ENTRY_IMPORT_TEXT, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.ENTRY_IMPORT_FILE, async (_event, payload: { filePath: string }) =>
    wrapIPC(() => localImportService.importFromFile(payload.filePath), { channel: IPC_CHANNELS.ENTRY_IMPORT_FILE, payload }),
  )

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.PARSER_DETECT_TYPE)
    ipcMain.removeHandler(IPC_CHANNELS.PARSER_PARSE_NAI)
    ipcMain.removeHandler(IPC_CHANNELS.PARSER_PARSE_SD)
    ipcMain.removeHandler(IPC_CHANNELS.PARSER_PARSE_COMFYUI)
    ipcMain.removeHandler(IPC_CHANNELS.ENTRY_IMPORT_TEXT)
    ipcMain.removeHandler(IPC_CHANNELS.ENTRY_IMPORT_FILE)
  }
}
