import type { IPCResponse } from '@shared/types/ipc'

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export async function wrapIPC<T>(handler: () => Promise<T> | T): Promise<IPCResponse<T>> {
  try {
    const data = await handler()
    return { success: true, data }
  } catch (error) {
    if (error instanceof AppError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      }
    }

    return {
      success: false,
      error: {
        code: 'UNKNOWN',
        message: error instanceof Error ? error.message : 'Unknown IPC error',
      },
    }
  }
}
