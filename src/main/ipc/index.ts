import { registerAppIPC } from './app.ipc'
import { registerEntriesIPC } from './entries.ipc'
import { registerParserIPC } from './parser.ipc'
import { registerScraperIPC } from './scraper.ipc'

export function registerIpcHandlers(): () => void {
  const unregisterAppIPC = registerAppIPC()
  const unregisterEntriesIPC = registerEntriesIPC()
  const unregisterParserIPC = registerParserIPC()
  const unregisterScraperIPC = registerScraperIPC()

  return () => {
    unregisterAppIPC()
    unregisterEntriesIPC()
    unregisterParserIPC()
    unregisterScraperIPC()
  }
}
