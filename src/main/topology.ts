/**
 * Persisted network-topology store (Phase 3), living in userData/topology.json
 * with the same lazy-load / atomic-write pattern as devices.json. Holds the
 * user's manual device→switch assignments ("bindings") plus the cached SNMP
 * MAC-address tables read from managed switches. Bindings are permanent until
 * explicitly reset — a scan's changing IPs never clear them.
 *
 * Binding keys use the canonical device key (normalized MAC, else IP). A key
 * maps to the switch IP the device hangs off; deleting the key (or setting a
 * null target) means "directly attached to the router".
 */

import { app } from 'electron'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { SwitchTable, TopologyData } from '../shared/types'
import { normalizeMac } from './vendors'
import { snmpReadSwitchMacs } from './snmp'

/** The device key used in bindings: normalized MAC, else the IP. */
export function topologyKey(mac: string | null, ip: string): string {
  return mac ? normalizeMac(mac) : ip
}

interface TopologyStoreData {
  bindings: Record<string, string>
  switchTables: Record<string, SwitchTable>
  refreshedAt: string | null
}

const DEFAULTS: TopologyStoreData = { bindings: {}, switchTables: {}, refreshedAt: null }

let cache: TopologyStoreData | null = null
let refreshInFlight = false

function topologyPath(): string {
  return join(app.getPath('userData'), 'topology.json')
}

function load(): TopologyStoreData {
  if (cache) return cache
  try {
    const parsed = JSON.parse(readFileSync(topologyPath(), 'utf8')) as Partial<TopologyStoreData>
    cache = {
      bindings: parsed.bindings && typeof parsed.bindings === 'object' ? parsed.bindings : {},
      switchTables: parsed.switchTables && typeof parsed.switchTables === 'object' ? parsed.switchTables : {},
      refreshedAt: typeof parsed.refreshedAt === 'string' ? parsed.refreshedAt : null
    }
  } catch {
    cache = { ...DEFAULTS }
  }
  return cache
}

function save(): void {
  const data = load()
  try {
    const dir = dirname(topologyPath())
    mkdirSync(dir, { recursive: true })
    const tmp = `${topologyPath()}.tmp`
    writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8')
    renameSync(tmp, topologyPath())
  } catch {
    // Best-effort persistence; never crash the app over a write failure.
  }
}

/** Everything the renderer map needs right now. */
export function getTopology(): TopologyData {
  const data = load()
  return { switchTables: data.switchTables, bindings: data.bindings }
}

/**
 * Sets (or, with a null target, removes) a manual device→switch binding.
 * Returns the updated topology snapshot.
 */
export function setTopologyBinding(key: string, switchIp: string | null): TopologyData {
  if (!key) return getTopology()
  const data = load()
  if (switchIp) data.bindings[key] = switchIp
  else delete data.bindings[key]
  save()
  return getTopology()
}

/** Removes every manual binding; SNMP-derived results are left untouched. */
export function clearTopologyBindings(): TopologyData {
  load().bindings = {}
  save()
  return getTopology()
}

/**
 * Replaces the bindings and cached SNMP tables wholesale (used when restoring
 * a settings backup). Cached tables are restored as-is; a later SNMP refresh
 * re-reads whichever switches are reachable.
 */
export function replaceTopology(data: Pick<TopologyData, 'bindings' | 'switchTables'>): TopologyData {
  const store = load()
  store.bindings = data.bindings
  store.switchTables = data.switchTables
  save()
  return getTopology()
}

/**
 * Reads MAC-address tables from the given switch IPs over SNMP and caches
 * them. Non-responding IPs are recorded with ok=false so the map can show a
 * switch as "no SNMP". Concurrent calls collapse into one in-flight refresh.
 */
export async function refreshSwitchTables(switchIps: string[], timeoutMs = 1200): Promise<TopologyData> {
  const ips = [...new Set(switchIps)].filter((ip) => /^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip))
  if (refreshInFlight || ips.length === 0) return getTopology()
  refreshInFlight = true
  try {
    const results = await Promise.all(
      ips.map(async (ip) => {
        const res = await snmpReadSwitchMacs(ip, { timeoutMs })
        const table: SwitchTable = {
          ip,
          macs: res.macs,
          at: new Date().toISOString(),
          ok: res.community !== null,
          community: res.community
        }
        return [ip, table] as const
      })
    )
    const data = load()
    for (const [ip, table] of results) data.switchTables[ip] = table
    data.refreshedAt = new Date().toISOString()
    save()
  } finally {
    refreshInFlight = false
  }
  return getTopology()
}
