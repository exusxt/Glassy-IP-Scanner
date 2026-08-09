/**
 * Network Scanner screen: configure a scan (target, concurrency, timeout,
 * discovery methods), drive it via the main-process scanner, and inspect the
 * live results in a table. Streamed events from main keep the UI in sync.
 */
import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Ban, Pause, Play, Radar, RotateCcw, ScanLine, Zap } from 'lucide-react'
import type { HostResult, NetworkInterface, ScanProgress, ScanStatus, ScanSummary } from '../../../shared/types'
import { Badge, Button, Panel, ProgressBar, Spinner } from '../components/ui'
import { cn } from '../lib'

const VALID_TARGET = /^(?:((?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\/(?:[1-9]|[12]\d|3[0-2]))|((?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:-((?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d))?$/

type SortKey = 'status' | 'ip' | 'hostname' | 'mac' | 'latency'
type SortDir = 'asc' | 'desc'

const SORT_COLS: Array<{ key: SortKey | null; label: string }> = [
  { key: 'status', label: 'Status' },
  { key: 'ip', label: 'IP' },
  { key: 'hostname', label: 'Hostname' },
  { key: 'mac', label: 'MAC / Vendor' },
  { key: 'latency', label: 'Latency' },
  { key: null, label: 'Via' }
]

function parsePorts(input: string): number[] {
  return [...new Set(input.split(',').map((p) => p.trim()).filter(Boolean).map(Number).filter((n) => Number.isInteger(n) && n > 0 && n <= 65535))]
}

export function ScannerScreen({
  interfaces,
  status,
  progress,
  summary,
  hosts,
  initialTarget,
  onTargetConsumed,
  onStatusChange
}: {
  interfaces: NetworkInterface[]
  status: ScanStatus
  progress: ScanProgress | null
  summary: ScanSummary | null
  hosts: HostResult[]
  initialTarget: string | null
  onTargetConsumed: () => void
  onStatusChange: (status: ScanStatus) => void
}): React.JSX.Element {
  const [target, setTarget] = useState('')
  const [concurrency, setConcurrency] = useState(50)
  const [timeoutMs, setTimeoutMs] = useState(500)
  const [retries, setRetries] = useState(2)
  const [icmp, setIcmp] = useState(true)
  const [tcp, setTcp] = useState(true)
  const [arp, setArp] = useState(true)
  const [portsInput, setPortsInput] = useState('80,443')
  const [starting, setStarting] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('ip')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  useEffect(() => {
    if (initialTarget) {
      setTarget(initialTarget)
      onTargetConsumed()
    }
  }, [initialTarget, onTargetConsumed])

  const targetValid = VALID_TARGET.test(target.trim())
  const scanning = status === 'running' || status === 'paused'

  const doScan = async (): Promise<void> => {
    if (!targetValid || scanning) return
    setStarting(true)
    try {
      const state = await window.api.scan({
        target: target.trim(),
        concurrency,
        timeoutMs,
        retries,
        methods: { icmp, tcp, arp },
        tcpPorts: tcp ? parsePorts(portsInput) : []
      })
      onStatusChange(state.status)
    } finally {
      setStarting(false)
    }
  }

  const control = async (fn: () => Promise<{ status: ScanStatus }>): Promise<void> => {
    try {
      onStatusChange((await fn()).status)
    } catch {
      // The main process may reject control calls while no scan is active.
    }
  }

  const onlineHosts = useMemo(() => hosts.filter((h) => h.status === 'online'), [hosts])

  const sortedHosts = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...hosts].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'status':
          cmp = (a.status === 'online' ? 0 : 1) - (b.status === 'online' ? 0 : 1)
          break
        case 'ip': {
          const pa = a.ip.split('.').map(Number)
          const pb = b.ip.split('.').map(Number)
          for (let i = 0; i < 4; i++) {
            if (pa[i] !== pb[i]) {
              cmp = pa[i] - pb[i]
              break
            }
          }
          break
        }
        case 'hostname':
          cmp = (a.hostname ?? a.vendor ?? '').localeCompare(b.hostname ?? b.vendor ?? '')
          break
        case 'mac':
          cmp = (a.mac ?? '').localeCompare(b.mac ?? '')
          break
        case 'latency':
          cmp = (a.latencyMs ?? Infinity) - (b.latencyMs ?? Infinity)
          break
      }
      return cmp * dir
    })
  }, [hosts, sortKey, sortDir])

  const toggleSort = (key: SortKey): void => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Radar className="h-5 w-5 text-glassy-accent" />
        <h2 className="text-lg font-bold text-glassy-text">Network Scanner</h2>
        {scanning ? <Badge tone="accent">{status === 'paused' ? 'Paused' : 'Scanning…'}</Badge> : null}
      </div>

      <Panel className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-60 flex-1 flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-glassy-muted">Target</span>
            <div className="relative">
              <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-glassy-muted" />
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="e.g. 192.168.1.0/24 or 192.168.1.10-192.168.1.40"
                spellCheck={false}
                className={cn(
                  'glass-input w-full rounded-lg py-2 pl-9 pr-3 font-mono text-sm text-glassy-text caret-glassy-accent placeholder:font-sans placeholder:text-glassy-muted/80'
                )}
              />
            </div>
            <span className="text-[11px] text-glassy-muted">CIDR, single IP, or IP range. Quick pick:</span>
            <div className="flex flex-wrap gap-1.5">
              {interfaces.slice(0, 4).map((iface) => (
                <button
                  key={iface.cidr}
                  type="button"
                  onClick={() => setTarget(iface.cidr)}
                  className="rounded-full border border-glassy-borderlight bg-glassy-panel2/60 px-2.5 py-0.5 font-mono text-[11px] text-glassy-muted transition-colors hover:border-glassy-accent/60 hover:text-glassy-accent"
                >
                  {iface.cidr}
                </button>
              ))}
            </div>
          </label>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Concurrency', value: concurrency, set: setConcurrency, min: 1, max: 1000 },
              { label: 'Timeout (ms)', value: timeoutMs, set: setTimeoutMs, min: 50, max: 10000 },
              { label: 'Retries', value: retries, set: setRetries, min: 0, max: 10 }
            ].map((field) => (
              <label key={field.label} className="flex w-28 flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-glassy-muted">{field.label}</span>
                <input
                  type="number"
                  min={field.min}
                  max={field.max}
                  value={field.value}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    if (!Number.isNaN(n)) field.set(Math.min(field.max, Math.max(field.min, n)))
                  }}
                    className="glass-input w-full rounded-lg px-3 py-2 font-mono text-sm text-glassy-text caret-glassy-accent"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {(['icmp', 'tcp', 'arp'] as const).map((m) => {
              const active = m === 'icmp' ? icmp : m === 'tcp' ? tcp : arp
              const set = m === 'icmp' ? setIcmp : m === 'tcp' ? setTcp : setArp
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => set(!active)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wider transition-colors',
                    active
                      ? 'border-glassy-accent/60 bg-glassy-accent/15 text-glassy-accent shadow-glow'
                      : 'border-glassy-borderlight bg-glassy-panel2/60 text-glassy-muted hover:text-glassy-text'
                  )}
                >
                  {m}
                </button>
              )
            })}
            {tcp ? (
              <label className="flex items-center gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-glassy-muted">TCP ports</span>
                <input
                  value={portsInput}
                  onChange={(e) => setPortsInput(e.target.value)}
                  placeholder="80,443"
                  spellCheck={false}
                  className="glass-input w-40 rounded-lg px-3 py-1.5 font-mono text-sm text-glassy-text caret-glassy-accent"
                />
              </label>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {status === 'running' || status === 'paused' ? (
              <>
                {status === 'paused' ? (
                  <Button variant="primary" size="sm" onClick={() => void control(() => window.api.scanResume())}>
                    <Play className="h-3.5 w-3.5" /> Resume
                  </Button>
                ) : (
                  <Button variant="default" size="sm" onClick={() => void control(() => window.api.scanPause())}>
                    <Pause className="h-3.5 w-3.5" /> Pause
                  </Button>
                )}
                <Button variant="danger" size="sm" onClick={() => void control(() => window.api.scanCancel())}>
                  <Ban className="h-3.5 w-3.5" /> Cancel
                </Button>
              </>
            ) : (
              <Button variant="primary" size="sm" onClick={() => void doScan()} disabled={!targetValid || starting}>
                {starting ? <Spinner className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
                {summary && summary.target === target.trim() ? 'Scan again' : 'Start scan'}
              </Button>
            )}
          </div>
        </div>
      </Panel>

      {scanning && progress ? (
        <Panel>
          <ProgressBar value={progress.done} max={progress.total} label={`${progress.done} / ${progress.total} probed`} />
        </Panel>
      ) : null}

      {summary ? (
        <Panel className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone={status === 'cancelled' ? 'warn' : 'good'}>
              {status === 'cancelled' ? 'Cancelled' : 'Scan complete'}
            </Badge>
            <span className="text-glassy-muted">
              <span className="font-mono text-glassy-text">{summary.target}</span> · {summary.total} addresses · {summary.online} online ·{' '}
              {(summary.durationMs / 1000).toFixed(1)}s
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => void doScan()}>
            <RotateCcw className="h-3.5 w-3.5" /> Rescan target
          </Button>
        </Panel>
      ) : null}

      <Panel className="p-0">
        <div className="flex items-center justify-between border-b border-glassy-border px-4 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-glassy-muted">
            Results
          </span>
          <span className="flex items-center gap-2 text-xs text-glassy-muted">
            <Badge tone="good">{onlineHosts.length} online</Badge>
            <Badge tone="default">{hosts.length} total</Badge>
          </span>
        </div>
        {hosts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <Radar className="h-8 w-8 text-glassy-muted/60" />
            <p className="text-sm text-glassy-muted">
              {scanning ? 'Probing addresses…' : 'No results yet. Configure a target and start scanning.'}
            </p>
          </div>
        ) : (
          <div className="max-h-[26rem] overflow-y-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="table-header sticky top-0 z-10">
                <tr className="text-xs uppercase tracking-wider text-glassy-muted">
                  {SORT_COLS.map(({ key, label }) =>
                    key ? (
                      <th key={label} className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => toggleSort(key)}
                          className="group flex items-center gap-1 font-semibold uppercase tracking-wider transition-colors hover:text-glassy-accent"
                          title={`Sort by ${label}`}
                        >
                          {label}
                          {sortKey === key ? (
                            sortDir === 'asc' ? (
                              <ArrowUp className="h-3 w-3 text-glassy-accent" />
                            ) : (
                              <ArrowDown className="h-3 w-3 text-glassy-accent" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3 text-glassy-muted/50 opacity-0 transition-opacity group-hover:opacity-100" />
                          )}
                        </button>
                      </th>
                    ) : (
                      <th key={label} className="px-4 py-2 font-semibold">
                        {label}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-glassy-border">
                {sortedHosts.map((host) => (
                  <tr key={host.ip} className="transition-colors hover:bg-glassy-panel2/40">
                    <td className="px-4 py-2">
                      <Badge tone={host.status === 'online' ? 'good' : 'default'}>{host.status}</Badge>
                    </td>
                    <td className="px-4 py-2 font-mono text-glassy-text">{host.ip}</td>
                    <td className="max-w-44 truncate px-4 py-2 text-glassy-text">{host.hostname ?? host.vendor ?? '—'}</td>
                    <td className="max-w-52 px-4 py-2">
                      <span className="font-mono text-xs text-glassy-text">{host.mac ?? '—'}</span>
                      {host.vendor ? <span className="ml-1.5 text-xs text-glassy-muted">({host.vendor})</span> : null}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-glassy-muted">
                      {host.latencyMs !== null ? `${host.latencyMs} ms` : '—'}
                    </td>
                    <td className="px-4 py-2">
                      <span className="flex flex-wrap gap-1">
                        {host.via.map((v) => (
                          <span key={v} className="rounded bg-glassy-accent/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-glassy-accent">
                            {v}
                          </span>
                        ))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
