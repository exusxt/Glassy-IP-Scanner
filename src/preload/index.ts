// Preload bridge: the only script that runs in the isolated renderer context.
// It exposes a typed, promise-based window.api to the React renderer. Every
// method is a thin ipcRenderer.invoke/send wrapper over the main-process IPC.

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { AppSettings, NetworkInterface, ScanEvent, ScanOptions, ScanState, UpdateState } from '../shared/types'

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
  }
}

/** The shape of window.api; declared for the renderer in index.d.ts. */
export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
