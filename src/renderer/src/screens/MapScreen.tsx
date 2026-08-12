/**
 * Network Map screen (Phase 3): an interactive SVG topology view. The gateway
 * (router) sits at the center. Managed switches orbit it on an outer ring and
 * the devices that hang off each switch cluster around it; everything else
 * connects directly to the router. Connections come from SNMP MAC-table reads
 * where available, otherwise from the user's manual device→switch bindings,
 * which are persisted until explicitly reset. Supports zoom (wheel), pan
 * (drag), node selection for details (including manual connection editing), a
 * device-type legend and a "scan this device" shortcut.
 */
import { useMemo, useRef, useState } from 'react'
import { Archive, Download, Eraser, FileCode2, FileImage, Maximize, Minus, Network, Plus, RefreshCw, ScanLine, Upload, X } from 'lucide-react'
import type { DeviceProfile, DeviceProfiles, HostResult, TopologyData } from '../../../shared/types'
import { Badge, Button, Panel, Select } from '../components/ui'
import { DeviceTypeIcon } from '../components/DeviceTypeIcon'
import { cn, deviceKey, DEVICE_TYPE_COLORS, DEVICE_TYPE_META, portServiceName } from '../lib'
import { buildMapSvg, downloadBlob, EXPORT_SIZES, hasMapContent, svgToPng, type ExportSize } from '../exportMap'
import { computeLayout, ROOT } from '../mapLayout'

const NODE_RADIUS = 17
const CENTER_RADIUS = 24

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

export function MapScreen({
  hosts,
  devices,
  topology,
  onSetBinding,
  onClearBindings,
  onRefreshTopology,
  onUpdateDevice,
  onBackupSettings,
  onRestoreSettings,
  onGoScan
}: {
  hosts: HostResult[]
  devices: DeviceProfiles
  topology: TopologyData
  onSetBinding: (key: string, switchIp: string | null) => void
  onClearBindings: () => void
  onRefreshTopology: (switchIps: string[]) => void
  onUpdateDevice: (key: string, patch: Partial<DeviceProfile>) => void
  onBackupSettings: () => void
  onRestoreSettings: () => void
  onGoScan: (target: string) => void
}): React.JSX.Element {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [selectedIp, setSelectedIp] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number; moved: boolean } | null>(null)

  const layout = useMemo(() => computeLayout(hosts, topology), [hosts, topology])

  const nodeByIp = useMemo(() => new Map(layout.nodes.map((n) => [n.host.ip, n])), [layout])

  const profiles = useMemo(() => new Map(Object.entries(devices)), [devices])

  const displayName = (h: HostResult): string => {
    const key = deviceKey(h.mac, h.ip).toLowerCase()
    return profiles.get(key)?.customName?.trim() || h.hostname || h.vendor || h.ip
  }

  const selected = selectedIp ? hosts.find((h) => h.ip === selectedIp) : null

  const onWheel = (e: React.WheelEvent<SVGSVGElement>): void => {
    const factor = e.deltaY < 0 ? 1.12 : 0.89
    setZoom((z) => Math.min(3, Math.max(0.3, z * factor)))
  }

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>): void => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y, moved: false }
    ;(e.target as SVGElement).setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>): void => {
    const drag = dragRef.current
    if (!drag) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true
    if (drag.moved) setPan({ x: drag.panX + dx, y: drag.panY + dy })
  }

  const onPointerUp = (): void => {
    dragRef.current = null
  }

  const resetView = (): void => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const presentTypes = useMemo(() => [...new Set(hosts.map((h) => h.deviceType))], [hosts])

  const onlineCount = hosts.filter((h) => h.status === 'online').length
  const offlineCount = hosts.length - onlineCount

  // Hosts to probe with SNMP when the user clicks "re-check": everything
  // detected as a switch, plus any host that is the target of a binding.
  const snmpCandidates = useMemo(() => {
    const ips = new Set<string>()
    for (const h of hosts) if (h.deviceType === 'switch') ips.add(h.ip)
    for (const target of Object.values(topology.bindings)) if (target) ips.add(target)
    return [...ips]
  }, [hosts, topology.bindings])

  const anySnmpOk = layout.nodes.some((n) => n.snmpOk)
  const anySwitch = layout.nodes.some((n) => n.host.deviceType === 'switch')

  const resetConnections = (): void => {
    if (window.confirm('Reset all manual device→switch connections? SNMP-detected connections stay. This cannot be undone.')) {
      onClearBindings()
    }
  }

  const exportMap = async (kind: 'png' | 'svg', size: ExportSize | null): Promise<void> => {
    setExportOpen(false)
    if (!hasMapContent(layout)) {
      window.alert('There is nothing to export yet — the map is empty.')
      return
    }
    const names = new Map<string, string>()
    for (const n of layout.nodes) names.set(n.host.ip, displayName(n.host))
    if (layout.center) names.set(layout.center.ip, displayName(layout.center))
    const nameOf = (ip: string): string => names.get(ip) ?? ip
    const stamp = new Date().toISOString().slice(0, 10)
    setExporting(true)
    try {
      if (kind === 'svg') {
        const svg = buildMapSvg(layout, nameOf, 2048)
        downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `network-map-${stamp}.svg`)
      } else if (size) {
        const svg = buildMapSvg(layout, nameOf, size)
        const png = await svgToPng(svg, size)
        downloadBlob(png, `network-map-${size}x${size}-${stamp}.png`)
      }
    } catch (err) {
      window.alert(`Could not export the map: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setExporting(false)
    }
  }

  if (hosts.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Network className="h-5 w-5 text-glassy-accent" />
          <h2 className="text-lg font-bold text-glassy-text">Network Map</h2>
        </div>
        <Panel className="flex flex-col items-center gap-3 py-12 text-center">
          <Network className="h-10 w-10 text-glassy-muted/60" />
          <p className="text-sm text-glassy-muted">Nothing to map yet. Run a scan and the topology will appear here.</p>
          <Button variant="primary" size="sm" onClick={() => onGoScan('')}>
            <ScanLine className="h-3.5 w-3.5" /> Start a scan
          </Button>
        </Panel>
      </div>
    )
  }

  const { center } = layout
  const label = center ? truncate(displayName(center), 16) : 'Network'

  const isHub = (ip: string): boolean => layout.nodes.some((n) => n.hub && n.host.ip === ip)

  // Options for the "connected to" control: the router (direct) plus every
  // other online host (any host can become a hub once a device is attached to
  // it — handy when type detection never flagged a switch). A bound-but-offline
  // switch is appended so a saved connection never silently reverts to "direct".
  const connectionOptions = selected
    ? (() => {
        const opts: Array<{ value: string; label: string }> = [{ value: '', label: 'Router (direct)' }]
        for (const h of hosts) {
          if (h.ip === selected.ip || h.ip === layout.center?.ip) continue
          opts.push({ value: h.ip, label: `${truncate(displayName(h), 20)} (${h.ip})` })
        }
        const bound = topology.bindings[deviceKey(selected.mac, selected.ip)]
        if (bound && bound !== '' && !opts.some((o) => o.value === bound)) {
          opts.push({ value: bound, label: `${bound} (offline)` })
        }
        return opts
      })()
    : []
  const selectedBinding = selected ? (topology.bindings[deviceKey(selected.mac, selected.ip)] ?? '') : ''

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network className="h-5 w-5 text-glassy-accent" />
          <h2 className="text-lg font-bold text-glassy-text">Network Map</h2>
          <Badge tone="good">{onlineCount} online</Badge>
          {offlineCount > 0 ? <Badge tone="default">{offlineCount} offline</Badge> : null}
        </div>
        <div className="flex items-center gap-2">
          {anySwitch ? (
            <>
              <Button variant="outline" size="sm" onClick={() => onRefreshTopology(snmpCandidates)} title="Re-read switch MAC tables over SNMP" disabled={snmpCandidates.length === 0}>
                <RefreshCw className="h-3.5 w-3.5" /> Re-check SNMP
              </Button>
              <Button variant="danger" size="sm" onClick={resetConnections} title="Clear all manual device→switch assignments">
                <Eraser className="h-3.5 w-3.5" /> Reset connections
              </Button>
            </>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => onBackupSettings()} title="Save device names, types and connection settings to a file">
            <Archive className="h-3.5 w-3.5" /> Backup
          </Button>
          <Button variant="outline" size="sm" onClick={() => onRestoreSettings()} title="Restore device settings from a backup file">
            <Upload className="h-3.5 w-3.5" /> Restore
          </Button>
          <div className="relative">
            <Button variant="outline" size="sm" onClick={() => setExportOpen((v) => !v)} title="Export the map as an image" disabled={exporting}>
              {exporting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {exporting ? 'Exporting…' : 'Export'}
            </Button>
            {exportOpen ? (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setExportOpen(false)} />
                <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-glassy-border bg-glassy-panel p-1 shadow-2xl backdrop-blur-sm">
                  {EXPORT_SIZES.map((size) => (
                    <button
                      key={size}
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-glassy-text transition-colors hover:bg-glassy-panel2"
                      onClick={() => void exportMap('png', size)}
                      disabled={exporting}
                    >
                      <FileImage className="h-3.5 w-3.5 shrink-0 text-glassy-muted" />
                      <span>
                        PNG · {size}×{size}
                      </span>
                      <span className="ml-auto text-[10px] text-glassy-muted">{(size / 1024).toFixed(0)} MB</span>
                    </button>
                  ))}
                  <div className="my-1 h-px bg-glassy-border" />
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-glassy-text transition-colors hover:bg-glassy-panel2"
                    onClick={() => void exportMap('svg', null)}
                    disabled={exporting}
                  >
                    <FileCode2 className="h-3.5 w-3.5 shrink-0 text-glassy-muted" />
                    <span>SVG · vector</span>
                    <span className="ml-auto text-[10px] text-glassy-muted">any size</span>
                  </button>
                </div>
              </>
            ) : null}
          </div>
          <Button variant="outline" size="sm" onClick={() => setZoom((z) => Math.max(0.3, z / 1.25))} title="Zoom out">
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setZoom((z) => Math.min(3, z * 1.25))} title="Zoom in">
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={resetView} title="Reset view">
            <Maximize className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {!layout.center ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-glassy-border bg-glassy-panel/50 px-3 py-2 text-xs text-glassy-muted">
          No default gateway or router detected, so the map centers on a generic <span className="font-medium text-glassy-warn">Network</span> node — every device connects to it. Set your router's type to <span className="font-medium text-glassy-text">Router</span> (or set any device as the hub it hangs off) to reshape the map.
        </div>
      ) : null}

      {anySwitch ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-glassy-border bg-glassy-panel/50 px-3 py-2 text-xs text-glassy-muted">
          <span className={cn('font-medium', anySnmpOk ? 'text-glassy-good' : 'text-glassy-warn')}>
            {anySnmpOk ? 'SNMP links are auto-detected.' : 'Switches did not answer SNMP.'}
          </span>
          <span>Select any device and choose which switch it hangs off — connections are saved until you reset them.</span>
        </div>
      ) : null}

      <Panel className="relative p-0">
        <div className="relative flex h-[32rem] items-center justify-center overflow-hidden">
          <svg
            viewBox={`${-layout.maxR} ${-layout.maxR} ${layout.maxR * 2} ${layout.maxR * 2}`}
            className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
            onWheel={onWheel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            <defs>
              <radialGradient id="map-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={DEVICE_TYPE_COLORS.router} stopOpacity="0.25" />
                <stop offset="100%" stopColor={DEVICE_TYPE_COLORS.router} stopOpacity="0" />
              </radialGradient>
            </defs>
            <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
              {center ? <circle r={layout.maxR * 0.55} fill="url(#map-glow)" pointerEvents="none" /> : null}

              {layout.edges.map((edge) => {
                const from = edge.from === ROOT ? null : nodeByIp.get(edge.from)
                const to = nodeByIp.get(edge.to)
                if (!to) return null
                const isHubEdge = from?.hub === true || to.hub
                return (
                  <line
                    key={`edge-${edge.from}-${edge.to}`}
                    x1={from?.x ?? 0}
                    y1={from?.y ?? 0}
                    x2={to.x}
                    y2={to.y}
                    stroke={isHubEdge ? 'rgba(20,184,166,0.35)' : 'rgba(148,163,184,0.3)'}
                    strokeWidth={1.5}
                    pointerEvents="none"
                  />
                )
              })}

              {layout.nodes.map((n) => {
                const { host } = n
                const color = DEVICE_TYPE_COLORS[host.deviceType]
                const isSelected = host.ip === selectedIp
                const isOffline = host.status === 'offline'
                const radius = n.hub ? NODE_RADIUS + 3 : NODE_RADIUS
                return (
                  <g key={host.ip} transform={`translate(${n.x} ${n.y})`}>
                    <circle
                      r={radius + 7}
                      fill="transparent"
                      onClick={() => setSelectedIp(host.ip)}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="cursor-pointer"
                    >
                      <title>{displayName(host)} · {host.ip}</title>
                    </circle>
                    <circle
                      r={radius}
                      fill={isOffline ? 'rgba(148,163,184,0.06)' : `${color}${n.hub ? '2e' : '33'}`}
                      stroke={isOffline ? 'rgba(148,163,184,0.55)' : color}
                      strokeWidth={n.hub ? 2 : isSelected ? 3 : 1.5}
                      strokeDasharray={isOffline ? '3 3' : undefined}
                      className={cn(!n.hub && !isSelected && !isOffline && 'animate-map-node')}
                      style={{ filter: n.snmpOk ? 'drop-shadow(0 0 6px rgba(20,184,166,0.45))' : undefined }}
                      pointerEvents="none"
                    />
                    <text y={radius + (n.hub ? 24 : 17)} textAnchor="middle" fontSize={n.hub ? 14 : 13} fontWeight={n.hub ? 600 : undefined} fill="var(--glassy-text)" pointerEvents="none" style={{ opacity: n.hub ? 1 : isOffline ? 0.55 : 0.9 }}>
                      {truncate(displayName(host), n.hub ? 14 : 16)}
                    </text>
                    <text y={radius + (n.hub ? 40 : 32)} textAnchor="middle" fontSize={11} fontFamily="var(--font-mono), monospace" fill="var(--glassy-muted)" pointerEvents="none" style={{ opacity: isOffline ? 0.55 : 0.85 }}>
                      {host.ip}
                    </text>
                    {isOffline ? (
                      <text y={radius + (n.hub ? 55 : 44)} textAnchor="middle" fontSize={8} fill="var(--glassy-warn)" pointerEvents="none">
                        offline
                      </text>
                    ) : n.hub ? (
                      <text y={radius + 55} textAnchor="middle" fontSize={10} fill={n.snmpOk ? 'var(--glassy-good)' : 'var(--glassy-warn)'} pointerEvents="none">
                        {n.snmpOk ? `SNMP · ${n.snmpCount} macs` : 'manual only'}
                      </text>
                    ) : null}
                  </g>
                )
              })}

              {center ? (
                <g>
                  <circle r={CENTER_RADIUS + 8} fill="transparent" onClick={() => setSelectedIp(center.ip)} className="cursor-pointer">
                    <title>{label} · {center.ip}</title>
                  </circle>
                  <circle r={CENTER_RADIUS} fill={`${DEVICE_TYPE_COLORS.router}2e`} stroke={DEVICE_TYPE_COLORS.router} strokeWidth={2} style={{ filter: 'drop-shadow(0 0 8px rgba(245,158,11,0.5))' }} pointerEvents="none" />
                  <text y={CENTER_RADIUS + 20} textAnchor="middle" fontSize={14} fontWeight={600} fill="var(--glassy-text)" pointerEvents="none">
                    {label}
                  </text>
                  <text y={CENTER_RADIUS + 34} textAnchor="middle" fontSize={11} fontFamily="var(--font-mono), monospace" fill="var(--glassy-muted)" pointerEvents="none" style={{ opacity: 0.85 }}>
                    {center.ip}
                  </text>
                </g>
              ) : null}
            </g>
          </svg>

          {selected ? (
            <div className="absolute bottom-3 right-3 w-72 rounded-xl border border-glassy-border bg-glassy-panel/95 p-4 shadow-2xl backdrop-blur-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <DeviceTypeIcon type={selected.deviceType} withLabel className="text-glassy-accent/80" />
                  <Badge tone={selected.status === 'online' ? 'good' : 'default'}>{selected.status}</Badge>
                </div>
                <button type="button" onClick={() => setSelectedIp(null)} className="rounded-lg p-1 text-glassy-muted transition-colors hover:bg-glassy-panel2 hover:text-glassy-text" title="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <h3 className="mt-1 truncate text-base font-bold text-glassy-text">{displayName(selected)}</h3>
              <p className="font-mono text-xs text-glassy-muted">{selected.ip}</p>
              <div className="mt-2 grid gap-1 text-[11px]">
                <div className="flex justify-between gap-2"><span className="text-glassy-muted">Type</span><span>{DEVICE_TYPE_META[selected.deviceType].label}</span></div>
                <div className="flex justify-between gap-2"><span className="text-glassy-muted">Vendor</span><span className="truncate">{selected.vendor ?? '—'}</span></div>
                {selected.mac ? <div className="flex justify-between gap-2"><span className="text-glassy-muted">MAC</span><span className="truncate font-mono">{selected.mac}</span></div> : null}
                {selected.latencyMs !== null ? <div className="flex justify-between gap-2"><span className="text-glassy-muted">Latency</span><span>{selected.latencyMs} ms</span></div> : null}
                {selected.openPorts.length > 0 ? (
                  <div className="flex justify-between gap-2">
                    <span className="shrink-0 text-glassy-muted">Open ports</span>
                    <span className="truncate">{selected.openPorts.slice(0, 5).map((p) => `${p}/${portServiceName(p)}`).join(', ')}</span>
                  </div>
                ) : null}
              </div>

              <div className="mt-3">
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-glassy-muted" htmlFor="map-device-type">
                  Device type
                </label>
                <Select
                  id="map-device-type"
                  value={selected.deviceType}
                  onChange={(e) =>
                    onUpdateDevice(deviceKey(selected.mac, selected.ip).toLowerCase(), {
                      deviceType: (e.target.value || null) as DeviceProfile['deviceType']
                    })
                  }
                >
                  <option value="">Auto-detect</option>
                  {Object.entries(DEVICE_TYPE_META).map(([id, meta]) => (
                    <option key={id} value={id}>
                      {meta.label}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-[10px] text-glassy-muted">Fix a switch detected as a router here — it becomes a hub you can attach devices to.</p>
              </div>

              {selected.ip !== layout.center?.ip ? (
                <div className="mt-3">
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-glassy-muted" htmlFor="map-connection">
                    Connected to
                  </label>
                  <Select
                    id="map-connection"
                    value={selectedBinding}
                    onChange={(e) => onSetBinding(deviceKey(selected.mac, selected.ip), e.target.value || null)}
                  >
                    {connectionOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                  <p className="mt-1 text-[10px] text-glassy-muted">Saved permanently until you reset connections.</p>
                </div>
              ) : null}

              {isHub(selected.ip) ? (
                <p className="mt-3 text-[11px] text-glassy-muted">
                  {selected.deviceType === 'switch' ? 'Hub switch — attached devices cluster around it here.' : 'Hub device — devices you attach here hang off it.'}
                </p>
              ) : null}

              <Button variant="primary" size="sm" className="mt-3 w-full" onClick={() => onGoScan(selected.ip)}>
                <ScanLine className="h-3.5 w-3.5" /> Scan this device
              </Button>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-glassy-border px-4 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-glassy-muted">Legend</span>
          {presentTypes.map((type) => (
            <span key={type} className="flex items-center gap-1.5 text-[11px] text-glassy-text">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: DEVICE_TYPE_COLORS[type] }} />
              {DEVICE_TYPE_META[type].label}
            </span>
          ))}
          <span className="ml-auto text-[11px] text-glassy-muted">Scroll to zoom · drag to pan · click a device for details</span>
        </div>
      </Panel>
    </div>
  )
}
