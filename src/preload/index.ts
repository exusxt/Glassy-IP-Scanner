// Preload bridge: the only script that runs in the isolated renderer context.
// It exposes a typed, promise-based window.api to the React renderer. Every
// method is a thin ipcRenderer.invoke/send wrapper over the main-process IPC.

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type {
  AppSettings,
  DeviceProfile,
  DeviceProfiles,
  HistoryDiff,
  HistoryEntry,
  KnownDevice,
  MapBackupResult,
  MapRestoreResult,
  MonitorEvent,
  NetworkInterface,
  PortScanOptions,
  ScanEvent,
  ScanOptions,
  ScanState,
  TopologyData,
  UpdateState
} from '../shared/types'

const api = {
  // Network info.
  listInterfaces: (): Promise<NetworkInterface[]> => ipcRenderer.invoke('scan:interfaces'),
  arpTable: (): Promise<Array<[string, string]>> => ipcRenderer.invoke('scan:arpTable'),

  // Scan control.
  scan: (options: ScanOptions): Promise<ScanState> => ipcRenderer.invoke('scan:start', options),
  scanPause: (): Promise<ScanState> => ipcRenderer.invoke('scan:pause'),
  scanResume: (): Promise<ScanState> => ipcRenderer.invoke('scan:resume'),
  scanCancel: (): Promise<ScanState> => ipcRenderer.invoke('scan:cancel'),
  scanState: (): Promise<ScanState> => ipcRenderer.invoke('scan:state'),

  // Port scanning.
  scanPorts: (options: PortScanOptions): Promise<void> => ipcRenderer.invoke('scan:ports', options),

  // Device profiles.
  getDevices: (): Promise<DeviceProfiles> => ipcRenderer.invoke('devices:get'),
  setDeviceProfile: (key: string, patch: Partial<DeviceProfile>): Promise<DeviceProfiles> =>
    ipcRenderer.invoke('devices:set', key, patch),

  // Scan history + comparison (Phase 3).
  getHistory: (): Promise<HistoryEntry[]> => ipcRenderer.invoke('history:list'),
  clearHistory: (): Promise<boolean> => ipcRenderer.invoke('history:clear'),
  diffScans: (aId: string, bId: string): Promise<HistoryDiff | null> => ipcRenderer.invoke('history:diff', aId, bId),

  // Device monitoring (Phase 3): known-device ledger + new/online/offline alerts.
  getMonitorEvents: (): Promise<MonitorEvent[]> => ipcRenderer.invoke('monitor:events'),
  getKnownDevices: (): Promise<KnownDevice[]> => ipcRenderer.invoke('monitor:devices'),

  // Switch-aware topology (Phase 3): manual bindings + SNMP MAC tables.
  getTopology: (): Promise<TopologyData> => ipcRenderer.invoke('topology:get'),
  setTopologyBinding: (key: string, switchIp: string | null): Promise<TopologyData> =>
    ipcRenderer.invoke('topology:setBinding', key, switchIp),
  clearTopologyBindings: (): Promise<TopologyData> => ipcRenderer.invoke('topology:clear'),
  refreshTopology: (switchIps: string[]): Promise<TopologyData> => ipcRenderer.invoke('topology:refresh', switchIps),

  // Map settings backup / restore (device profiles + topology).
  backupMapSettings: (): Promise<MapBackupResult> => ipcRenderer.invoke('map:backup'),
  restoreMapSettings: (): Promise<MapRestoreResult> => ipcRenderer.invoke('map:restore'),

  // App + window helpers.
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),
  windowMinimize: (): Promise<void> => ipcRenderer.invoke('win:minimize'),
  windowToggleMaximize: (): Promise<boolean> => ipcRenderer.invoke('win:toggleMaximize'),
  windowIsMaximized: (): Promise<boolean> => ipcRenderer.invoke('win:isMaximized'),
  windowClose: (): Promise<void> => ipcRenderer.invoke('win:close'),

  // Updater + settings.
  checkForUpdates: (): Promise<void> => ipcRenderer.invoke('update:check'),
  downloadUpdate: (): Promise<void> => ipcRenderer.invoke('update:download'),
  installUpdate: (): Promise<void> => ipcRenderer.invoke('update:install'),
  skipUpdate: (version: string): Promise<void> => ipcRenderer.invoke('update:skip', version),
  clearSkipVersion: (): Promise<void> => ipcRenderer.invoke('update:clearSkip'),
  getUpdateState: (): Promise<UpdateState> => ipcRenderer.invoke('update:state'),
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  setSettings: (patch: Partial<AppSettings>): Promise<AppSettings> => ipcRenderer.invoke('settings:set', patch),

  // Subscriptions; each returns an unsubscribe function for React effects.
  onWindowMaximized: (cb: (maximized: boolean) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, maximized: boolean): void => cb(maximized)
    ipcRenderer.on('win:maximized', listener)
    return () => ipcRenderer.removeListener('win:maximized', listener)
  },
  onScanEvent: (cb: (ev: ScanEvent) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, ev: ScanEvent): void => cb(ev)
    ipcRenderer.on('scan:event', listener)
    return () => ipcRenderer.removeListener('scan:event', listener)
  },
  onUpdateState: (cb: (s: UpdateState) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, s: UpdateState): void => cb(s)
    ipcRenderer.on('update:state', listener)
    return () => ipcRenderer.removeListener('update:state', listener)
  },
  onMonitorEvent: (cb: (ev: MonitorEvent) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, ev: MonitorEvent): void => cb(ev)
    ipcRenderer.on('monitor:event', listener)
    return () => ipcRenderer.removeListener('monitor:event', listener)
  },
  onTopologyUpdated: (cb: (data: TopologyData) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, data: TopologyData): void => cb(data)
    ipcRenderer.on('topology:updated', listener)
    return () => ipcRenderer.removeListener('topology:updated', listener)
  }
}

/** The shape of window.api; declared for the renderer in index.d.ts. */
export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
