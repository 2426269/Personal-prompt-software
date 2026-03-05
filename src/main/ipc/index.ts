import { registerAppIPC } from './app.ipc'

export function registerIpcHandlers(): () => void {
  const unregisterAppIPC = registerAppIPC()

  return () => {
    unregisterAppIPC()
  }
}
