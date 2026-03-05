import type { AppIPC } from '@shared/types/ipc'

declare global {
  interface Window {
    api: AppIPC
  }
}

export {}
