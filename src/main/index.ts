// Electron main-process entry point: app lifecycle, the frameless window and
// the IPC surface that exposes the Node scanning engine to the renderer.

import { app, BrowserWindow, ipcMain, nativeImage } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { ScanEvent, ScanOptions, ScanState } from '../shared/types'
import { listInterfaces, readArpTable, ScanManager } from './scanner'
import { initUpdater } from './updater'

let mainWindow: BrowserWindow | null = null

/** Single scan manager shared across the app; serializes scans. */
const scanManager = new ScanManager()

/** Window icon shared by the title bar and taskbar; falls back to undefined. */
function windowIcon(): Electron.NativeImage | undefined {
  for (const name of ['icon.ico', 'icon.png']) {
    const candidate = join(app.getAppPath(), 'build', name)
    if (existsSync(candidate)) {
      const image = nativeImage.createFromPath(candidate)
      if (!image.isEmpty()) return image
    }
  }
  return undefined
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 940,
    minHeight: 620,
    title: 'Glassy IP Scanner',
    backgroundColor: '#0b1020',
    icon: windowIcon(),
    frame: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('maximize', () => mainWindow?.webContents.send('win:maximized', true))
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('win:maximized', false))

  initUpdater(mainWindow)

  if (process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  // Stream every scan event to the renderer as it happens.
  scanManager.on('event', (ev: ScanEvent) => {
    mainWindow?.webContents.send('scan:event', ev)
  })

  // Network information.
  ipcMain.handle('scan:interfaces', () => listInterfaces())
  ipcMain.handle('scan:arpTable', () => readArpTable().then((map) => Array.from(map.entries())))

  // Scan control.
  ipcMain.handle('scan:start', async (_e, options: ScanOptions): Promise<ScanState> => {
    await scanManager.start(options)
    return scanManager.getState()
  })
  ipcMain.handle('scan:pause', (): ScanState => {
    scanManager.pause()
    return scanManager.getState()
  })
  ipcMain.handle('scan:resume', (): ScanState => {
    scanManager.resume()
    return scanManager.getState()
  })
  ipcMain.handle('scan:cancel', (): ScanState => {
    scanManager.cancel()
    return scanManager.getState()
  })
  ipcMain.handle('scan:state', (): ScanState => scanManager.getState())

  // App + window helpers.
  ipcMain.handle('app:getVersion', () => app.getVersion())
  ipcMain.handle('win:minimize', () => mainWindow?.minimize())
  ipcMain.handle('win:toggleMaximize', () => {
    if (!mainWindow) return false
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
    return mainWindow.isMaximized()
  })
  ipcMain.handle('win:isMaximized', () => mainWindow?.isMaximized() ?? false)
  ipcMain.handle('win:close', () => mainWindow?.close())
}

app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId('com.glassy.ipscanner')
  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  scanManager.cancel()
})
