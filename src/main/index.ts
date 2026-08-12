// Electron main-process entry point: app lifecycle, the frameless window and
// the IPC surface that exposes the Node scanning engine to the renderer.

import { app, BrowserWindow, ipcMain, nativeImage, shell } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { DeviceProfile, ExportFormat, ExportResult, HostResult, PortScanOptions, ScanEvent, ScanOptions, ScanState } from '../shared/types'
import { appVersion } from './app-version'
import { exportScanResults } from './export'
import { backupAllData, backupMapSettings, restoreAllData, restoreMapSettings } from './backup'
import { getDevices, setDeviceProfile } from './devices'
import { clearHistory, diffScans, getHistory, recordScan as recordScanHistory } from './history'
import { getKnownDevices, getKnownHosts, getMonitorEvents, recordScan as recordScanMonitor } from './monitor'
import { listInterfaces, readArpTable, ScanManager } from './scanner'
import {
  clearTopologyBindings,
  getTopology,
  refreshSwitchTables,
  setTopologyBinding
} from './topology'
import { initUpdater, syncUpdaterSettings } from './updater'
import { sendWakeOnLan } from './wol'

let mainWindow: BrowserWindow | null = null

/** Single scan manager shared across the app; serializes scans. */
const scanManager = new ScanManager()
// After every scan, previously-detected devices inside the scanned range that
// were not reachable come back as offline results from the monitoring ledger,
// so the table and network map keep showing them with their saved metadata.
scanManager.setKnownHostsProvider(getKnownHosts)

/**
 * After a scan finds switches, quietly re-read their SNMP MAC tables in the
 * background and push the fresh topology so the map updates without a manual
 * refresh. Non-blocking; SNMP reads never hold up the UI.
 */
async function autoRefreshTopology(hosts: HostResult[]): Promise<void> {
  const switchIps = hosts.filter((h) => h.status === 'online' && h.deviceType === 'switch').map((h) => h.ip)
  if (switchIps.length === 0) return
  const data = await refreshSwitchTables(switchIps, 1200)
  mainWindow?.webContents.send('topology:updated', data)
}

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
  // Stream every scan event to the renderer as it happens. When a scan
  // completes cleanly, persist it to the scan history and reconcile the
  // monitoring ledger, pushing any new-device / online / offline alerts.
  scanManager.on('event', (ev: ScanEvent) => {
    mainWindow?.webContents.send('scan:event', ev)
    if (ev.type === 'done') {
      const state = scanManager.getState()
      recordScanHistory(ev.summary, state.hosts)
      for (const alert of recordScanMonitor(ev.summary, state.hosts)) {
        mainWindow?.webContents.send('monitor:event', alert)
      }
      void autoRefreshTopology(state.hosts)
    }
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
  ipcMain.handle('scan:ports', async (_e, options: PortScanOptions): Promise<void> => {
    await scanManager.scanPorts(options)
  })

  // Device profiles (names, notes, tags, favorites), keyed by MAC.
  ipcMain.handle('devices:get', (): ReturnType<typeof getDevices> => getDevices())
  ipcMain.handle('devices:set', (_e, key: string, patch: Partial<DeviceProfile>): ReturnType<typeof setDeviceProfile> =>
    setDeviceProfile(key, patch)
  )

  // Scan history + comparison (Phase 3).
  ipcMain.handle('history:list', (): ReturnType<typeof getHistory> => getHistory())
  ipcMain.handle('history:clear', (): boolean => {
    clearHistory()
    return true
  })
  ipcMain.handle('history:diff', (_e, aId: string, bId: string): ReturnType<typeof diffScans> => diffScans(aId, bId))

  // Device monitoring (Phase 3): known-device ledger + new/online/offline alerts.
  ipcMain.handle('monitor:events', (): ReturnType<typeof getMonitorEvents> => getMonitorEvents())
  ipcMain.handle('monitor:devices', (): ReturnType<typeof getKnownDevices> => getKnownDevices())

  // Switch-aware topology (Phase 3): manual device→switch bindings + SNMP tables.
  ipcMain.handle('topology:get', (): ReturnType<typeof getTopology> => getTopology())
  ipcMain.handle('topology:setBinding', (_e, key: string, switchIp: string | null): ReturnType<typeof setTopologyBinding> =>
    setTopologyBinding(key, switchIp)
  )
  ipcMain.handle('topology:clear', (): ReturnType<typeof clearTopologyBindings> => clearTopologyBindings())
  ipcMain.handle('topology:refresh', async (_e, switchIps: string[]): Promise<ReturnType<typeof getTopology>> => {
    const data = await refreshSwitchTables(switchIps, 1200)
    mainWindow?.webContents.send('topology:updated', data)
    return data
  })

  // Map settings backup / restore (device profiles + topology, via file dialog).
  ipcMain.handle('map:backup', () => backupMapSettings(mainWindow))
  ipcMain.handle('map:restore', () => restoreMapSettings(mainWindow))

  // Full data backup / restore (settings, profiles, topology, ledger, history).
  ipcMain.handle('data:backup', () => backupAllData(mainWindow))
  ipcMain.handle('data:restore', () => {
    const result = restoreAllData(mainWindow)
    syncUpdaterSettings()
    return result
  })

  // Scan-results export (CSV / JSON via save dialog).
  ipcMain.handle('export:results', (_e, hosts: HostResult[], format: ExportFormat): Promise<ExportResult> =>
    exportScanResults(mainWindow, hosts, format)
  )

  // Wake-on-LAN: send a magic packet for a device's MAC.
  ipcMain.handle('wol:send', (_e, mac: string): Promise<boolean> => sendWakeOnLan(mac))

  // Open an external http(s) URL in the default browser (https/http only, so
  // the renderer can never ask the OS to launch an arbitrary handler).
  ipcMain.handle('app:openExternal', (_e, url: string): boolean => {
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
      void shell.openExternal(url)
      return true
    } catch {
      return false
    }
  })

  // App + window helpers.
  ipcMain.handle('app:getVersion', () => appVersion())
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
