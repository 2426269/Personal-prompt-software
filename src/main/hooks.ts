import { logMainError } from './logging'

process.on('unhandledRejection', (reason) => {
  logMainError('unhandledRejection', reason)
})

process.on('uncaughtException', (error) => {
  logMainError('uncaughtException', error)
})
