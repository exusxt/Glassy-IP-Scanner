/**
 * Backup / restore of the app's locally stored data. Two scopes share the same
 * on-disk format:
 *  - the map backup (version 1) covers the user-editable network-map settings —
 *    device profiles (names, notes, tags, favorites, type overrides) plus the
 *    topology store (manual device→switch connections and cached SNMP tables);
 *  - the full backup (version 2) additionally carries the app settings, the
 *    known-device monitoring ledger and the scan history, so a Settings-screen
 *    restore can move everything between machines.
 * Files are versioned so a future format change can be detected and rejected
 * cleanly instead of being silently misinterpreted; both restore paths accept
 * version 1 and 2 files (a full restore simply has more sections to apply).
 */

import { dialog, type BrowserWindow } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type {
  AppSettings,
  DataBackupCounts,
  DataBackupResult,
  DataRestoreResult,
  DeviceProfile,
  DeviceProfiles,
  HistoryEntry,
  KnownDevice,
  MapBackupResult,
  MapRestoreResult,
  SwitchTable
} from '../shared/types'
import { getDevices, replaceDevices } from './devices'
import { getHistory, replaceHistory } from './history'
import { getKnownDevices, getLedgerData, getMonitorEvents, replaceLedger } from './monitor'
import { getSettings, setSettings } from './settings'
import { getTopology, replaceTopology } from './topology'

const BACKUP_APP = 'Glassy IP Scanner'
const MAP_BACKUP_VERSION = 1
const FULL_BACKUP_VERSION = 2

// ---------------------------------------------------------------------------
// Validation of a parsed backup (defensive: the file may be hand-edited or
// come from another app, so never trust its shape blindly).
// ---------------------------------------------------------------------------

function parseDevices(value: unknown): DeviceProfiles {
  if (typeof value !== 'object' || value === null) return {}
  const out: DeviceProfiles = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (key && typeof val === 'object' && val !== null) out[key] = val as DeviceProfile
  }
  return out
}

function parseStringMap(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null) return {}
  const out: Record<string, string> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (typeof val === 'string' && val) out[key] = val
  }
  return out
}

function parseSwitchTables(value: unknown): Record<string, SwitchTable> {
  if (typeof value !== 'object' || value === null) return {}
  const out: Record<string, SwitchTable> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (typeof val !== 'object' || val === null) continue
    const t = val as Partial<SwitchTable>
    if (typeof t.ip !== 'string' || !Array.isArray(t.macs)) continue
    out[key] = {
      ip: t.ip,
      macs: t.macs.filter((m): m is string => typeof m === 'string'),
      at: typeof t.at === 'string' ? t.at : new Date().toISOString(),
      ok: t.ok === true,
      community: typeof t.community === 'string' ? t.community : null
    }
  }
  return out
}

function parseSettings(value: unknown): AppSettings {
  if (typeof value !== 'object' || value === null) return { autoUpdate: false, skipUpdateVersion: null }
  const s = value as Record<string, unknown>
  return {
    autoUpdate: s.autoUpdate === true,
    skipUpdateVersion: typeof s.skipUpdateVersion === 'string' ? s.skipUpdateVersion : null
  }
}

function parseLedger(value: unknown): Record<string, KnownDevice> {
  if (typeof value !== 'object' || value === null) return {}
  const out: Record<string, KnownDevice> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (key && typeof val === 'object' && val !== null) out[key] = val as KnownDevice
  }
  return out
}

function parseHistory(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) return []
  const out: HistoryEntry[] = []
  for (const val of value) {
    if (typeof val !== 'object' || val === null) continue
    const e = val as Partial<HistoryEntry>
    if (typeof e.id !== 'string') continue
    out.push({
      id: e.id,
      target: typeof e.target === 'string' ? e.target : '',
      startedAt: typeof e.startedAt === 'string' ? e.startedAt : '',
      finishedAt: typeof e.finishedAt === 'string' ? e.finishedAt : '',
      durationMs: typeof e.durationMs === 'number' ? e.durationMs : 0,
      total: typeof e.total === 'number' ? e.total : 0,
      online: typeof e.online === 'number' ? e.online : 0,
      devices: Array.isArray(e.devices) ? e.devices.filter((d): d is HistoryEntry['devices'][number] => !!d && typeof d === 'object') : []
    })
  }
  return out
}

/** True when the file's app marker and version are a supported backup. */
function isSupportedBackup(data: Record<string, unknown>): boolean {
  return (
    data.app === BACKUP_APP &&
    (data.version === MAP_BACKUP_VERSION || data.version === FULL_BACKUP_VERSION)
  )
}

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

/** Writes a versioned snapshot of device profiles + topology to a file. */
export async function backupMapSettings(win: BrowserWindow | null): Promise<MapBackupResult> {
  const devices = getDevices()
  const topology = getTopology()
  const options: Electron.SaveDialogOptions = {
    title: 'Back up network map settings',
    defaultPath: `glassy-map-settings-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'Glassy IP Scanner backup', extensions: ['json'] }]
  }
  const res = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
  if (res.canceled || !res.filePath) return { ok: false, cancelled: true, path: null }

  const payload = {
    app: BACKUP_APP,
    version: MAP_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    devices,
    topology: { bindings: topology.bindings, switchTables: topology.switchTables }
  }
  try {
    mkdirSync(dirname(res.filePath), { recursive: true })
    writeFileSync(res.filePath, JSON.stringify(payload, null, 2), 'utf8')
    return {
      ok: true,
      path: res.filePath,
      devicesCount: Object.keys(devices).length,
      bindingsCount: Object.keys(topology.bindings).length
    }
  } catch (err) {
    return { ok: false, path: res.filePath, error: `Could not write the backup: ${err instanceof Error ? err.message : String(err)}` }
  }
}

// ---------------------------------------------------------------------------
// Restore
// ---------------------------------------------------------------------------

/** Reads a backup file, replaces the stored profiles + topology, and returns the restored data. */
export async function restoreMapSettings(win: BrowserWindow | null): Promise<MapRestoreResult> {
  const empty = { devices: {}, bindings: {}, switchTables: {}, devicesCount: 0, bindingsCount: 0 }
  const options: Electron.OpenDialogOptions = {
    title: 'Restore network map settings',
    filters: [{ name: 'Glassy IP Scanner backup', extensions: ['json'] }],
    properties: ['openFile']
  }
  const res = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
  if (res.canceled || res.filePaths.length === 0) return { ok: false, cancelled: true, path: null, ...empty }

  const path = res.filePaths[0]
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return { ok: false, path, error: 'The selected file is not valid JSON.', ...empty }
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, path, error: 'The selected file is not valid JSON.', ...empty }
  }
  const data = parsed as Record<string, unknown>
  if (!isSupportedBackup(data)) {
    return {
      ok: false,
      path,
      error: 'This file is not a Glassy IP Scanner settings backup (unsupported format or version).',
      ...empty
    }
  }

  const topologyRaw =
    typeof data.topology === 'object' && data.topology !== null ? (data.topology as Record<string, unknown>) : {}
  const devices = parseDevices(data.devices)
  const bindings = parseStringMap(topologyRaw.bindings)
  const switchTables = parseSwitchTables(topologyRaw.switchTables)

  replaceDevices(devices)
  replaceTopology({ bindings, switchTables })
  return {
    ok: true,
    path,
    devices,
    bindings,
    switchTables,
    devicesCount: Object.keys(devices).length,
    bindingsCount: Object.keys(bindings).length
  }
}

// ---------------------------------------------------------------------------
// Full data backup / restore (all local stores)
// ---------------------------------------------------------------------------

function backupCounts(devices: DeviceProfiles, topology: { bindings: Record<string, string>; switchTables: Record<string, SwitchTable> }, ledger: Record<string, KnownDevice>, history: HistoryEntry[]): DataBackupCounts {
  return {
    devices: Object.keys(devices).length,
    bindings: Object.keys(topology.bindings).length,
    switchTables: Object.keys(topology.switchTables).length,
    knownDevices: Object.keys(ledger).length,
    historyEntries: history.length
  }
}

/** Writes a versioned snapshot of every local store to a single JSON file. */
export async function backupAllData(win: BrowserWindow | null): Promise<DataBackupResult> {
  const devices = getDevices()
  const topology = getTopology()
  const ledger = getLedgerData()
  const history = getHistory()
  const options: Electron.SaveDialogOptions = {
    title: 'Back up all Glassy IP Scanner data',
    defaultPath: `glassy-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'Glassy IP Scanner backup', extensions: ['json'] }]
  }
  const res = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
  if (res.canceled || !res.filePath) return { ok: false, cancelled: true, path: null }

  const payload = {
    app: BACKUP_APP,
    version: FULL_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: getSettings(),
    devices,
    topology: { bindings: topology.bindings, switchTables: topology.switchTables },
    ledger,
    history
  }
  try {
    mkdirSync(dirname(res.filePath), { recursive: true })
    writeFileSync(res.filePath, JSON.stringify(payload, null, 2), 'utf8')
    return { ok: true, path: res.filePath, counts: backupCounts(devices, topology, ledger, history) }
  } catch (err) {
    return { ok: false, path: res.filePath, error: `Could not write the backup: ${err instanceof Error ? err.message : String(err)}` }
  }
}

/**
 * Reads a backup file and replaces every local store with its contents.
 * Version 1 files (map-only) restore just profiles + topology; version 2 files
 * additionally restore settings, the monitoring ledger and scan history.
 */
export async function restoreAllData(win: BrowserWindow | null): Promise<DataRestoreResult> {
  const options: Electron.OpenDialogOptions = {
    title: 'Restore Glassy IP Scanner data',
    filters: [{ name: 'Glassy IP Scanner backup', extensions: ['json'] }],
    properties: ['openFile']
  }
  const res = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
  if (res.canceled || res.filePaths.length === 0) return { ok: false, cancelled: true, path: null }

  const path = res.filePaths[0]
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return { ok: false, path, error: 'The selected file is not valid JSON.' }
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, path, error: 'The selected file is not valid JSON.' }
  }
  const data = parsed as Record<string, unknown>
  if (!isSupportedBackup(data)) {
    return { ok: false, path, error: 'This file is not a Glassy IP Scanner data backup (unsupported format or version).' }
  }
  const isFull = data.version === FULL_BACKUP_VERSION

  const topologyRaw =
    typeof data.topology === 'object' && data.topology !== null ? (data.topology as Record<string, unknown>) : {}
  const devices = parseDevices(data.devices)
  const bindings = parseStringMap(topologyRaw.bindings)
  const switchTables = parseSwitchTables(topologyRaw.switchTables)

  replaceDevices(devices)
  replaceTopology({ bindings, switchTables })

  let settings: AppSettings | undefined
  let ledger: Record<string, KnownDevice> = {}
  let history: HistoryEntry[] = []
  if (isFull) {
    settings = parseSettings(data.settings)
    setSettings(settings)
    ledger = parseLedger(data.ledger)
    replaceLedger(ledger)
    history = parseHistory(data.history)
    replaceHistory(history)
  }

  return {
    ok: true,
    path,
    settings,
    devices,
    topology: { bindings, switchTables },
    knownDevices: getKnownDevices(),
    monitorEvents: getMonitorEvents(),
    counts: backupCounts(devices, { bindings, switchTables }, ledger, history)
  }
}
