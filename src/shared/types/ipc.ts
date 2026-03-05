export interface IPCError {
  code: string
  message: string
}

export interface IPCResponse<T> {
  success: boolean
  data?: T
  error?: IPCError
}

export interface AppIPC {
  versions: {
    chrome: string
    electron: string
    node: string
  }
}
