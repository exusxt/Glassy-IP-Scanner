/**
 * The Glassy IP Scanner engine. Runs entirely in the Electron main process
 * using Node's networking stack: no Python, no native modules, no cloud calls.
 *
 * Discovery methods (Phase 1):
 *  - ICMP echo via the system `ping` binary
 *  - TCP connect probes against a configurable port list
 *  - ARP cache reads (`arp -a`) for local MAC/vendor enrichment
 *
 * The engine streams ScanEvent payloads to any listener (the renderer, via the
 * main-process IPC bridge) while probing hosts with a configurable concurrency,
 * and supports pause/resume/cancel through a small state machine.
 */

import { execFile } from 'node:child_process'
import dgram from 'node:dgram'
import dns from 'node:dns'
import { EventEmitter } from 'node:events'
import net from 'node:net'
import os from 'node:os'
import type {
  HostResult,
  NetworkInterface,
  ScanEvent,
  ScanOptions,
  ScanProgress,
  ScanState,
  ScanStatus,
  ScanSummary
} from '../shared/types'
import { lookupVendor, normalizeMac } from './vendors'

// ---------------------------------------------------------------------------
// Network / address helpers
// ---------------------------------------------------------------------------

function ipToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0
}

function intToIp(value: number): string {
  return [24, 16, 8, 0].map((shift) => (value >>> shift) & 0xff).join('.')
}

function netmaskToCidrBits(netmask: string): number {
  return netmask.split('.').reduce((acc, octet) => acc + countBits(Number(octet)), 0)
}

function countBits(value: number): number {
  let count = 0
  let v = value
  while (v > 0) {
    v &= v - 1
    count++
  }
  return count
}

/**
 * Expands a scan target into a sorted list of IPv4 addresses.
 * Accepts CIDR ("192.168.1.0/24"), a single host ("192.168.1.5"),
 * a full range ("192.168.1.10-192.168.1.40") or a short range ("192.168.1.10-40").
 */
export function expandTarget(target: string): string[] {
  const t = target.trim()
  if (t.includes('/')) return expandCidr(t)
  if (t.includes('-')) return expandRange(t)
  if (isValidIpv4(t)) return [t]
  return []
}

function expandCidr(cidr: string): string[] {
  const [net, prefixStr] = cidr.split('/')
  const prefix = Number(prefixStr)
  if (!isValidIpv4(net) || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return []
  const netInt = ipToInt(net) & maskBits(prefix)
  const size = 2 ** (32 - prefix)
  const first = prefix >= 31 ? 0 : 1
  const last = prefix >= 31 ? size - 1 : size - 2
  const hosts: string[] = []
  for (let i = first; i <= last; i++) hosts.push(intToIp((netInt + i) >>> 0))
  return hosts
}

function expandRange(range: string): string[] {
  const [a, b] = range.split('-').map((s) => s.trim())
  if (!isValidIpv4(a)) return []
  let end: string
  if (isValidIpv4(b)) {
    end = b
  } else if (/^\d{1,3}$/.test(b)) {
    const parts = a.split('.')
    end = `${parts[0]}.${parts[1]}.${parts[2]}.${b}`
  } else {
    return []
  }
  const startInt = ipToInt(a)
  const endInt = ipToInt(end)
  if (startInt > endInt) return []
  const hosts: string[] = []
  for (let i = startInt; i <= endInt; i++) hosts.push(intToIp(i))
  return hosts
}

function maskBits(bits: number): number {
  return bits === 0 ? 0 : ~((1 << (32 - bits)) - 1) >>> 0
}

function isValidIpv4(ip: string): boolean {
  const parts = ip.split('.')
  if (parts.length !== 4) return false
  return parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) >= 0 && Number(p) <= 255)
}

/** Enumerates the machine's IPv4 interfaces, excluding link-local/internal ones. */
export function listInterfaces(): NetworkInterface[] {
  const out: NetworkInterface[] = []
  const nets = os.networkInterfaces()
  for (const [name, infos] of Object.entries(nets)) {
    for (const info of infos ?? []) {
      if (info.family !== 'IPv4') continue
      if (info.internal) continue
      if (info.address.startsWith('169.254.')) continue
      if (info.address.startsWith('127.')) continue
      const bits = netmaskToCidrBits(info.netmask)
      const network = intToIp(ipToInt(info.address) & maskBits(bits))
      out.push({
        name,
        ip: info.address,
        netmask: info.netmask,
        cidr: `${network}/${bits}`,
        mac: info.mac && info.mac !== '00:00:00:00:00:00' ? info.mac : null,
        internal: info.internal
      })
    }
  }
  return out.sort((x, y) => x.ip.localeCompare(y.ip, undefined, { numeric: true }))
}

// ---------------------------------------------------------------------------
// Discovery primitives
// ---------------------------------------------------------------------------

/** Runs the platform's ping once against an IP; returns up + latency in ms. */
function pingProbe(ip: string, timeoutMs: number, signal: AbortSignal): Promise<{ up: boolean; ms: number | null }> {
  return new Promise((resolve) => {
    const platform = process.platform
    const args =
      platform === 'win32'
        ? ['-n', '1', '-w', String(timeoutMs), ip]
        : platform === 'darwin'
          ? ['-c', '1', '-W', String(Math.max(timeoutMs, 200)), ip]
          : ['-c', '1', '-W', '1', ip]
    execFile('ping', args, { timeout: timeoutMs + 500, signal }, (err, stdout) => {
      const e = err as NodeJS.ErrnoException & { code?: number | string } | null
      const code = err === null ? 0 : typeof e?.code === 'number' ? e.code : -1
      const out = stdout ?? ''
      const up = code === 0 && /(TTL=|time[=<]|bytes=)/i.test(out)
      const m = /time[=<]\s*([\d.]+)\s*ms/i.exec(out)
      resolve({ up, ms: up && m ? Number(m[1]) : null })
    })
  })
}

/** TCP connect probes against several ports; resolves with the best latency. */
function tcpProbe(
  ip: string,
  ports: number[],
  timeoutMs: number,
  signal: AbortSignal
): Promise<{ up: boolean; ms: number | null }> {
  return new Promise((resolve) => {
    if (ports.length === 0) {
      resolve({ up: false, ms: null })
      return
    }
    let up = false
    let best = Infinity
    let pending = ports.length
    const sockets = new Set<net.Socket>()
    const onAbort = (): void => {
      for (const s of sockets) s.destroy()
    }
    signal.addEventListener('abort', onAbort, { once: true })
    for (const port of ports) {
      const sock = net.connect({ host: ip, port, family: 4 })
      sockets.add(sock)
      const t0 = Date.now()
      sock.setTimeout(timeoutMs)
      sock.once('connect', () => {
        up = true
        best = Math.min(best, Date.now() - t0)
        sock.destroy()
      })
      sock.once('timeout', () => sock.destroy())
      sock.once('error', () => sock.destroy())
      sock.once('close', () => {
        sockets.delete(sock)
        if (--pending === 0) {
          signal.removeEventListener('abort', onAbort)
          resolve({ up, ms: up ? best : null })
        }
      })
    }
  })
}

/**
 * Collects the DNS servers to ask for PTR lookups: the system's configured
 * servers plus the default gateway (the router, which on home/office LANs
 * holds the authoritative PTR records for every DHCP client, e.g. fritz.box).
 * Node's built-in resolver only consults `dns.getServers()`, which can be a
 * loopback filter (AdGuard/pi-hole on 127.0.0.1) that answers NXDOMAIN for
 * local reverse queries. Returns an ordered, de-duplicated IPv4 list.
 */
async function discoverDnsServers(): Promise<string[]> {
  const servers: string[] = []
  const add = (s: string): void => {
    if (s && isValidIpv4(s) && !servers.includes(s)) servers.push(s)
  }
  const gw = await defaultGateway()
  if (gw) add(gw)
  for (const s of dns.getServers()) add(s)
  return servers
}

/** Resolves the IPv4 default gateway from the OS routing table. */
async function defaultGateway(): Promise<string | null> {
  try {
    if (process.platform === 'win32') {
      const out = await runCmd('route', ['print', '-4', '0.0.0.0'], 4000)
      const m = /^\s*0\.0\.0\.0\s+0\.0\.0\.0\s+(\d{1,3}(?:\.\d{1,3}){3})/m.exec(out)
      return m ? m[1] : null
    }
    if (process.platform === 'linux') {
      const out = await runCmd('ip', ['route', 'show', 'default'], 4000)
      const m = /default\s+via\s+(\d{1,3}(?:\.\d{1,3}){3})/.exec(out)
      return m ? m[1] : null
    }
    if (process.platform === 'darwin') {
      const out = await runCmd('route', ['-n', 'get', 'default'], 4000)
      const m = /gateway:\s+(\d{1,3}(?:\.\d{1,3}){3})/.exec(out)
      return m ? m[1] : null
    }
  } catch {
    // best effort
  }
  return null
}

/** Caches the discovered DNS servers across hosts in one scan. */
let dnsServersPromise: Promise<string[]> | null = null

function getDnsServers(): Promise<string[]> {
  dnsServersPromise ??= discoverDnsServers()
  return dnsServersPromise
}

function reverseDns(ip: string, timeoutMs: number, signal: AbortSignal): Promise<string | null> {
  return new Promise((resolve) => {
    let done = false
    const finish = (v: string | null): void => {
      if (done) return
      done = true
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      resolve(v)
    }
    const timer = setTimeout(() => finish(null), timeoutMs)
    const onAbort = (): void => finish(null)
    signal.addEventListener('abort', onAbort, { once: true })
    void (async () => {
      const servers = await getDnsServers()
      if (done) return
      const resolver = new dns.promises.Resolver()
      try {
        resolver.setServers(servers.length > 0 ? servers : dns.getServers())
      } catch {
        finish(null)
        return
      }
      resolver
        .reverse(ip)
        .then((names) => finish(names[0]?.replace(/\.$/, '') ?? null))
        .catch(() => finish(null))
    })()
  })
}

// ---------------------------------------------------------------------------
// DNS packet helpers (for the built-in mDNS reverse lookup below)
// ---------------------------------------------------------------------------

/** Appends a DNS name (length-prefixed labels) to a buffer. */
function appendDnsName(buf: Buffer, name: string): Buffer {
  for (const label of name.split('.')) {
    if (!label) continue
    buf = Buffer.concat([buf, Buffer.from([label.length]), Buffer.from(label, 'latin1')])
  }
  return Buffer.concat([buf, Buffer.from([0])])
}

/** Decodes a possibly-compressed DNS name; `next` is the offset past it. */
function readDnsName(buf: Buffer, start: number): { name: string; next: number } | null {
  let offset = start
  let name = ''
  let next = -1
  let jumps = 0
  while (offset < buf.length && jumps++ < 64) {
    const len = buf[offset]
    if (len === 0) {
      if (next < 0) next = offset + 1
      return { name, next }
    }
    if ((len & 0xc0) === 0xc0) {
      if (offset + 1 >= buf.length) return null
      if (next < 0) next = offset + 2
      offset = ((len & 0x3f) << 8) | buf[offset + 1]
      continue
    }
    offset++
    if (offset + len > buf.length) return null
    name += buf.toString('latin1', offset, offset + len) + '.'
    offset += len
  }
  return null
}

/** Builds an mDNS PTR query for the reverse name of `ip`. */
function buildMDnsPtrQuery(ip: string): Buffer {
  const header = Buffer.alloc(12)
  header.writeUInt16BE(0, 0) // mDNS uses id 0 for legacy multicast queries
  header.writeUInt16BE(0x0000, 2)
  header.writeUInt16BE(1, 4)
  const qname = `${ip.split('.').reverse().join('.')}.in-addr.arpa`
  let body = appendDnsName(Buffer.alloc(0), qname)
  const qtail = Buffer.alloc(4)
  qtail.writeUInt16BE(12, 0) // PTR
  qtail.writeUInt16BE(1, 2) // IN
  body = Buffer.concat([body, qtail])
  return Buffer.concat([header, body])
}

/** Returns the name of the first question in a DNS/mDNS message. */
function parseQuestionName(msg: Buffer): string | null {
  if (msg.length < 12) return null
  const res = readDnsName(msg, 12)
  return res ? res.name.replace(/\.$/, '') : null
}

/** Returns the first PTR record (hostname) in a DNS/mDNS response. */
function parsePtrAnswer(msg: Buffer): string | null {
  if (msg.length < 12) return null
  const qdcount = msg.readUInt16BE(4)
  const ancount = msg.readUInt16BE(6)
  let offset = 12
  for (let i = 0; i < qdcount; i++) {
    const res = readDnsName(msg, offset)
    if (!res) return null
    offset = res.next + 4
  }
  for (let i = 0; i < ancount; i++) {
    const res = readDnsName(msg, offset)
    if (!res) return null
    const type = msg.readUInt16BE(res.next)
    const rdlength = msg.readUInt16BE(res.next + 8)
    const rdata = res.next + 10
    if (type === 12) {
      const ptr = readDnsName(msg, rdata)
      if (ptr && ptr.name) return ptr.name.replace(/\.$/, '')
    }
    offset = rdata + rdlength
  }
  return null
}

/**
 * Some devices answer mDNS with a placeholder name when their hostname was
 * never configured (Fire TV / Echo sticks report "none", "none-3", etc.).
 * Those are not useful to display and must not hide the vendor fallback.
 */
const MDNS_PLACEHOLDER = /^(none(-\d+)?|localhost|undefined|unknown|unconfigured)$/i

/** True when `name` looks like a real hostname worth displaying. */
function isUsableHostname(name: string | null): name is string {
  if (!name) return false
  if (MDNS_PLACEHOLDER.test(name)) return false
  return /^[\w.-]{1,253}$/.test(name)
}

/**
 * Best-effort mDNS reverse (PTR) lookup for `ip` via the standard mDNS
 * multicast group. Many LAN devices that never answer NetBIOS or classic
 * reverse-DNS (AVM routers, repeaters, smart-home and Apple gear) do answer
 * mDNS. Returns null on timeout, network failure or firewall blocks.
 */
function mDnsReverse(ip: string, timeoutMs: number, signal: AbortSignal): Promise<string | null> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4')
    const reverseName = `${ip.split('.').reverse().join('.')}.in-addr.arpa`
    let done = false
    const finish = (v: string | null): void => {
      if (done) return
      done = true
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      try {
        socket.close()
      } catch {
        // ignore close errors
      }
      resolve(v)
    }
    const timer = setTimeout(() => finish(null), timeoutMs)
    const onAbort = (): void => finish(null)
    signal.addEventListener('abort', onAbort, { once: true })
    socket.on('error', () => finish(null))
    socket.on('message', (msg) => {
      const question = parseQuestionName(msg)
      if (question !== null && question !== reverseName) return
      const name = parsePtrAnswer(msg)
      if (name) finish(name.replace(/\.local$/i, ''))
    })
    socket.bind(0, () => {
      try {
        socket.setMulticastTTL(1)
        socket.addMembership('224.0.0.251')
      } catch {
        // membership errors are non-fatal; unicast replies still arrive
      }
      socket.send(buildMDnsPtrQuery(ip), 5353, '224.0.0.251', (err) => {
        if (err) finish(null)
      })
    })
  })
}

/** Fresh ARP lookup for one address; used after a probe reveals a new host. */
async function arpLookup(ip: string): Promise<string | null> {
  if (process.platform === 'win32') {
    const out = await runCmd('arp', ['-a', ip], 3000)
    const m = /(\d{1,3}(?:\.\d{1,3}){3})\s+([0-9a-fA-F]{2}(?:[:-][0-9a-fA-F]{2}){5})/.exec(out)
    return m && m[1] === ip ? m[2] : null
  }
  if (process.platform === 'linux') {
    const out = await runCmd('ip', ['-4', 'neigh', 'show', ip], 3000)
    const m = /lladdr\s+([0-9a-fA-F]{2}(?::[0-9a-fA-F]{2}){5})/.exec(out)
    return m ? m[1].toLowerCase() : null
  }
  if (process.platform === 'darwin') {
    const out = await runCmd('arp', ['-n', ip], 3000)
    const m = /(?:at\s+)?([0-9a-fA-F]{2}(?::[0-9a-fA-F]{2}){5})/.exec(out)
    return m ? m[1] : null
  }
  return null
}

/**
 * Runs a command and returns its stdout (empty string on any failure). Used by
 * the optional, platform-specific discovery helpers below — a missing tool is
 * not an error, it simply yields nothing.
 */
function runCmd(cmd: string, args: string[], timeoutMs: number, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: timeoutMs, signal, windowsHide: true }, (_err, stdout) => resolve(stdout ?? ''))
  })
}

/**
 * Parses a NetBIOS name table from `nbtstat -A` (Windows) or `nmblookup -A`
 * (Linux). The output is locale-dependent, but the "<XX>" type markers are
 * always ASCII, so we key off those instead of the status words. Rows look
 * like:  "    DESKTOP-ABC123     <00>  UNIQUE  Registered"
 */
function parseNetbiosTable(stdout: string): string | null {
  const re = /^\s*(\S[\w.-]*)\s*<([0-9a-fA-F]{2})>/gm
  const names = new Map<string, string>()
  let m: RegExpExecArray | null
  while ((m = re.exec(stdout)) !== null) {
    names.set(m[2].toUpperCase(), m[1])
  }
  // Prefer the File Server name (<20>), fall back to Workstation (<00>).
  return names.get('20') ?? names.get('00') ?? null
}

/** Resolves a LAN hostname via NetBIOS (`nbtstat -A`, Windows only). */
function netbiosName(ip: string, timeoutMs: number, signal: AbortSignal): Promise<string | null> {
  if (process.platform !== 'win32') return Promise.resolve(null)
  return runCmd('nbtstat', ['-A', ip], timeoutMs + 500, signal).then((out) => (out ? parseNetbiosTable(out) : null))
}

/** Resolves a LAN hostname via mDNS (`avahi-resolve -a`, Linux, if installed). */
function mDnsName(ip: string, timeoutMs: number, signal: AbortSignal): Promise<string | null> {
  if (process.platform !== 'linux') return Promise.resolve(null)
  return runCmd('avahi-resolve', ['-a', ip], timeoutMs + 500, signal).then((out) => {
    // Output is "<ip>     <hostname>.local"; strip the mDNS suffix for display.
    const m = /^\s*\d{1,3}(?:\.\d{1,3}){3}\s+([\w.-]+?)(?:\.local)?\s*$/m.exec(out)
    return m ? m[1] : null
  })
}

/** Resolves a LAN hostname via NetBIOS (`nmblookup -A`, Linux/Samba, if installed). */
function sambaNetbiosName(ip: string, timeoutMs: number, signal: AbortSignal): Promise<string | null> {
  if (process.platform !== 'linux') return Promise.resolve(null)
  return runCmd('nmblookup', ['-A', ip], timeoutMs + 500, signal).then((out) => (out ? parseNetbiosTable(out) : null))
}

/** Reads the system ARP cache into an ip -> MAC map (empty on failure). */
export async function readArpTable(): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  // `arp -a` ships with Windows/macOS and most Linux distros; parse both the
  // POSIX "? (1.2.3.4) at aa:bb:cc:dd:ee:ff" and Windows "1.2.3.4  aa-bb-..." styles.
  const arpOut = await runCmd('arp', ['-a'], 5000)
  let m: RegExpExecArray | null
  const re = /(\d{1,3}(?:\.\d{1,3}){3})[\s(]+(?:at\s+)?([0-9a-fA-F]{2}(?:[:-][0-9a-fA-F]{2}){5})/g
  while ((m = re.exec(arpOut)) !== null) {
    if (isValidIpv4(m[1])) map.set(m[1], m[2])
  }
  // On Linux the `arp` command needs net-tools, which is missing from many
  // modern distros. `ip neigh` (iproute2) is always present there, so fall back.
  if (map.size === 0 && process.platform === 'linux') {
    const neighOut = await runCmd('ip', ['-4', 'neigh', 'show'], 5000)
    // Row format:  "192.168.1.5  dev eth0  lladdr aa:bb:cc:dd:ee:ff  REACHABLE"
    const neighRe = /(\d{1,3}(?:\.\d{1,3}){3})\s+.*?\blladdr\s+([0-9a-fA-F]{2}(?::[0-9a-fA-F]{2}){5})/g
    while ((m = neighRe.exec(neighOut)) !== null) {
      if (isValidIpv4(m[1])) map.set(m[1], m[2].toLowerCase())
    }
  }
  return map
}

// ---------------------------------------------------------------------------
// Worker pool
// ---------------------------------------------------------------------------

async function runWorkers<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>): Promise<void> {
  if (items.length === 0) return
  let next = 0
  const count = Math.max(1, Math.min(concurrency, items.length))
  const run = async (): Promise<void> => {
    while (true) {
      const i = next++
      if (i >= items.length) return
      await worker(items[i])
    }
  }
  await Promise.all(Array.from({ length: count }, () => run()))
}

// ---------------------------------------------------------------------------
// Scan manager
// ---------------------------------------------------------------------------

export class ScanManager extends EventEmitter {
  private status: ScanStatus = 'idle'
  private hosts: HostResult[] = []
  private summary: ScanSummary | null = null
  private options: ScanOptions | null = null
  private arpTable = new Map<string, string>()
  private localIps = new Set<string>()
  private localMacs = new Map<string, string>()
  private doneCount = 0
  private cancelled = false
  private paused = false
  private pauseGate: Promise<void> | null = null
  private resumeGate: (() => void) | null = null
  private abort = new AbortController()

  constructor() {
    super()
    this.setMaxListeners(50)
  }

  /** Current scanner snapshot for the UI. */
  getState(): ScanState {
    return { status: this.status, summary: this.summary, hosts: [...this.hosts] }
  }

  private emitEvent(ev: ScanEvent): void {
    this.emit('event', ev)
  }

  private log(level: 'info' | 'warn' | 'error', message: string): void {
    this.emitEvent({ type: 'log', level, message })
  }

  pause(): void {
    if (this.paused || this.status !== 'running') return
    this.paused = true
    this.pauseGate = new Promise((r) => {
      this.resumeGate = r
    })
    this.log('info', 'Scan paused')
  }

  resume(): void {
    if (!this.paused) return
    this.paused = false
    const r = this.resumeGate
    this.resumeGate = null
    this.pauseGate = null
    r?.()
    this.log('info', 'Scan resumed')
  }

  cancel(): void {
    if (this.status !== 'running' && this.status !== 'paused') return
    this.cancelled = true
    this.abort.abort()
    this.paused = false
    const r = this.resumeGate
    this.resumeGate = null
    this.pauseGate = null
    r?.()
  }

  private async checkGate(): Promise<void> {
    while (this.paused && !this.cancelled) {
      await this.pauseGate
    }
  }

  async start(options: ScanOptions): Promise<void> {
    if (this.status === 'running') return
    this.options = options
    this.hosts = []
    this.summary = null
    this.doneCount = 0
    this.cancelled = false
    this.paused = false
    this.abort = new AbortController()
    this.status = 'running'

    const ips = expandTarget(options.target)
    if (ips.length === 0) {
      this.status = 'finished'
      const now = new Date().toISOString()
      this.summary = { target: options.target, startedAt: now, finishedAt: now, durationMs: 0, total: 0, online: 0 }
      this.log('warn', `No valid addresses in "${options.target}"`)
      this.emitEvent({ type: 'done', summary: this.summary })
      return
    }

    this.log('info', `Scanning ${ips.length} hosts in ${options.target}…`)
    this.localIps = new Set<string>()
    this.localMacs = new Map<string, string>()
    for (const infos of Object.values(os.networkInterfaces())) {
      for (const info of infos ?? []) {
        if (info.family !== 'IPv4') continue
        this.localIps.add(info.address)
        if (info.mac && info.mac !== '00:00:00:00:00:00') {
          // Match the dash-separated style of `arp -a` on Windows.
          this.localMacs.set(
            info.address,
            process.platform === 'win32' ? info.mac.replace(/:/g, '-').toLowerCase() : info.mac
          )
        }
      }
    }
    this.arpTable = await readArpTable()
    if (this.arpTable.size > 0) this.log('info', `Loaded ${this.arpTable.size} ARP cache entries`)

    const startedAt = new Date().toISOString()
    const startedMs = Date.now()
    const progress: ScanProgress = { total: ips.length, done: 0, online: 0 }
    this.emitEvent({ type: 'progress', progress: { ...progress } })

    const signal = this.abort.signal
    await runWorkers(ips, options.concurrency, async (ip) => {
      await this.checkGate()
      if (this.cancelled) return
      const host = await this.probeHost(ip, signal)
      if (this.cancelled) return
      this.doneCount++
      if (host.status === 'online') {
        this.hosts.push(host)
        this.emitEvent({ type: 'host', host })
      }
      progress.done = this.doneCount
      progress.online = this.hosts.length
      this.emitEvent({ type: 'progress', progress: { ...progress } })
    })

    const finishedAt = new Date().toISOString()
    if (this.cancelled) {
      this.status = 'cancelled'
      this.log('info', `Scan cancelled after ${this.doneCount}/${ips.length} hosts`)
    } else {
      this.status = 'finished'
      this.summary = {
        target: options.target,
        startedAt,
        finishedAt,
        durationMs: Date.now() - startedMs,
        total: ips.length,
        online: this.hosts.length
      }
      this.log('info', `Scan complete: ${this.hosts.length} device(s) found in ${((Date.now() - startedMs) / 1000).toFixed(1)}s`)
      this.emitEvent({ type: 'done', summary: this.summary })
    }
  }

  /** Probes one address with the enabled discovery methods. */
  private async probeHost(ip: string, signal: AbortSignal): Promise<HostResult> {
    const opts = this.options
    if (!opts) return { ip, status: 'offline', hostname: null, mac: null, vendor: null, latencyMs: null, via: [], firstSeen: '', lastSeen: '' }

    const now = new Date().toISOString()
    const latencies: number[] = []
    const via: string[] = []

    const isLocal = this.localIps.has(ip)
    const nameTimeout = Math.max(1500, opts.timeoutMs)
    const dnsPromise = reverseDns(ip, nameTimeout, signal)
    const mdnsPromise =
      !isLocal && (process.platform === 'win32' || process.platform === 'darwin')
        ? mDnsReverse(ip, nameTimeout, signal)
        : Promise.resolve(null)

    // MAC: from the ARP snapshot, or from the local interfaces for our own IP.
    let mac = opts.methods.arp ? this.arpTable.get(ip) ?? null : null
    if (mac) {
      via.push('arp')
      latencies.push(0)
    } else if (this.localMacs.has(ip)) {
      mac = this.localMacs.get(ip) ?? null
    }

    let retries = Math.max(0, opts.retries)
    if (opts.methods.icmp) {
      while (retries >= 0) {
        const r = await pingProbe(ip, opts.timeoutMs, signal)
        if (r.up) {
          via.push('icmp')
          latencies.push(r.ms ?? 0)
          break
        }
        retries--
      }
    }

    if (opts.methods.tcp) {
      const r = await tcpProbe(ip, opts.tcpPorts, opts.timeoutMs, signal)
      if (r.up) {
        via.push('tcp')
        latencies.push(r.ms ?? 0)
      }
    }

    const online = via.length > 0
    const latencyMs = online ? Math.min(...latencies) : null

    // A probe to a fresh host populates the ARP cache, so query it again to
    // pick up MACs that were not in the snapshot taken before scanning.
    if (online && !mac) {
      const fresh = await arpLookup(ip)
      if (fresh) mac = fresh
    }

    // Name resolution: reverse DNS first; on a typical LAN there are no PTR
    // records, so prefer the platform's classic NetBIOS name (Windows) or
    // mDNS CLI helpers (Linux), and only then fall back to the node-level
    // mDNS lookup. Placeholder mDNS names are rejected so the UI's vendor
    // fallback still shows for devices that never got a real hostname.
    let hostname: string | null = online ? await dnsPromise : null
    if (online && !hostname) {
      if (isLocal) {
        hostname = os.hostname()
      } else {
        const lookups =
          process.platform === 'win32'
            ? [netbiosName]
            : process.platform === 'linux'
              ? [mDnsName, sambaNetbiosName]
              : []
        for (const lookup of lookups) {
          const name = await lookup(ip, nameTimeout, signal)
          if (isUsableHostname(name)) {
            hostname = name
            break
          }
        }
        if (!hostname) {
          const name = await mdnsPromise
          if (isUsableHostname(name)) hostname = name
        }
      }
    }

    return {
      ip,
      status: online ? 'online' : 'offline',
      hostname,
      mac,
      vendor: mac ? lookupVendor(normalizeMac(mac)) : null,
      latencyMs,
      via,
      firstSeen: now,
      lastSeen: now
    }
  }
}
