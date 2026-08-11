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
