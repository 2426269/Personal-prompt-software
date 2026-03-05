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
import { NAIParser } from '../services/parser/nai-parser'
import { SDParser } from '../services/parser/sd-parser'
import { wrapIPC } from './wrap-ipc'

const detector = new PromptTypeDetector()
const naiParser = new NAIParser()
const sdParser = new SDParser()
const comfyuiParser = new ComfyUIParser()

export function registerParserIPC(): () => void {
  ipcMain.handle(IPC_CHANNELS.PARSER_DETECT_TYPE, async (_event, payload: { input: string }) =>
    wrapIPC<DetectTypeResult>(() => detector.detect(payload.input)),
  )

  ipcMain.handle(IPC_CHANNELS.PARSER_PARSE_NAI, async (_event, payload: { input: string }) =>
    wrapIPC<ParsedNAIPrompt>(() => naiParser.parse(payload.input)),
  )

  ipcMain.handle(IPC_CHANNELS.PARSER_PARSE_SD, async (_event, payload: { input: string }) =>
    wrapIPC<ParsedSDPrompt>(() => sdParser.parse(payload.input)),
  )

  ipcMain.handle(IPC_CHANNELS.PARSER_PARSE_COMFYUI, async (_event, payload: { input: string }) =>
    wrapIPC<ParsedComfyUIPrompt>(() => comfyuiParser.parse(payload.input)),
  )

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.PARSER_DETECT_TYPE)
    ipcMain.removeHandler(IPC_CHANNELS.PARSER_PARSE_NAI)
    ipcMain.removeHandler(IPC_CHANNELS.PARSER_PARSE_SD)
    ipcMain.removeHandler(IPC_CHANNELS.PARSER_PARSE_COMFYUI)
  }
}
