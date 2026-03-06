import { registerAppIPC } from './app.ipc'
import { registerEntriesIPC } from './entries.ipc'
import { registerImageCacheIPC } from './image-cache.ipc'
import { registerLLMIPC } from './llm.ipc'
import { registerParserIPC } from './parser.ipc'
import { registerScraperIPC } from './scraper.ipc'
import { registerTagsIPC } from './tags.ipc'
import { registerTemplatesIPC } from './templates.ipc'

export function registerIpcHandlers(): () => void {
  const unregisterAppIPC = registerAppIPC()
  const unregisterEntriesIPC = registerEntriesIPC()
  const unregisterParserIPC = registerParserIPC()
  const unregisterScraperIPC = registerScraperIPC()
  const unregisterImageCacheIPC = registerImageCacheIPC()
  const unregisterTemplatesIPC = registerTemplatesIPC()
  const unregisterLLMIPC = registerLLMIPC()
  const unregisterTagsIPC = registerTagsIPC()

  return () => {
    unregisterAppIPC()
    unregisterEntriesIPC()
    unregisterParserIPC()
    unregisterScraperIPC()
    unregisterImageCacheIPC()
    unregisterTemplatesIPC()
    unregisterLLMIPC()
    unregisterTagsIPC()
  }
}
