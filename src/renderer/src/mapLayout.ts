/**
 * Pure topology layout math for the Network Map: builds a recursive tree of
 * which host hangs off which (manual binding first, then SNMP MAC-table
 * match, then the router) and lays it out radially. Offline devices that were
 * previously detected are included as ordinary leaves so they keep appearing
 * on the map (dimmed in the renderer) instead of vanishing. Any node can have
 * children AND a parent, so cascaded switches (switch under switch) and
 * virtual switches (a hypervisor with VMs behind it) both render correctly.
 * Kept free of React so it can be unit-tested in isolation.
 */
import type { HostResult, TopologyData } from '../../shared/types'
import { deviceKey, normalizeMac } from './lib'

const RSTEP = 115
/**
 * Minimum arc (in SVG units) between adjacent devices on any ring. The layout
 * gives every leaf the same angular share of the circle, so the first ring's
 * radius is sized so each share is at least this wide — otherwise the labels
 * of devices hanging directly off the router overlap. Deeper rings sit at a
 * larger radius, so a single radius sizing covers the whole tree.
 */
const MIN_ROOT_ARC = 115

/** Sentinel for the center (router) node in edge lists. */
export const ROOT = 'root'

export interface PlacedNode {
  host: HostResult
  x: number
  y: number
  depth: number
  /** True when the node is drawn as a hub (has children or is a switch). */
  hub: boolean
  childCount: number
  snmpOk: boolean
  snmpCount: number
}

export interface MapEdge {
  /** Parent IP, or ROOT for the center. */
  from: string
  to: string
}

export interface MapLayout {
  center: HostResult | null
  nodes: PlacedNode[]
  edges: MapEdge[]
  maxR: number
}

/**
 * Computes the topology as a tree. Parent resolution order: manual binding,
 * then SNMP MAC-table match, then the router. Parent loops (self-assignment or
 * A↔B) are detected and broken by re-attaching the offending node to the
 * router so the map can never hang on a cycle.
 */
export function computeLayout(hosts: HostResult[], topology: TopologyData): MapLayout {
  // The center must be reachable — only an online gateway/router can own it.
  // Everything else (online + previously-detected offline devices) is placed
  // on the rings around it.
  const online = hosts.filter((h) => h.status === 'online')
  // The real router (default gateway) owns the center; fall back to a
  // router-typed host. With neither, NO device is forced into the center — the
  // map shows a generic "Network" hub instead. Otherwise a mis-detected host
  // (e.g. a hypervisor auto-typed as "router") could swallow the center and
  // become impossible to attach devices to.
  const center = online.find((h) => h.isGateway) ?? online.find((h) => h.deviceType === 'router') ?? null
  const others = center ? hosts.filter((h) => h.ip !== center.ip) : hosts
  if (others.length === 0) return { center, nodes: [], edges: [], maxR: 240 }

  const byIp = new Map(others.map((h) => [h.ip, h]))

  const parentOf = (h: HostResult): string | null => {
    const bound = topology.bindings[deviceKey(h.mac, h.ip)]
    if (bound && byIp.has(bound)) return bound
    if (h.mac) {
      const norm = normalizeMac(h.mac)
      for (const [sip, table] of Object.entries(topology.switchTables)) {
        if (table.ok && byIp.has(sip) && table.macs.some((m) => normalizeMac(m) === norm)) return sip
      }
    }
    return null
  }

  const up = new Map<string, string | null>()
  for (const h of others) up.set(h.ip, parentOf(h))

  const find = (ip: string): boolean => {
    const seen = new Set<string>()
    let cur: string | null = ip
    let depth = 0
    while (cur) {
      if (seen.has(cur)) return true
      seen.add(cur)
      const next = up.get(cur)
      if (!next) break
      cur = next
      depth++
      if (depth > others.length + 1) return true
    }
    return false
  }
  // Break cycles: re-attach any node whose parent chain loops back on itself.
  let changed = true
  while (changed) {
    changed = false
    for (const h of others) {
      if (find(h.ip)) {
        up.set(h.ip, null)
        changed = true
      }
    }
  }

  const children = new Map<string, HostResult[]>()
  const rootChildren: HostResult[] = []
  for (const h of others) {
    const p = up.get(h.ip) ?? null
    // A parent that resolves to the center is a no-op (the center is the
    // root). With no center (null) every parent is an ordinary hub under the
    // generic "Network" root, so none is demoted.
    if (p && (!center || p !== center.ip)) {
      const list = children.get(p)
      if (list) list.push(h)
      else children.set(p, [h])
    } else {
      rootChildren.push(h)
    }
  }
  const childList = (ip: string): HostResult[] => children.get(ip) ?? []

  const leafCount = new Map<string, number>()
  const countLeaves = (ip: string): number => {
    const cached = leafCount.get(ip)
    if (cached !== undefined) return cached
    const kids = childList(ip)
    const total = kids.reduce((n, k) => n + countLeaves(k.ip), 0)
    const value = total === 0 ? 1 : total
    leafCount.set(ip, value)
    return value
  }

  const nodes: PlacedNode[] = []
  const edges: MapEdge[] = []
  let maxDepth = 0

  // Ring radii: every leaf claims an equal slice of the circle, so the first
  // ring needs one MIN_ROOT_ARC of arc per leaf. Deeper rings sit further out
  // (R0 + depth·RSTEP) and are automatically roomier.
  const rootLeaves = rootChildren.reduce((n, h) => n + countLeaves(h.ip), 0)
  const R0 = Math.max(170, Math.ceil((rootLeaves * MIN_ROOT_ARC) / (2 * Math.PI)))

  const placeChildren = (ip: string | null, start: number, span: number, depth: number): void => {
    const kids = ip === null ? rootChildren : childList(ip)
    if (kids.length === 0) return
    const totalLeaves = kids.reduce((n, h) => n + countLeaves(h.ip), 0)
    let cursor = start
    for (const kid of kids) {
      const subSpan = (span * countLeaves(kid.ip)) / totalLeaves
      const a = cursor + subSpan / 2
      const r = R0 + depth * RSTEP
      const table = topology.switchTables[kid.ip]
      nodes.push({
        host: kid,
        x: Math.cos(a) * r,
        y: Math.sin(a) * r,
        depth,
        hub: kid.deviceType === 'switch' || childList(kid.ip).length > 0,
        childCount: childList(kid.ip).length,
        snmpOk: table?.ok ?? false,
        snmpCount: table?.macs.length ?? 0
      })
      edges.push({ from: ip === null ? ROOT : ip, to: kid.ip })
      if (depth + 1 > maxDepth) maxDepth = depth + 1
      placeChildren(kid.ip, cursor, subSpan, depth + 1)
      cursor += subSpan
    }
  }

  placeChildren(null, -Math.PI / 2, Math.PI * 2, 0)

  return {
    center,
    nodes,
    edges,
    // Fit the map tightly: the deepest ring holds only leaves, whose name/IP
    // labels reach radius + 34; hub name/IP/SNMP labels reach +57 but hubs are
    // never on the deepest ring. 73 = 34 + a 39px margin, so nothing clips. A
    // tighter box keeps the map large on screen even with bigger ring radii.
    maxR: Math.max(R0 + (maxDepth - 1) * RSTEP + 73, 240)
  }
}
