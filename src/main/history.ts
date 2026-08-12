// Scan-history store (Phase 3). Every completed discovery scan appends an
// entry (summary + a snapshot of the online devices) to history.json in the
// app's userData directory. Entries feed the History screen and the scan
// comparison diff. Same pattern as the settings/devices stores: lazy-loaded,
// cached, written atomically (tmp + rename), capped to keep the file small.

import { app } from 'electron'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { HistoryDevice, HistoryDiff, HistoryEntry, HostResult, ScanSummary } from '../shared/types'

const MAX_ENTRIES = 50

let cache: HistoryEntry[] | null = null

function historyPath(): string {
  return join(app.getPath('userData'), 'history.json')
}

function load(): HistoryEntry[] {
  if (cache) return cache
  try {
    const parsed = JSON.parse(readFileSync(historyPath(), 'utf8')) as HistoryEntry[]
    cache = Array.isArray(parsed) ? parsed : []
  } catch {
    cache = []
  }
  return cache
}

function persist(): void {
  try {
    const dir = dirname(historyPath())
    mkdirSync(dir, { recursive: true })
    const tmp = `${historyPath()}.tmp`
    writeFileSync(tmp, JSON.stringify(cache, null, 2), 'utf8')
    renameSync(tmp, historyPath())
  } catch {
    // History is best-effort; never crash the app over a write failure.
  }
}

/** Stable per-device identity: MAC when known, otherwise the IP. */
function deviceKey(host: HostResult | HistoryDevice): string {
  return (host.mac ?? host.ip).toLowerCase()
}

/** Records a completed scan; returns the stored entry, or null for no-op scans. */
export function recordScan(summary: ScanSummary, hosts: HostResult[]): HistoryEntry | null {
  if (summary.total === 0) return null
  const entry: HistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    target: summary.target,
    startedAt: summary.startedAt,
    finishedAt: summary.finishedAt,
    durationMs: summary.durationMs,
    total: summary.total,
    online: summary.online,
    devices: hosts
      .filter((h) => h.status === 'online')
      .map((h) => ({
        key: deviceKey(h),
        ip: h.ip,
        mac: h.mac ? h.mac.toLowerCase() : null,
        hostname: h.hostname,
        vendor: h.vendor,
        deviceType: h.deviceType,
        openPorts: [...h.openPorts]
      }))
  }
  const list = load()
  list.unshift(entry)
  cache = list.slice(0, MAX_ENTRIES)
  persist()
  return entry
}

/** All stored history entries, newest first. */
export function getHistory(): HistoryEntry[] {
  return load()
}

/** Wipes all stored history entries. */
export function clearHistory(): void {
  cache = []
  persist()
}

/** Replaces the stored history wholesale (backup restore), capped like writes. */
export function replaceHistory(entries: HistoryEntry[]): void {
  cache = Array.isArray(entries) ? entries.slice(0, MAX_ENTRIES) : []
  persist()
}

/** Compares two history entries by device identity; null if either id is unknown. */
export function diffScans(aId: string, bId: string): HistoryDiff | null {
  const list = load()
  const a = list.find((e) => e.id === aId)
  const b = list.find((e) => e.id === bId)
  if (!a || !b) return null
  const aByKey = new Map(a.devices.map((d) => [d.key, d]))
  const bByKey = new Map(b.devices.map((d) => [d.key, d]))
  const added: HistoryDevice[] = []
  const removed: HistoryDevice[] = []
  const changed: HistoryDiff['changed'] = []
  let unchanged = 0
  for (const [key, bd] of bByKey) {
    const ad = aByKey.get(key)
    if (!ad) {
      added.push(bd)
      continue
    }
    const changes = diffDevice(ad, bd)
    if (changes.length > 0) changed.push({ key, from: ad, to: bd, changes })
    else unchanged++
  }
  for (const [key, ad] of aByKey) {
    if (!bByKey.has(key)) removed.push(ad)
  }
  const byIp = (x: HistoryDevice, y: HistoryDevice): number => x.ip.localeCompare(y.ip, undefined, { numeric: true })
  added.sort(byIp)
  removed.sort(byIp)
  return { added, removed, changed, unchanged }
}

/** Lists the differences between two snapshots of the same device. */
function diffDevice(from: HistoryDevice, to: HistoryDevice): string[] {
  const changes: string[] = []
  if (from.ip !== to.ip) changes.push(`IP ${from.ip} → ${to.ip}`)
  if ((from.hostname ?? null) !== (to.hostname ?? null)) changes.push(`Hostname ${from.hostname ?? '—'} → ${to.hostname ?? '—'}`)
  if (from.deviceType !== to.deviceType) changes.push(`Type ${from.deviceType} → ${to.deviceType}`)
  const portsFrom = from.openPorts.join(',')
  const portsTo = to.openPorts.join(',')
  if (portsFrom !== portsTo) {
    changes.push(`Open ports ${from.openPorts.length > 0 ? from.openPorts.join(', ') : 'none'} → ${to.openPorts.length > 0 ? to.openPorts.join(', ') : 'none'}`)
  }
  return changes
}
