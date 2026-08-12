/**
 * Shared type definitions for Glassy IP Scanner. These describe the contract
 * between the React renderer and the Electron main process, where the scanning
 * engine runs in Node.
 */

/** One local network interface (IPv4) discovered via os.networkInterfaces(). */
export interface NetworkInterface {
  name: string
  ip: string
  netmask: string
  /** CIDR notation for the interface, e.g. "192.168.1.0/24". */
  cidr: string
  mac: string | null
  internal: boolean
}

/** Which discovery methods are enabled for a scan. */
export interface ScanMethods {
  icmp: boolean
  tcp: boolean
  arp: boolean
}

/** User-configurable scan parameters. */
export interface ScanOptions {
  /** CIDR ("192.168.1.0/24"), single host ("192.168.1.5") or range ("192.168.1.10-192.168.1.40"). */
  target: string
  concurrency: number
  timeoutMs: number
  retries: number
  methods: ScanMethods
  /** Ports probed when the TCP discovery method is enabled. */
  tcpPorts: number[]
}

/** Online/offline state of a scanned host. */
export type HostStatus = 'online' | 'offline'

/** Best-effort device type classification (Phase 2, heuristic). */
export type DeviceTypeId =
  | 'router'
  | 'switch'
  | 'printer'
  | 'nas'
  | 'camera'
  | 'tv'
  | 'speaker'
  | 'phone'
  | 'tablet'
  | 'laptop'
  | 'computer'
  | 'console'
  | 'rpi'
  | 'server'
  | 'smart-device'
  | 'unknown'

/** A discovered host. */
export interface HostResult {
  ip: string
  status: HostStatus
  hostname: string | null
  mac: string | null
  vendor: string | null
  /** Fastest round-trip time in ms, or null when no probe measured a latency. */
  latencyMs: number | null
  /** Discovery methods that detected the host (e.g. ["icmp", "tcp"]). */
  via: string[]
  /** Best-effort device type guess from vendor/hostname/gateway heuristics. */
  deviceType: DeviceTypeId
  /** True when this address is the IPv4 default gateway (real router). */
  isGateway?: boolean
  /** Open TCP ports found by the built-in port scanner. */
  openPorts: number[]
  firstSeen: string
  lastSeen: string
}

/** Options for a standalone TCP port scan over online hosts. */
export interface PortScanOptions {
  ips: string[]
  ports: number[]
  timeoutMs: number
}

/** Live counts pushed while a port scan runs. */
export interface PortScanProgress {
  scanned: number
  total: number
  currentIp: string
}

/** Live counts pushed while a scan runs. */
export interface ScanProgress {
  total: number
  done: number
  online: number
}

/** Summary emitted when a scan finishes. */
export interface ScanSummary {
  target: string
  startedAt: string
  finishedAt: string
  durationMs: number
  total: number
  online: number
}

/** Streamed events pushed from main to the renderer during a scan. */
export type ScanEvent =
  | { type: 'progress'; progress: ScanProgress }
  | { type: 'host'; host: HostResult }
  | { type: 'done'; summary: ScanSummary }
  | { type: 'log'; level: 'info' | 'warn' | 'error'; message: string }
  | { type: 'portProgress'; progress: PortScanProgress }
  | { type: 'portDone'; scanned: number; open: number }

/** Overall state machine of the scanner as seen from the UI. */
export type ScanStatus = 'idle' | 'running' | 'paused' | 'finished' | 'cancelled'

/** Snapshot of the scanner state, returned when the UI asks for it. */
export interface ScanState {
  status: ScanStatus
  summary: ScanSummary | null
  /** Hosts found so far (offline entries included once probed). */
  hosts: HostResult[]
}

/** User-editable application settings, persisted to settings.json in userData. */
export interface AppSettings {
  /** When true, updates download automatically instead of asking each time. */
  autoUpdate: boolean
  /** Version the user chose to skip; its prompt will not show again. */
  skipUpdateVersion: string | null
}

/** User-editable profile for a known device (keyed by MAC in devices.json). */
export interface DeviceProfile {
  customName: string | null
  notes: string | null
  tags: string[]
  favorite: boolean
  /**
   * Manual device-type override; null means "keep the auto-detected type".
   * Lets users correct misclassified gear (e.g. a Netgear switch read as a
   * router) and is persisted like the other profile fields.
   */
  deviceType: DeviceTypeId | null
}

/** All device profiles, keyed by the normalized MAC (or IP when no MAC). */
export type DeviceProfiles = Record<string, DeviceProfile>

/** Live phase of the built-in updater (electron-updater / GitHub Releases). */
export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'not-available'
  | 'error'

/** Snapshot of the updater, pushed to the renderer on every transition. */
export interface UpdateState {
  phase: UpdatePhase
  /** Version of the pending update, when known. */
  version: string | null
  /** Download progress in percent (0-100) while downloading. */
  progress: number
  /** Human-readable error message while in the 'error' phase. */
  error: string | null
  autoUpdate: boolean
}

// ---------------------------------------------------------------------------
// Phase 3 — Device monitoring
// ---------------------------------------------------------------------------

/**
 * A device tracked by the monitoring ledger (persisted in known.json). Keyed
 * by the MAC address when known, otherwise by the IP. The ledger remembers
 * first/last-seen times and the last online state so alerts can be derived.
 */
export interface KnownDevice {
  key: string
  ip: string
  mac: string | null
  hostname: string | null
  vendor: string | null
  deviceType: DeviceTypeId
  /** First scan in which this device was ever observed. */
  firstSeen: string
  /** Most recent scan in which this device was observed. */
  lastSeen: string
  lastState: 'online' | 'offline' | null
}

/** The kinds of alerts the monitor can emit. */
export type MonitorEventType = 'new' | 'online' | 'offline'

/** A single new-device / online / offline alert pushed to the renderer. */
export interface MonitorEvent {
  id: number
  type: MonitorEventType
  device: KnownDevice
  at: string
}

// ---------------------------------------------------------------------------
// Phase 3 — Scan history
// ---------------------------------------------------------------------------

/** Snapshot of one device stored inside a scan-history entry. */
export interface HistoryDevice {
  /** Stable identity: MAC when known, otherwise the IP. */
  key: string
  ip: string
  mac: string | null
  hostname: string | null
  vendor: string | null
  deviceType: DeviceTypeId
  openPorts: number[]
}

/** One persisted scan record (summary + device snapshot) in history.json. */
export interface HistoryEntry {
  id: string
  target: string
  startedAt: string
  finishedAt: string
  durationMs: number
  total: number
  online: number
  devices: HistoryDevice[]
}

/** Result of comparing two history entries by device identity (MAC/IP). */
export interface HistoryDiff {
  /** Devices present in B but not in A. */
  added: HistoryDevice[]
  /** Devices present in A but not in B. */
  removed: HistoryDevice[]
  /** Devices present in both whose ip/hostname/type/ports changed. */
  changed: Array<{
    key: string
    from: HistoryDevice
    to: HistoryDevice
    /** Human-readable change descriptions, e.g. "IP 192.168.1.5 → 192.168.1.9". */
    changes: string[]
  }>
  /** Devices present in both with no detected changes. */
  unchanged: number
}

// ---------------------------------------------------------------------------
// Phase 3 — Switch-aware network topology
// ---------------------------------------------------------------------------

/** MAC-address table of one managed switch, read over SNMP. */
export interface SwitchTable {
  ip: string
  /** Normalized MACs (uppercase, no separators) seen on this switch's ports. */
  macs: string[]
  /** When the table was read. */
  at: string
  /** True when SNMP responded and produced a table. */
  ok: boolean
  /** Community string that worked, when any. */
  community: string | null
}

/**
 * Everything the map needs to draw a switch-aware topology: the cached SNMP
 * MAC tables per switch, plus the user's manual device→switch overrides.
 */
export interface TopologyData {
  /** Keyed by switch IP. */
  switchTables: Record<string, SwitchTable>
  /** Manual overrides: device key (MAC/IP) → switch IP or "router". */
  bindings: Record<string, string>
}

// ---------------------------------------------------------------------------
// Phase 3 — Map settings backup / restore
// ---------------------------------------------------------------------------

/** Result of backing up the network-map device settings to a JSON file. */
export interface MapBackupResult {
  ok: boolean
  /** True when the user cancelled the save dialog. */
  cancelled?: boolean
  /** Path the backup was written to (null when cancelled/failed). */
  path: string | null
  /** Human-readable error message when the backup failed. */
  error?: string
  /** Number of device profiles included in the backup. */
  devicesCount?: number
  /** Number of manual device→switch connections included. */
  bindingsCount?: number
}

/** Result of restoring network-map device settings from a JSON file. */
export interface MapRestoreResult {
  ok: boolean
  /** True when the user cancelled the open dialog. */
  cancelled?: boolean
  /** Path the backup was read from (null when cancelled/failed). */
  path: string | null
  /** Human-readable error message when the restore failed. */
  error?: string
  /** The restored profile store, returned so the renderer can refresh. */
  devices: DeviceProfiles
  /** The restored manual device→switch connections. */
  bindings: Record<string, string>
  /** The restored cached SNMP switch tables. */
  switchTables: Record<string, SwitchTable>
  devicesCount: number
  bindingsCount: number
}
