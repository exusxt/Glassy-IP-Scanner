/**
 * Backup / restore of the user-editable network-map settings. A backup is a
 * single self-contained JSON file holding the device profiles (names, notes,
 * tags, favorites, type overrides) plus the topology store (manual device→
 * switch connections and the cached SNMP tables). The file is versioned so a
 * future format change can be detected and rejected cleanly instead of being
 * silently misinterpreted.
 */

import { dialog, type BrowserWindow } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type {
  DeviceProfile,
  DeviceProfiles,
  MapBackupResult,
  MapRestoreResult,
  SwitchTable
} from '../shared/types'
import { getDevices, replaceDevices } from './devices'
import { getTopology, replaceTopology } from './topology'

const BACKUP_APP = 'Glassy IP Scanner'
const BACKUP_VERSION = 1

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
    version: BACKUP_VERSION,
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
  if (data.app !== BACKUP_APP || data.version !== BACKUP_VERSION) {
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
