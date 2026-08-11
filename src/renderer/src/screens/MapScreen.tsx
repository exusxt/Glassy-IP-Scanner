/**
 * Network Map screen (Phase 3): an interactive SVG topology view. The gateway
 * (router) sits at the center and every other discovered device orbits it on a
 * ring; edges represent the direct LAN connection. Supports zoom (wheel),
 * pan (drag), node selection for details, a device-type legend and a
 * "scan this device" shortcut.
 */
import { useMemo, useRef, useState } from 'react'
import { Maximize, Minus, Network, Plus, ScanLine, X } from 'lucide-react'
import type { DeviceProfiles, HostResult } from '../../../shared/types'
import { Badge, Button, Panel } from '../components/ui'
import { DeviceTypeIcon } from '../components/DeviceTypeIcon'
import { cn, DEVICE_TYPE_COLORS, DEVICE_TYPE_META, portServiceName } from '../lib'

const NODE_RADIUS = 17
const CENTER_RADIUS = 24

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

export function MapScreen({
  hosts,
  devices,
  onGoScan
}: {
  hosts: HostResult[]
  devices: DeviceProfiles
  onGoScan: (target: string) => void
}): React.JSX.Element {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [selectedIp, setSelectedIp] = useState<string | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number; moved: boolean } | null>(null)

  const { center, nodes, maxR } = useMemo(() => {
    const online = hosts.filter((h) => h.status === 'online')
    const centerNode = online.find((h) => h.deviceType === 'router') ?? online[0] ?? null
    const others = centerNode ? online.filter((h) => h.ip !== centerNode.ip) : online
    const radius = Math.max(160, Math.min(620, 160 + others.length * 22))
    const placed = others.map((h, i) => {
      const angle = (i / Math.max(others.length, 1)) * 2 * Math.PI - Math.PI / 2
      return { host: h, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
    })
    const maxR = radius + 120
    return { center: centerNode, nodes: placed, maxR }
  }, [hosts])

  const profiles = useMemo(() => new Map(Object.entries(devices)), [devices])

  const displayName = (h: HostResult): string => {
    const key = (h.mac ?? h.ip).toLowerCase()
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

  const presentTypes = useMemo(() => {
    const types = new Set(hosts.map((h) => h.deviceType))
    return [...types]
  }, [hosts])

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

  const label = center ? truncate(displayName(center), 16) : 'Network'
  const edgeTargets = center ? nodes.filter((n) => n.host.ip !== center.ip) : []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network className="h-5 w-5 text-glassy-accent" />
          <h2 className="text-lg font-bold text-glassy-text">Network Map</h2>
          <Badge tone="good">{hosts.length} device(s)</Badge>
        </div>
        <div className="flex items-center gap-2">
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

      <Panel className="relative p-0">
        <div className="relative flex h-[32rem] items-center justify-center overflow-hidden">
          <svg
            viewBox={`${-maxR} ${-maxR} ${maxR * 2} ${maxR * 2}`}
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
              {center ? <circle r={maxR * 0.6} fill="url(#map-glow)" pointerEvents="none" /> : null}

              {edgeTargets.map(({ host, x, y }) => (
                <line
                  key={`edge-${host.ip}`}
                  x1={0}
                  y1={0}
                  x2={x}
                  y2={y}
                  stroke={host.status === 'online' ? 'rgba(148,163,184,0.35)' : 'rgba(148,163,184,0.15)'}
                  strokeWidth={1.5}
                  pointerEvents="none"
                />
              ))}

              {nodes.map(({ host, x, y }) => {
                const color = DEVICE_TYPE_COLORS[host.deviceType]
                const isSelected = host.ip === selectedIp
                return (
                  <g key={host.ip} transform={`translate(${x} ${y})`}>
                    <circle
                      r={NODE_RADIUS + 5}
                      fill="transparent"
                      onClick={() => setSelectedIp(host.ip)}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="cursor-pointer"
                    >
                      <title>{displayName(host)} · {host.ip}</title>
                    </circle>
                    <circle
                      r={NODE_RADIUS}
                      fill={`${color}33`}
                      stroke={color}
                      strokeWidth={isSelected ? 3 : 1.5}
                      className={cn(host.status === 'online' && !isSelected && 'animate-map-node')}
                      style={{ strokeOpacity: host.status === 'online' ? 1 : 0.4 }}
                      pointerEvents="none"
                    />
                    <text
                      y={NODE_RADIUS + 16}
                      textAnchor="middle"
                      fontSize={11}
                      fill="var(--glassy-text)"
                      pointerEvents="none"
                      style={{ opacity: 0.9 }}
                    >
                      {truncate(displayName(host), 16)}
                    </text>
                  </g>
                )
              })}

              {center ? (
                <g>
                  <circle r={CENTER_RADIUS + 8} fill="transparent" onClick={() => setSelectedIp(center.ip)} className="cursor-pointer">
                    <title>{label} · {center.ip}</title>
                  </circle>
                  <circle r={CENTER_RADIUS} fill={`${DEVICE_TYPE_COLORS.router}2e`} stroke={DEVICE_TYPE_COLORS.router} strokeWidth={2} style={{ filter: 'drop-shadow(0 0 8px rgba(245,158,11,0.5))' }} pointerEvents="none" />
                  <text y={CENTER_RADIUS + 18} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--glassy-text)" pointerEvents="none">
                    {label}
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
