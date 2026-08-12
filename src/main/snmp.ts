/**
 * Minimal SNMP v2c client (RFC 3416) for reading managed switches' MAC-address
 * tables. Raw UDP packet crafting with hand-rolled BER encoding — the same
 * spirit as the built-in DNS/mDNS helpers — so it needs no native modules and
 * no npm dependencies. Used by the switch-aware network map to learn which
 * devices hang off each switch.
 */

import dgram from 'node:dgram'

// BER tag bytes.
const TAG_SEQUENCE = 0x30
const TAG_INTEGER = 0x02
const TAG_OCTET = 0x04
const TAG_NULL = 0x05
const TAG_OID = 0x06
const PDU_GETNEXT = 0xa1

// dot1dTpFdbTable (BRIDGE-MIB) and dot1qTpFdbTable (Q-BRIDGE-MIB). We walk the
// "port" column; every row's instance ends in the learned MAC address, which
// is exactly the device-to-switch mapping the topology needs.
const DOT1D_ENTRY = [1, 3, 6, 1, 2, 1, 17, 4, 3, 1]
const DOT1Q_ENTRY = [1, 3, 6, 1, 2, 1, 17, 7, 1, 2, 2, 1]
const FDB_TABLES = [
  {
    entryPrefix: DOT1D_ENTRY,
    base: [...DOT1D_ENTRY, 2],
    extract: (oid: number[]): number[] | null => (oid.length === 14 ? oid.slice(-6) : null)
  },
  {
    entryPrefix: DOT1Q_ENTRY,
    base: [...DOT1Q_ENTRY, 2],
    // dot1q instances are MAC (6) + VLAN (2); take the MAC part.
    extract: (oid: number[]): number[] | null => (oid.length === 20 ? oid.slice(-8, -2) : null)
  }
]

const MAX_WALK_STEPS = 400
const DEFAULT_TIMEOUT_MS = 1500

export interface SnmpResult {
  /** Normalized MACs (uppercase, colon-separated) seen on the switch's ports. */
  macs: string[]
  /** Community string that answered, or null when the switch is unreachable. */
  community: string | null
}

// ---------------------------------------------------------------------------
// BER encoding
// ---------------------------------------------------------------------------

function berLength(len: number): Buffer {
  if (len < 0x80) return Buffer.from([len])
  const bytes: number[] = []
  let v = len
  while (v > 0) {
    bytes.unshift(v & 0xff)
    v = v >>> 8
  }
  return Buffer.from([0x80 | bytes.length, ...bytes])
}

/** Two's-complement minimal-length SNMP INTEGER. */
function berInteger(value: number): Buffer {
  let v = value
  const bytes: number[] = []
  do {
    bytes.unshift(v & 0xff)
    v = v >> 8
  } while (v !== 0 && v !== -1)
  if (bytes.length > 1 && bytes[0] & 0x80) bytes.unshift(0)
  return Buffer.concat([Buffer.from([TAG_INTEGER]), berLength(bytes.length), Buffer.from(bytes)])
}

function berOctet(data: string): Buffer {
  const body = Buffer.from(data, 'latin1')
  return Buffer.concat([Buffer.from([TAG_OCTET]), berLength(body.length), body])
}

/** Encodes an OID (array of sub-ids) as a BER object. */
export function berOid(oid: number[]): Buffer {
  const parts: number[] = [oid[0] * 40 + oid[1]]
  for (let i = 2; i < oid.length; i++) {
    let sub = oid[i]
    const stack: number[] = [sub & 0x7f]
    sub = sub >>> 7
    while (sub > 0) {
      stack.push((sub & 0x7f) | 0x80)
      sub = sub >>> 7
    }
    for (let j = stack.length - 1; j >= 0; j--) parts.push(stack[j])
  }
  const body = Buffer.from(parts)
  return Buffer.concat([Buffer.from([TAG_OID]), berLength(body.length), body])
}

// ---------------------------------------------------------------------------
// BER decoding
// ---------------------------------------------------------------------------

function readLength(buf: Buffer, pos: number): { len: number; next: number } {
  const first = buf[pos]
  if ((first & 0x80) === 0) return { len: first, next: pos + 1 }
  const n = first & 0x7f
  let len = 0
  for (let i = 0; i < n; i++) len = len * 256 + buf[pos + 1 + i]
  return { len, next: pos + 1 + n }
}

function readTlv(buf: Buffer, pos: number): { tag: number; value: Buffer; next: number } {
  const tag = buf[pos]
  const { len, next } = readLength(buf, pos + 1)
  return { tag, value: buf.subarray(next, next + len), next: next + len }
}

/** Decodes a BER OID value into an array of sub-ids. */
export function decodeOidValue(value: Buffer): number[] {
  const oid: number[] = []
  let sub = 0
  let i = 0
  while (i < value.length) {
    const b = value[i]
    sub = (sub << 7) | (b & 0x7f)
    if ((b & 0x80) === 0) {
      if (oid.length === 0) {
        if (sub < 40) oid.push(0, sub)
        else if (sub < 80) oid.push(1, sub - 40)
        else oid.push(2, sub - 80)
      } else {
        oid.push(sub)
      }
      sub = 0
    }
    i++
  }
  return oid
}

interface Varbind {
  oid: number[]
  valueTag: number
}

interface ParsedResponse {
  requestId: number
  errorStatus: number
  varbinds: Varbind[]
}

/** Decodes an SNMP INTEGER value into a JS number (values < 2^31). */
function readIntValue(value: Buffer): number {
  let result = 0
  for (let i = 0; i < value.length; i++) result = result * 256 + value[i]
  return result
}

/** Parses an SNMP message into its varbind list. Throws on malformed input. */
export function parseResponse(buf: Buffer): ParsedResponse {
  const msg = readTlv(buf, 0)
  if (msg.tag !== TAG_SEQUENCE) throw new Error('not an SNMP message')
  let pos = 0
  const version = readTlv(msg.value, pos)
  if (version.tag !== TAG_INTEGER) throw new Error('missing SNMP version')
  pos = version.next
  const community = readTlv(msg.value, pos)
  if (community.tag !== TAG_OCTET) throw new Error('missing SNMP community')
  pos = community.next
  const pdu = readTlv(msg.value, pos)
  if ((pdu.tag & 0xf0) !== 0xa0) throw new Error('not an SNMP PDU')
  let p = 0
  const reqIdTlv = readTlv(pdu.value, p)
  p = reqIdTlv.next
  const errStatusTlv = readTlv(pdu.value, p)
  p = errStatusTlv.next
  const errIndexTlv = readTlv(pdu.value, p)
  p = errIndexTlv.next
  const vlist = readTlv(pdu.value, p)
  const varbinds: Varbind[] = []
  let vp = 0
  while (vp < vlist.value.length) {
    const vb = readTlv(vlist.value, vp)
    vp = vb.next
    if (vb.tag !== TAG_SEQUENCE) continue
    const oidTlv = readTlv(vb.value, 0)
    if (oidTlv.tag !== TAG_OID) continue
    varbinds.push({ oid: decodeOidValue(oidTlv.value), valueTag: readTlv(vb.value, oidTlv.next).tag })
  }
  return {
    requestId: readIntValue(reqIdTlv.value),
    errorStatus: readIntValue(errStatusTlv.value),
    varbinds
  }
}

// ---------------------------------------------------------------------------
// Packet building / transport
// ---------------------------------------------------------------------------

/** Builds an SNMPv2c GETNEXT request for `oid`. */
export function buildGetNextRequest(community: string, requestId: number, oid: number[]): Buffer {
  const varbind = Buffer.concat([Buffer.from([TAG_SEQUENCE]), berLength(berOid(oid).length + 2), berOid(oid), Buffer.from([TAG_NULL, 0x00])])
  const varbindList = Buffer.concat([Buffer.from([TAG_SEQUENCE]), berLength(varbind.length), varbind])
  const pduBody = Buffer.concat([berInteger(requestId), berInteger(0), berInteger(0), varbindList])
  const pdu = Buffer.concat([Buffer.from([PDU_GETNEXT]), berLength(pduBody.length), pduBody])
  const messageBody = Buffer.concat([berInteger(1), berOctet(community), pdu])
  return Buffer.concat([Buffer.from([TAG_SEQUENCE]), berLength(messageBody.length), messageBody])
}

function sendOnce(socket: dgram.Socket, packet: Buffer, ip: string, timeoutMs: number): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const cleanup = (): void => {
      clearTimeout(timer)
      socket.off('message', onMsg)
      socket.off('error', onErr)
    }
    const onMsg = (msg: Buffer): void => {
      cleanup()
      resolve(msg)
    }
    const onErr = (): void => {
      cleanup()
      resolve(null)
    }
    const timer = setTimeout(onErr, timeoutMs)
    socket.once('message', onMsg)
    socket.once('error', onErr)
    socket.send(packet, 161, ip, (err) => {
      if (err) onErr()
    })
  })
}

async function bindSocket(): Promise<dgram.Socket> {
  const socket = dgram.createSocket('udp4')
  await new Promise<void>((resolve, reject) => {
    const onErr = (err: Error): void => {
      socket.off('listening', onReady)
      reject(err)
    }
    const onReady = (): void => {
      socket.off('error', onErr)
      resolve()
    }
    socket.once('error', onErr)
    socket.once('listening', onReady)
    socket.bind(0)
  })
  return socket
}

function startsWith(oid: number[], prefix: number[]): boolean {
  return oid.length >= prefix.length && prefix.every((v, i) => oid[i] === v)
}

function sameOid(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

function macFromSubids(subids: number[]): string | null {
  const mac = subids.map((n) => n.toString(16).padStart(2, '0')).join(':').toUpperCase()
  return /^[0-9A-F:]{17}$/.test(mac) ? mac : null
}

/** GETNEXT-walks one FDB column; `responded` is false when nothing answered. */
async function walkColumn(
  socket: dgram.Socket,
  ip: string,
  community: string,
  timeoutMs: number,
  table: { entryPrefix: number[]; base: number[]; extract: (oid: number[]) => number[] | null }
): Promise<{ responded: boolean; macs: string[] }> {
  const macs = new Set<string>()
  let responded = false
  let oid = table.base
  let prev: number[] | null = null
  let requestId = (Math.random() * 0x7fffffff) | 0
  for (let step = 0; step < MAX_WALK_STEPS; step++) {
    requestId = (requestId % 0x7fffffff) + 1
    const res = await sendOnce(socket, buildGetNextRequest(community, requestId, oid), ip, timeoutMs)
    if (!res) break
    let parsed: ParsedResponse
    try {
      parsed = parseResponse(res)
    } catch {
      break
    }
    responded = true
    if (parsed.requestId !== requestId) continue
    if (parsed.errorStatus !== 0) break
    if (parsed.varbinds.length === 0) break
    const vb = parsed.varbinds[0]
    if (!startsWith(vb.oid, table.entryPrefix)) break
    const subids = table.extract(vb.oid)
    if (!subids) break
    const mac = macFromSubids(subids)
    if (!mac) break
    if (prev && sameOid(vb.oid, prev)) break
    macs.add(mac)
    prev = vb.oid
    oid = vb.oid
  }
  return { responded, macs: [...macs] }
}

/**
 * Reads a switch's learned MAC addresses via SNMPv2c GETNEXT walks of its
 * forwarding database. Tries the "public" then "private" read communities and
 * both the BRIDGE-MIB and Q-BRIDGE-MIB tables. Returns an empty list (and
 * null community) when the switch is unreachable, SNMP is disabled, or no
 * device has been learned yet.
 */
export async function snmpReadSwitchMacs(ip: string, options?: { timeoutMs?: number }): Promise<SnmpResult> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const socket = await bindSocket()
  try {
    for (const community of ['public', 'private']) {
      const macs = new Set<string>()
      let responded = false
      for (const table of FDB_TABLES) {
        const result = await walkColumn(socket, ip, community, timeoutMs, table)
        if (result.responded) responded = true
        for (const mac of result.macs) macs.add(mac)
      }
      if (responded) return { macs: [...macs], community }
    }
  } finally {
    try {
      socket.close()
    } catch {
      // ignore close errors
    }
  }
  return { macs: [], community: null }
}
