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
  firstSeen: string
  lastSeen: string
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

/** Overall state machine of the scanner as seen from the UI. */
export type ScanStatus = 'idle' | 'running' | 'paused' | 'finished' | 'cancelled'

/** Snapshot of the scanner state, returned when the UI asks for it. */
export interface ScanState {
  status: ScanStatus
  summary: ScanSummary | null
  /** Hosts found so far (offline entries included once probed). */
  hosts: HostResult[]
}
