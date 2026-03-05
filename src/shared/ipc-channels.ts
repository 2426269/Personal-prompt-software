export const IPC_CHANNELS = {
  APP_PING: 'app:ping',
} as const

export type IPCChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
