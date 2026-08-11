/**
 * Overview screen: the network dashboard (Phase 3 upgrade). Shows stat cards
 * (devices online, known devices, new devices, last scan duration), the
 * detected network interfaces with one-click "scan this network" shortcuts, a
 * live activity feed of new-device / online / offline alerts, a device-type
 * breakdown and the most recently discovered hosts with "new" markers.
 */
import { Activity, Bell, Clock, Map as MapIcon, MonitorDot, Network, ScanLine, Sparkles } from 'lucide-react'
import type { DeviceTypeId, HostResult, KnownDevice, MonitorEvent, NetworkInterface, ScanProgress, ScanStatus, ScanSummary } from '../../../shared/types'
import { Badge, Button, Panel, ProgressBar } from '../components/ui'
import { DeviceTypeIcon } from '../components/DeviceTypeIcon'
import { cn, DEVICE_TYPE_COLORS, DEVICE_TYPE_META, timeAgo } from '../lib'

function StatCard({ icon: Icon, label, value, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; tone?: 'good' | 'accent' }): React.JSX.Element {
  return (
    <Panel className="flex items-center gap-4">
      <div
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border',
          tone === 'good'
            ? 'border-glassy-good/40 bg-glassy-good/10 text-glassy-good'
            : tone === 'accent'
              ? 'border-glassy-accent/40 bg-glassy-accent/10 text-glassy-accent shadow-glow'
              : 'border-glassy-borderlight bg-glassy-panel2 text-glassy-muted'
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-2xl font-bold leading-tight text-glassy-text">{value}</div>
        <div className="text-xs text-glassy-muted">{label}</div>
      </div>
    </Panel>
  )
}

/** Stable per-device identity, matching the main-process ledger key. */
function deviceKey(host: HostResult): string {
  return (host.mac ?? host.ip).toLowerCase()
}

const ALERT_META: Record<MonitorEvent['type'], { label: string; tone: 'accent' | 'good' | 'bad' }> = {
  new: { label: 'New device', tone: 'accent' },
  online: { label: 'Online', tone: 'good' },
  offline: { label: 'Offline', tone: 'bad' }
}

export function OverviewScreen({
  interfaces,
  hosts,
  summary,
  status,
  progress,
  alerts,
  knownDevices,
  onGoScan,
  onGoMap
}: {
  interfaces: NetworkInterface[]
  hosts: HostResult[]
  summary: ScanSummary | null
  status: ScanStatus
  progress: ScanProgress | null
  alerts: MonitorEvent[]
  knownDevices: KnownDevice[]
  onGoScan: (target?: string) => void
  onGoMap: () => void
}): React.JSX.Element {
  const scanning = status === 'running' || status === 'paused'
  const lastHosts = [...hosts].slice(-6).reverse()
  const onlineCount = hosts.filter((h) => h.status === 'online').length

  const knownByKey = buildKeyedMap(knownDevices)
  const now = Date.now()
  const newCount = knownDevices.filter((d) => now - new Date(d.firstSeen).getTime() < 24 * 3600_000).length
  const recentAlerts = [...alerts].slice(-8).reverse()

  const typeCounts = new Map<DeviceTypeId, number>()
  for (const h of hosts) {
    typeCounts.set(h.deviceType, (typeCounts.get(h.deviceType) ?? 0) + 1)
  }
  const breakdown = [...typeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-glassy-accent" />
          <h2 className="text-lg font-bold text-glassy-text">Network Overview</h2>
          {scanning ? <Badge tone="accent">{status === 'paused' ? 'Paused' : 'Scanning…'}</Badge> : summary ? <Badge tone="good">Last scan complete</Badge> : null}
        </div>
        <div className="flex items-center gap-2">
          {hosts.length > 0 ? (
            <Button variant="outline" size="sm" onClick={onGoMap}>
              <MapIcon className="h-3.5 w-3.5" /> Network map
            </Button>
          ) : null}
          <Button variant="primary" size="sm" onClick={() => onGoScan()}>
            <ScanLine className="h-3.5 w-3.5" /> Start a scan
          </Button>
        </div>
      </div>

      {scanning && progress ? (
        <Panel>
          <ProgressBar value={progress.done} max={progress.total} label={`${progress.done} / ${progress.total} probed`} />
        </Panel>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={MonitorDot} label="Devices online" value={String(onlineCount)} tone="good" />
        <StatCard icon={Network} label="Known devices" value={String(knownDevices.length)} tone="accent" />
        <StatCard icon={Sparkles} label="New in last 24h" value={String(newCount)} />
        <StatCard icon={Clock} label="Last scan duration" value={summary ? `${(summary.durationMs / 1000).toFixed(1)}s` : '—'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-glassy-muted">Activity</div>
          {recentAlerts.length === 0 ? (
            <Panel className="text-sm text-glassy-muted">
              No monitoring activity yet. Run a few scans over time and Glassy will flag new devices, and devices that come online or go offline.
            </Panel>
          ) : (
            <Panel className="p-0">
              <ul className="divide-y divide-glassy-border">
                {recentAlerts.map((alert) => {
                  const meta = ALERT_META[alert.type]
                  return (
                    <li key={alert.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <DeviceTypeIcon type={alert.device.deviceType} className="text-glassy-accent/70" />
                        <span className="truncate text-sm text-glassy-text">{alert.device.hostname ?? alert.device.vendor ?? alert.device.ip}</span>
                        <span className="truncate font-mono text-[11px] text-glassy-muted">{alert.device.ip}</span>
                      </div>
                      <span className="flex shrink-0 items-center gap-2">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        <span className="text-[11px] text-glassy-muted">{timeAgo(alert.at)}</span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </Panel>
          )}
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-glassy-muted">Device categories</div>
          {breakdown.length === 0 ? (
            <Panel className="text-sm text-glassy-muted">No devices discovered yet. Run a scan to see the network mix.</Panel>
          ) : (
            <Panel>
              <div className="flex flex-wrap gap-2">
                {breakdown.map(([type, count]) => (
                  <span
                    key={type}
                    className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-glassy-text"
                    style={{ borderColor: `${DEVICE_TYPE_COLORS[type]}55`, background: `${DEVICE_TYPE_COLORS[type]}18` }}
                  >
                    <DeviceTypeIcon type={type} className="h-3.5 w-3.5" />
                    {DEVICE_TYPE_META[type].label}
                    <span className="font-mono text-glassy-muted">{count}</span>
                  </span>
                ))}
              </div>
            </Panel>
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-glassy-muted">Your networks</div>
        {interfaces.length === 0 ? (
          <Panel className="text-sm text-glassy-muted">No network interfaces detected. Check your adapters and refresh.</Panel>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {interfaces.map((iface) => (
              <Panel key={iface.cidr + iface.name} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-glassy-text">{iface.name}</span>
                    <Badge tone="default">{iface.cidr}</Badge>
                  </div>
                  <div className="mt-0.5 font-mono text-xs text-glassy-muted">
                    {iface.ip} · {iface.mac ?? 'no MAC'}
                  </div>
                </div>
                <Button variant="outline" size="sm" className="shrink-0" onClick={() => onGoScan(iface.cidr)}>
                  <ScanLine className="h-3.5 w-3.5" /> Scan
                </Button>
              </Panel>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-glassy-muted">
          <Bell className="h-3.5 w-3.5" />
          Recently discovered
        </div>
        {lastHosts.length === 0 ? (
          <Panel className="text-sm text-glassy-muted">No devices discovered yet. Run a scan to populate this list.</Panel>
        ) : (
          <Panel className="p-0">
            <ul className="divide-y divide-glassy-border">
              {lastHosts.map((host) => {
                const known = knownByKey.get(deviceKey(host))
                const isNew = !known || now - new Date(known.firstSeen).getTime() < 3600_000
                return (
                  <li key={host.ip} className="flex items-center justify-between gap-4 px-4 py-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <DeviceTypeIcon type={host.deviceType} className="text-glassy-accent/70" />
                        <span className="truncate text-sm font-semibold text-glassy-text">{host.hostname ?? host.vendor ?? host.ip}</span>
                        <Badge tone="good">online</Badge>
                        {isNew ? <Badge tone="accent">new</Badge> : null}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-glassy-muted">
                        <span className="font-mono">{host.ip}</span>
                        {host.vendor && host.hostname ? ` · ${host.vendor}` : ''}
                      </div>
                    </div>
                    <span className="flex shrink-0 items-center gap-2">
                      {host.mac ? <span className="font-mono text-xs text-glassy-muted">{host.mac}</span> : null}
                      {host.latencyMs !== null ? <span className="font-mono text-xs text-glassy-muted">{host.latencyMs}ms</span> : null}
                    </span>
                  </li>
                )
              })}
            </ul>
          </Panel>
        )}
      </div>
    </div>
  )
}

/** Builds a Map of known devices keyed by the ledger key. */
function buildKeyedMap(devices: KnownDevice[]): Map<string, KnownDevice> {
  const map = new Map<string, KnownDevice>()
  for (const d of devices) map.set(d.key, d)
  return map
}
