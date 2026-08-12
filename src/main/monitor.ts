// Network monitoring ledger + alerts (Phase 3). Remembers every device the
// scanner has ever observed in known.json (keyed by MAC when known, IP
// otherwise) and derives new-device / back-online / went-offline alerts by
// reconciling the ledger against each completed scan. Alerts are buffered in
// memory so a freshly opened window can replay them, and the main process
// pushes each alert to the renderer as it is produced.

import { app } from 'electron'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { HostResult, KnownDevice, MonitorEvent, ScanSummary } from '../shared/types'
import { expandTarget } from './scanner'

const MAX_EVENTS = 100

let ledger: Map<string, KnownDevice> | null = null
let events: MonitorEvent[] = []
let eventId = 0

function ledgerPath(): string {
  return join(app.getPath('userData'), 'known.json')
}

function loadLedger(): Map<string, KnownDevice> {
  if (ledger) return ledger
  ledger = new Map()
  try {
    const parsed = JSON.parse(readFileSync(ledgerPath(), 'utf8')) as Record<string, KnownDevice>
    for (const [key, value] of Object.entries(parsed)) {
      if (value && typeof value === 'object') ledger.set(key, value)
    }
  } catch {
    // First run (or corrupt file): start with an empty ledger.
  }
  return ledger
}

function persistLedger(): void {
  try {
    const dir = dirname(ledgerPath())
    mkdirSync(dir, { recursive: true })
    const tmp = `${ledgerPath()}.tmp`
    writeFileSync(tmp, JSON.stringify(Object.fromEntries(loadLedger()), null, 2), 'utf8')
    renameSync(tmp, ledgerPath())
  } catch {
    // Monitoring is best-effort; never crash the app over a write failure.
  }
}

/** Stable per-device identity: MAC when known, otherwise the IP. */
function deviceKey(host: HostResult): string {
  return (host.mac ?? host.ip).toLowerCase()
}

function pushEvent(type: MonitorEvent['type'], device: KnownDevice, at: string): MonitorEvent {
  const ev: MonitorEvent = { id: ++eventId, type, device, at }
  events.push(ev)
  if (events.length > MAX_EVENTS) events = events.slice(-MAX_EVENTS)
  return ev
}

/** Buffered alert history, oldest first. */
export function getMonitorEvents(): MonitorEvent[] {
  return [...events]
}

/** All known devices, sorted by IP. */
export function getKnownDevices(): KnownDevice[] {
  return [...loadLedger().values()].sort((a, b) => a.ip.localeCompare(b.ip, undefined, { numeric: true }))
}

/**
 * Every device the scanner has ever detected, as an offline HostResult. The
 * scan manager folds these into a scan's results so devices that sit inside
 * the scanned range but did not answer probes still show up — marked offline —
 * with the metadata saved in the ledger (hostname, MAC, vendor, type and
 * first/last-seen times all come from the database, not from the last scan).
 */
export function getKnownHosts(): HostResult[] {
  return [...loadLedger().values()].map((d): HostResult => ({
    ip: d.ip,
    status: 'offline',
    hostname: d.hostname,
    mac: d.mac,
    vendor: d.vendor,
    latencyMs: null,
    via: [],
    deviceType: d.deviceType,
    openPorts: [],
    firstSeen: d.firstSeen,
    lastSeen: d.lastSeen
  }))
}

/**
 * Reconciles the ledger against a completed scan and returns the alerts to
 * emit to the renderer:
 *  - a device never seen before → 'new'
 *  - a known device that was offline → 'online'
 *  - a known device that was online, sits inside the scanned range and is
 *    no longer present → 'offline'
 * Devices outside the scanned range are never flagged offline, so scanning a
 * small subset of the network can't produce false disappearance alerts.
 */
export function recordScan(summary: ScanSummary, hosts: HostResult[]): MonitorEvent[] {
  const table = loadLedger()
  const scannedIps = new Set(expandTarget(summary.target))
  const onlineByKey = new Map<string, HostResult>()
  for (const h of hosts) {
    if (h.status !== 'online') continue
    onlineByKey.set(deviceKey(h), h)
  }
  const out: MonitorEvent[] = []
  const at = new Date().toISOString()

  for (const [key, host] of onlineByKey) {
    const known = table.get(key)
    if (!known) {
      const device: KnownDevice = {
        key,
        ip: host.ip,
        mac: host.mac,
        hostname: host.hostname,
        vendor: host.vendor,
        deviceType: host.deviceType,
        firstSeen: at,
        lastSeen: at,
        lastState: 'online'
      }
      table.set(key, device)
      out.push(pushEvent('new', { ...device }, at))
    } else {
      const wasOnline = known.lastState === 'online'
      known.ip = host.ip
      known.mac = host.mac ?? known.mac
      known.hostname = host.hostname ?? known.hostname
      known.vendor = host.vendor ?? known.vendor
      known.deviceType = host.deviceType
      known.lastSeen = at
      known.lastState = 'online'
      if (!wasOnline) out.push(pushEvent('online', { ...known }, at))
    }
  }

  for (const device of table.values()) {
    if (device.lastState !== 'online') continue
    if (!scannedIps.has(device.ip)) continue
    if (onlineByKey.has(device.key)) continue
    device.lastState = 'offline'
    out.push(pushEvent('offline', { ...device }, at))
  }

  if (out.length > 0) persistLedger()
  return out
}

/** Wipes the known-device ledger (also clears the buffered alerts). */
export function resetLedger(): void {
  ledger = new Map()
  events = []
  persistLedger()
}

/** Raw ledger entries keyed by MAC (else IP), for full-data backups. */
export function getLedgerData(): Record<string, KnownDevice> {
  return Object.fromEntries(loadLedger())
}

/** Replaces the ledger wholesale (backup restore); clears buffered alerts. */
export function replaceLedger(entries: Record<string, KnownDevice>): void {
  ledger = new Map()
  for (const [key, value] of Object.entries(entries)) {
    if (value && typeof value === 'object') ledger.set(key, value)
  }
  events = []
  persistLedger()
}
