/**
 * Overview screen: a clean dashboard of the local network. Shows stat cards
 * (devices online, networks, scan duration), the detected network interfaces
 * with one-click "scan this network" shortcuts, and the most recent hosts.
 */
import { Activity, Clock, Laptop, MonitorDot, Network, ScanLine } from 'lucide-react'
import type { HostResult, NetworkInterface, ScanProgress, ScanStatus, ScanSummary } from '../../../shared/types'
import { Badge, Button, Panel, ProgressBar } from '../components/ui'
import { cn } from '../lib'

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

export function OverviewScreen({
  interfaces,
  hosts,
  summary,
  status,
  progress,
  onGoScan
}: {
  interfaces: NetworkInterface[]
  hosts: HostResult[]
  summary: ScanSummary | null
  status: ScanStatus
  progress: ScanProgress | null
  onGoScan: (target?: string) => void
}): React.JSX.Element {
  const scanning = status === 'running' || status === 'paused'
  const lastHosts = [...hosts].slice(-6).reverse()
  const onlineCount = hosts.filter((h) => h.status === 'online').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-glassy-accent" />
          <h2 className="text-lg font-bold text-glassy-text">Network Overview</h2>
          {scanning ? <Badge tone="accent">{status === 'paused' ? 'Paused' : 'Scanning…'}</Badge> : summary ? <Badge tone="good">Last scan complete</Badge> : null}
        </div>
        <Button variant="primary" size="sm" onClick={() => onGoScan()}>
          <ScanLine className="h-3.5 w-3.5" /> Start a scan
        </Button>
      </div>

      {scanning && progress ? (
        <Panel>
          <ProgressBar
            value={progress.done}
            max={progress.total}
            label={`${progress.done} / ${progress.total} probed`}
          />
        </Panel>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={MonitorDot} label="Devices online" value={String(onlineCount)} tone="good" />
        <StatCard icon={Network} label="Networks detected" value={String(interfaces.length)} tone="accent" />
        <StatCard icon={Clock} label="Last scan duration" value={summary ? `${(summary.durationMs / 1000).toFixed(1)}s` : '—'} />
        <StatCard icon={Laptop} label="Addresses probed" value={summary ? String(summary.total) : '—'} />
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
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-glassy-muted">Recently discovered</div>
        {lastHosts.length === 0 ? (
          <Panel className="text-sm text-glassy-muted">No devices discovered yet. Run a scan to populate this list.</Panel>
        ) : (
          <Panel className="p-0">
            <ul className="divide-y divide-glassy-border">
              {lastHosts.map((host) => (
                <li key={host.ip} className="flex items-center justify-between gap-4 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-glassy-text">{host.ip}</span>
                      <Badge tone="good">online</Badge>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-glassy-muted">
                      {host.hostname ?? host.vendor ?? 'Unknown device'}
                      {host.vendor && host.hostname ? ` · ${host.vendor}` : ''}
                    </div>
                  </div>
                  <span className="flex shrink-0 items-center gap-2">
                    {host.mac ? <span className="font-mono text-xs text-glassy-muted">{host.mac}</span> : null}
                    {host.latencyMs !== null ? <span className="font-mono text-xs text-glassy-muted">{host.latencyMs}ms</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </div>
  )
}
