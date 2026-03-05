import { registerAppIPC } from './app.ipc'
import { registerParserIPC } from './parser.ipc'
import { registerScraperIPC } from './scraper.ipc'

export function registerIpcHandlers(): () => void {
  const unregisterAppIPC = registerAppIPC()
  const unregisterParserIPC = registerParserIPC()
  const unregisterScraperIPC = registerScraperIPC()

  return () => {
    unregisterAppIPC()
    unregisterParserIPC()
    unregisterScraperIPC()
  }
}
