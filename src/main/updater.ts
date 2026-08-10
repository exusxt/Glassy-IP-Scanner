// Built-in updater backed by electron-updater + GitHub Releases. The app never
// downloads or installs anything without the user's consent: by default every
// available update shows a prompt and the user decides. Turning on "Automatic
// updates" in Settings makes it download silently and install on app quit.

import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater, type UpdateInfo } from 'electron-updater'
import type { AppSettings, UpdateState } from '../shared/types'
import { getSettings, setSettings } from './settings'

let mainWindow: BrowserWindow | null = null
let state: UpdateState = {
  phase: 'idle',
  version: null,
  progress: 0,
  error: null,
  autoUpdate: getSettings().autoUpdate
}

function pushState(): void {
  mainWindow?.webContents.send('update:state', state)
}

function setPhase(phase: UpdateState['phase'], patch: Partial<UpdateState> = {}): void {
  state = { ...state, phase, ...patch }
  pushState()
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

async function checkForUpdates(): Promise<void> {
  if (!app.isPackaged) return
  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    setPhase('error', { error: errorMessage(err) })
  }
}

async function downloadUpdate(): Promise<void> {
  try {
    await autoUpdater.downloadUpdate()
  } catch (err) {
    setPhase('error', { error: errorMessage(err) })
  }
}

export function initUpdater(win: BrowserWindow): void {
  mainWindow = win

  ipcMain.handle('update:check', () => checkForUpdates())
  ipcMain.handle('update:download', () => downloadUpdate())
  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall(false, true)
  })
  ipcMain.handle('update:skip', (_e, version: string) => {
    setSettings({ skipUpdateVersion: version })
    setPhase('idle', { version: null })
  })
  ipcMain.handle('update:clearSkip', () => {
    setSettings({ skipUpdateVersion: null })
  })
  ipcMain.handle('update:state', () => state)
  ipcMain.handle('settings:get', (): AppSettings => getSettings())
  ipcMain.handle('settings:set', (_e, patch: Partial<AppSettings>): AppSettings => {
    const next = setSettings(patch)
    state = { ...state, autoUpdate: next.autoUpdate }
    pushState()
    return next
  })

  if (!app.isPackaged) return

  // Never download on its own: even in auto-update mode we call downloadUpdate()
  // explicitly below, so the user's choice is always honored.
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => setPhase('checking'))
  autoUpdater.on('update-available', (info: UpdateInfo) => {
    if (getSettings().skipUpdateVersion === info.version) {
      setPhase('idle')
      return
    }
    setPhase('available', { version: info.version, progress: 0 })
    if (state.autoUpdate) {
      void downloadUpdate()
    }
  })
  autoUpdater.on('update-not-available', () => setPhase('not-available'))
  autoUpdater.on('download-progress', (p) => {
    setPhase('downloading', { progress: Math.round(p.percent) })
  })
  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    setPhase('downloaded', { version: info.version, progress: 100 })
  })
  autoUpdater.on('error', (err: Error) => {
    setPhase('error', { error: errorMessage(err) })
  })

  // Check shortly after startup so the window is visible and the UI is ready.
  setTimeout(() => void checkForUpdates(), 4000)
}
