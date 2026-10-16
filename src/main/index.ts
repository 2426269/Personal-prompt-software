import './hooks'

import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { closeDatabase, initDatabase } from './db/database'
import { registerIpcHandlers } from './ipc'
import { logMainError } from './logging'
import { repairCurrentAppDataImagePaths } from './services/storage/storage.service'
import { applyConfiguredUserDataPath } from './storage-path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const RENDERER_DIST = path.join(__dirname, '../dist')
const PRELOAD_PATH = path.join(__dirname, '../dist-preload/preload.mjs')

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

let disposeIpcHandlers: (() => void) | null = null

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    void win.loadURL(VITE_DEV_SERVER_URL).catch((error) => {
      logMainError('loadURL', error)
    })
  } else {
    const targetHtml = path.join(RENDERER_DIST, 'index.html')
    void win.loadFile(targetHtml).catch((error) => {
      logMainError('loadFile', error)
    })
  }

  return win
}

void app.whenReady()
  .then(() => {
    applyConfiguredUserDataPath()
    initDatabase()
    repairCurrentAppDataImagePaths()
    disposeIpcHandlers = registerIpcHandlers()
    createMainWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow()
      }
    })
  })
  .catch((error) => {
    logMainError('app.whenReady', error)
    app.quit()
  })

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  disposeIpcHandlers?.()
  disposeIpcHandlers = null
  closeDatabase()
})
