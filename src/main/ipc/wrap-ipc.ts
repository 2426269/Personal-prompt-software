import type { IPCResponse } from '@shared/types/ipc'

import { writeStructuredLog } from '../logging'

export class AppError extends Error {
  public details?: unknown

  constructor(
    public readonly code: string,
    message: string,
    details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
    this.details = details
  }
}

export async function wrapIPC<T>(
  handler: () => Promise<T> | T,
  context?: { channel?: string; payload?: unknown },
): Promise<IPCResponse<T>> {
  try {
    const data = await handler()
    return { success: true, data }
  } catch (error) {
    const logPayload = {
      module: 'ipc' as const,
      level: 'error' as const,
      action: context?.channel ?? 'unknown',
      summary: `IPC 调用失败：${context?.channel ?? 'unknown'}`,
      request: context?.payload,
      error,
    }

    if (error instanceof AppError) {
      writeStructuredLog(logPayload)
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      }
    }

    writeStructuredLog(logPayload)
    return {
      success: false,
      error: {
        code: 'UNKNOWN',
        message: error instanceof Error ? error.message : 'Unknown IPC error',
      },
    }
  }
}
