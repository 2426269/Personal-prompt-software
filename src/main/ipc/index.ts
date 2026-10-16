import { registerAnimaIPC } from './anima.ipc'
import { registerAppIPC } from './app.ipc'
import { registerCivitaiIPC } from './civitai.ipc'
import { registerComfyIPC } from './comfy.ipc'
import { registerEntriesIPC } from './entries.ipc'
import { registerImageCacheIPC } from './image-cache.ipc'
import { registerLLMIPC } from './llm.ipc'
import { registerLogsIPC } from './logs.ipc'
import { registerNaiIPC } from './nai.ipc'
import { registerParserIPC } from './parser.ipc'
import { registerPromptPresetsIPC } from './prompt-presets.ipc'
import { registerRemoteLoraIPC } from './remote-lora.ipc'
import { registerScraperIPC } from './scraper.ipc'
import { registerSpellbookIPC } from './spellbook.ipc'
import { registerStorageIPC } from './storage.ipc'
import { registerTagsIPC } from './tags.ipc'
import { registerTemplatesIPC } from './templates.ipc'
import { registerWorkflowsIPC } from './workflows.ipc'

export function registerIpcHandlers(): () => void {
  const unregisterAppIPC = registerAppIPC()
  const unregisterAnimaIPC = registerAnimaIPC()
  const unregisterComfyIPC = registerComfyIPC()
  const unregisterEntriesIPC = registerEntriesIPC()
  const unregisterParserIPC = registerParserIPC()
  const unregisterPromptPresetsIPC = registerPromptPresetsIPC()
  const unregisterRemoteLoraIPC = registerRemoteLoraIPC()
  const unregisterCivitaiIPC = registerCivitaiIPC()
  const unregisterScraperIPC = registerScraperIPC()
  const unregisterSpellbookIPC = registerSpellbookIPC()
  const unregisterImageCacheIPC = registerImageCacheIPC()
  const unregisterStorageIPC = registerStorageIPC()
  const unregisterLogsIPC = registerLogsIPC()
  const unregisterNaiIPC = registerNaiIPC()
  const unregisterTemplatesIPC = registerTemplatesIPC()
  const unregisterLLMIPC = registerLLMIPC()
  const unregisterTagsIPC = registerTagsIPC()
  const unregisterWorkflowsIPC = registerWorkflowsIPC()

  return () => {
    unregisterAppIPC()
    unregisterAnimaIPC()
    unregisterComfyIPC()
    unregisterEntriesIPC()
    unregisterParserIPC()
    unregisterPromptPresetsIPC()
    unregisterRemoteLoraIPC()
    unregisterCivitaiIPC()
    unregisterScraperIPC()
    unregisterSpellbookIPC()
    unregisterImageCacheIPC()
    unregisterStorageIPC()
    unregisterLogsIPC()
    unregisterNaiIPC()
    unregisterTemplatesIPC()
    unregisterLLMIPC()
    unregisterTagsIPC()
    unregisterWorkflowsIPC()
  }
}
