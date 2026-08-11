/**
 * Network Scanner screen: configure a scan (target, concurrency, timeout,
 * discovery methods), drive it via the main-process scanner, and inspect the
 * live results in a table. Phase 2 additions: search & filtering, device type
 * classification, a TCP port scanner with presets, per-device profiles
 * (custom name / notes / tags / favorite) and a detail dialog.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Ban,
  Pause,
  Play,
  Radar,
  RotateCcw,
  ScanLine,
  Search,
  Star,
  X,
  Zap
} from 'lucide-react'
import type { DeviceProfile, DeviceProfiles, DeviceTypeId, HostResult, NetworkInterface, PortScanProgress, ScanProgress, ScanStatus, ScanSummary } from '../../../shared/types'
import { DeviceTypeIcon } from '../components/DeviceTypeIcon'
import { Badge, Button, Field, Input, Panel, ProgressBar, Select, Spinner } from '../components/ui'
import { cn, DEVICE_TYPE_META, portServiceName } from '../lib'

const VALID_TARGET = /^(?:((?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\/(?:[1-9]|[12]\d|3[0-2]))|((?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:-((?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d))?$/

type SortKey = 'status' | 'device' | 'ip' | 'mac' | 'type' | 'ports' | 'latency'
type SortDir = 'asc' | 'desc'
type FilterStatus = 'all' | 'online' | 'offline'
type PortPresetId = 'common' | 'web' | 'file' | 'gaming' | 'custom'

const SORT_COLS: Array<{ key: SortKey | null; label: string }> = [
  { key: null, label: '' },
  { key: 'status', label: 'Status' },
  { key: 'device', label: 'Device' },
  { key: 'ip', label: 'IP' },
  { key: 'mac', label: 'MAC / Vendor' },
  { key: 'type', label: 'Type' },
  { key: 'ports', label: 'Ports' },
  { key: 'latency', label: 'Latency' },
  { key: null, label: 'Via' }
]

const PORT_PRESETS: Record<Exclude<PortPresetId, 'custom'>, number[]> = {
  common: [22, 53, 80, 443, 445, 139, 137, 3389, 5900, 8080, 8000, 8443, 8888, 8081, 5000, 5060, 1935, 8883, 5353, 1900],
  web: [80, 443, 8080, 8443, 8000, 8888, 3000, 3001, 8081, 9090],
  file: [21, 22, 445, 139, 137, 138, 2049, 873, 548, 111],
  gaming: [27015, 27016, 27017, 27018, 3074, 1935, 3724, 7777, 30000, 25565, 2302, 4380]
}

const PORT_PRESET_LABELS: Record<PortPresetId, string> = {
  common: 'Common',
  web: 'Web',
  file: 'File sharing',
  gaming: 'Gaming',
  custom: 'Custom range'
}

function parsePorts(input: string): number[] {
  return [...new Set(input.split(',').map((p) => p.trim()).filter(Boolean).map(Number).filter((n) => Number.isInteger(n) && n > 0 && n <= 65535))]
}

/** Expands a from-to range, capped at 1024 ports to keep scans reasonable. */
function expandPortRange(from: number, to: number): number[] {
  const start = Math.min(Math.max(Math.trunc(from), 1), 65535)
  const end = Math.min(Math.max(Math.trunc(to), start), 65535)
  if (end - start + 1 > 1024) return []
  const ports: number[] = []
  for (let p = start; p <= end; p++) ports.push(p)
  return ports
}

function parseTags(input: string): string[] {
  return [...new Set(input.split(',').map((t) => t.trim()).filter(Boolean))].slice(0, 10)
}

/** Stable per-device identity: MAC when known, otherwise the IP. */
function deviceKey(host: HostResult): string {
  return host.mac ?? host.ip
}

/** Detail dialog for editing a device's profile (name, notes, tags, favorite). */
function DeviceDetailsModal({
  host,
  profile,
  onUpdate,
  onClose
}: {
  host: HostResult
  profile: DeviceProfile | undefined
  onUpdate: (patch: Partial<DeviceProfile>) => void
  onClose: () => void
}): React.JSX.Element {
  const [customName, setCustomName] = useState(profile?.customName ?? '')
  const [notes, setNotes] = useState(profile?.notes ?? '')
  const [tags, setTags] = useState((profile?.tags ?? []).join(', '))
  const [favorite, setFavorite] = useState(profile?.favorite ?? false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md space-y-4 rounded-xl border border-glassy-border bg-glassy-panel p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <DeviceTypeIcon type={host.deviceType} withLabel />
              <Badge tone={host.status === 'online' ? 'good' : 'default'}>{host.status}</Badge>
            </div>
            <h3 className="mt-1 truncate text-lg font-bold text-glassy-text">{customName.trim() || host.hostname || host.ip}</h3>
            <p className="font-mono text-xs text-glassy-muted">{host.ip}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-glassy-muted transition-colors hover:bg-glassy-panel2 hover:text-glassy-text" title="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-1.5 rounded-lg border border-glassy-border bg-glassy-panel2/50 p-3 text-xs">
          <div className="flex justify-between gap-2"><span className="text-glassy-muted">MAC</span><span className="truncate font-mono text-glassy-text">{host.mac ?? '—'}</span></div>
          <div className="flex justify-between gap-2"><span className="text-glassy-muted">Vendor</span><span className="truncate text-glassy-text">{host.vendor ?? '—'}</span></div>
          <div className="flex justify-between gap-2"><span className="text-glassy-muted">Hostname</span><span className="truncate text-glassy-text">{host.hostname ?? '—'}</span></div>
          {host.openPorts.length > 0 ? (
            <div className="flex justify-between gap-2">
              <span className="shrink-0 text-glassy-muted">Open ports</span>
              <span className="truncate text-glassy-text">
                {host.openPorts.map((p) => `${p}/${portServiceName(p)}`).join(', ')}
              </span>
            </div>
          ) : null}
        </div>

        <Field label="Custom name">
          <Input value={customName} onChange={(e) => { setCustomName(e.target.value); onUpdate({ customName: e.target.value.trim() || null }) }} placeholder="e.g. Living Room TV" />
        </Field>
        <Field label="Tags" hint="Comma-separated, e.g. media, bedroom">
          <Input value={tags} onChange={(e) => { setTags(e.target.value); onUpdate({ tags: parseTags(e.target.value) }) }} placeholder="media, bedroom" />
        </Field>
        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => { setNotes(e.target.value); onUpdate({ notes: e.target.value.trim() || null }) }}
            placeholder="Anything worth remembering about this device…"
            className="glass-input w-full rounded-lg px-3 py-2 text-sm text-glassy-text caret-glassy-accent placeholder:text-glassy-muted/80"
            rows={3}
          />
        </Field>

        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-glassy-border bg-glassy-panel2/50 p-3 transition-colors hover:border-glassy-borderlight">
          <input
            type="checkbox"
            checked={favorite}
            onChange={(e) => { setFavorite(e.target.checked); onUpdate({ favorite: e.target.checked }) }}
            className="h-4 w-4 shrink-0 cursor-pointer appearance-none rounded border border-glassy-borderlight bg-glassy-panel2 transition-all checked:border-glassy-accent checked:bg-glassy-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-glassy-accent/60"
          />
          <span className="text-sm font-medium text-glassy-text">Mark as favorite</span>
        </label>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  )
}

export function ScannerScreen({
  interfaces,
  status,
  progress,
  summary,
  hosts,
  devices,
  onUpdateDevice,
  initialTarget,
  onTargetConsumed,
  onStatusChange
}: {
  interfaces: NetworkInterface[]
  status: ScanStatus
  progress: ScanProgress | null
  summary: ScanSummary | null
  hosts: HostResult[]
  devices: DeviceProfiles
  onUpdateDevice: (key: string, patch: Partial<DeviceProfile>) => void
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

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [filterType, setFilterType] = useState<DeviceTypeId | 'all'>('all')
  const [favoritesOnly, setFavoritesOnly] = useState(false)

  const [portPreset, setPortPreset] = useState<PortPresetId>('common')
  const [rangeFrom, setRangeFrom] = useState(1)
  const [rangeTo, setRangeTo] = useState(1024)
  const [portScanning, setPortScanning] = useState(false)
  const [portProgress, setPortProgress] = useState<PortScanProgress | null>(null)

  const [detailKey, setDetailKey] = useState<string | null>(null)

  useEffect(() => {
    if (initialTarget) {
      setTarget(initialTarget)
      onTargetConsumed()
    }
  }, [initialTarget, onTargetConsumed])

  useEffect(() => {
    const off = window.api.onScanEvent((ev) => {
      if (ev.type === 'portProgress') setPortProgress(ev.progress)
      if (ev.type === 'portDone') setPortProgress(null)
    })
    return off
  }, [])

  const targetValid = VALID_TARGET.test(target.trim())
  const scanning = status === 'running' || status === 'paused'
  const profiles = useMemo(() => new Map(Object.entries(devices)), [devices])

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

  const runPortScan = async (): Promise<void> => {
    const ips = hosts.filter((h) => h.status === 'online').map((h) => h.ip)
    if (ips.length === 0 || portScanning) return
    const ports = portPreset === 'custom' ? expandPortRange(rangeFrom, rangeTo) : PORT_PRESETS[portPreset]
    if (ports.length === 0) return
    setPortScanning(true)
    setPortProgress(null)
    try {
      await window.api.scanPorts({ ips, ports, timeoutMs })
    } finally {
      setPortScanning(false)
    }
  }

  const onlineHosts = useMemo(() => hosts.filter((h) => h.status === 'online'), [hosts])

  const displayName = (h: HostResult): string => {
    const p = profiles.get(deviceKey(h))
    return p?.customName?.trim() || h.hostname || h.vendor || h.ip
  }

  const filteredHosts = useMemo(() => {
    const q = search.trim().toLowerCase()
    return hosts.filter((h) => {
      if (filterStatus !== 'all' && h.status !== filterStatus) return false
      if (filterType !== 'all' && h.deviceType !== filterType) return false
      const profile = profiles.get(deviceKey(h))
      if (favoritesOnly && !profile?.favorite) return false
      if (q) {
        const haystack = [h.ip, h.hostname, h.vendor, h.mac, profile?.customName, ...(profile?.tags ?? [])]
          .filter((s): s is string => Boolean(s))
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [hosts, search, filterStatus, filterType, favoritesOnly, profiles])

  const sortedHosts = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filteredHosts].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'status':
          cmp = (a.status === 'online' ? 0 : 1) - (b.status === 'online' ? 0 : 1)
          break
        case 'device':
          cmp = displayName(a).localeCompare(displayName(b))
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
        case 'mac':
          cmp = (a.mac ?? '').localeCompare(b.mac ?? '')
          break
        case 'type':
          cmp = a.deviceType.localeCompare(b.deviceType)
          break
        case 'ports':
          cmp = a.openPorts.length - b.openPorts.length
          break
        case 'latency':
          cmp = (a.latencyMs ?? Infinity) - (b.latencyMs ?? Infinity)
          break
      }
      return cmp * dir
    })
  }, [filteredHosts, sortKey, sortDir, profiles])

  const toggleSort = (key: SortKey): void => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const filtersActive = search.trim() !== '' || filterStatus !== 'all' || filterType !== 'all' || favoritesOnly
  const detailHost = detailKey ? hosts.find((h) => deviceKey(h) === detailKey) : null
  const rangeTooLarge = portPreset === 'custom' && (Math.max(1, Math.min(Math.max(rangeTo, rangeFrom), 65535)) - Math.min(Math.max(rangeFrom, 1), 65535) + 1) > 1024

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

      {!scanning && onlineHosts.length > 0 ? (
        <Panel className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-glassy-muted">TCP port scan</div>
              <div className="mt-0.5 text-[11px] text-glassy-muted">
                Probes the selected ports on all {onlineHosts.length} online device(s); open ports are tagged with their service.
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex w-40 flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-glassy-muted">Preset</span>
                <Select value={portPreset} onChange={(e) => setPortPreset(e.target.value as PortPresetId)}>
                  {(Object.keys(PORT_PRESET_LABELS) as PortPresetId[]).map((id) => (
                    <option key={id} value={id}>{PORT_PRESET_LABELS[id]}</option>
                  ))}
                </Select>
              </label>
              {portPreset === 'custom' ? (
                <>
                  <label className="flex w-24 flex-col gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-glassy-muted">From</span>
                    <input
                      type="number" min={1} max={65535} value={rangeFrom}
                      onChange={(e) => setRangeFrom(Number(e.target.value))}
                      className="glass-input w-full rounded-lg px-3 py-2 font-mono text-sm text-glassy-text caret-glassy-accent"
                    />
                  </label>
                  <label className="flex w-24 flex-col gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-glassy-muted">To</span>
                    <input
                      type="number" min={1} max={65535} value={rangeTo}
                      onChange={(e) => setRangeTo(Number(e.target.value))}
                      className="glass-input w-full rounded-lg px-3 py-2 font-mono text-sm text-glassy-text caret-glassy-accent"
                    />
                  </label>
                </>
              ) : null}
              <Button variant="primary" size="sm" onClick={() => void runPortScan()} disabled={portScanning || rangeTooLarge}>
                <ScanLine className="h-3.5 w-3.5" />
                {portScanning ? 'Scanning…' : 'Scan open ports'}
              </Button>
            </div>
          </div>
          {rangeTooLarge ? <p className="text-[11px] text-glassy-bad">Range too large — maximum 1024 ports per scan.</p> : null}
          {portScanning && portProgress ? (
            <ProgressBar
              value={portProgress.scanned}
              max={portProgress.total}
              label={`${portProgress.scanned} / ${portProgress.total} hosts · ${portProgress.currentIp}`}
            />
          ) : null}
        </Panel>
      ) : null}

      <Panel className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-glassy-border px-4 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-glassy-muted">Results</span>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-glassy-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search IP, name, vendor, tag…"
                spellCheck={false}
                className="glass-input w-64 rounded-lg py-1.5 pl-8 pr-3 text-xs text-glassy-text caret-glassy-accent placeholder:text-glassy-muted/80"
              />
            </div>
            <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as FilterStatus)} className="w-28 !py-1.5 !text-xs">
              <option value="all">All status</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </Select>
            <Select value={filterType} onChange={(e) => setFilterType(e.target.value as DeviceTypeId | 'all')} className="w-32 !py-1.5 !text-xs">
              <option value="all">All types</option>
              {(Object.keys(DEVICE_TYPE_META) as DeviceTypeId[]).map((t) => (
                <option key={t} value={t}>{DEVICE_TYPE_META[t].label}</option>
              ))}
            </Select>
            <button
              type="button"
              onClick={() => setFavoritesOnly((v) => !v)}
              className={cn(
                'flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                favoritesOnly
                  ? 'border-glassy-accent/60 bg-glassy-accent/15 text-glassy-accent'
                  : 'border-glassy-borderlight bg-glassy-panel2/60 text-glassy-muted hover:text-glassy-text'
              )}
            >
              <Star className={cn('h-3 w-3', favoritesOnly && 'fill-current')} /> Favorites
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between border-b border-glassy-border px-4 py-1.5 text-[11px] text-glassy-muted">
          <span>
            <Badge tone="good">{onlineHosts.length} online</Badge>
            <Badge tone="default" className="ml-1.5">{filteredHosts.length} shown</Badge>
            {filtersActive ? <Badge tone="accent" className="ml-1.5">filtered</Badge> : null}
          </span>
          <span className="text-glassy-muted">Click a row to name, tag or favorite a device.</span>
        </div>
        {hosts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <Radar className="h-8 w-8 text-glassy-muted/60" />
            <p className="text-sm text-glassy-muted">
              {scanning ? 'Probing addresses…' : 'No results yet. Configure a target and start scanning.'}
            </p>
          </div>
        ) : filteredHosts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <Search className="h-8 w-8 text-glassy-muted/60" />
            <p className="text-sm text-glassy-muted">No devices match the current filters.</p>
          </div>
        ) : (
          <div className="max-h-[24rem] overflow-y-auto">
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
                      <th key={`h-${label}`} className="px-4 py-2 font-semibold">
                        {label}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-glassy-border">
                {sortedHosts.map((host) => {
                  const key = deviceKey(host)
                  const profile = profiles.get(key)
                  const favorite = profile?.favorite ?? false
                  return (
                    <tr key={key} className="cursor-pointer transition-colors hover:bg-glassy-panel2/40" onClick={() => setDetailKey(key)}>
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          title={favorite ? 'Remove favorite' : 'Mark favorite'}
                          onClick={(e) => { e.stopPropagation(); onUpdateDevice(key, { favorite: !favorite }) }}
                          className="p-0.5 text-glassy-muted transition-colors hover:text-glassy-accent"
                        >
                          <Star className={cn('h-3.5 w-3.5', favorite && 'fill-current text-glassy-accent')} />
                        </button>
                      </td>
                      <td className="px-4 py-2">
                        <Badge tone={host.status === 'online' ? 'good' : 'default'}>{host.status}</Badge>
                      </td>
                      <td className="max-w-44 truncate px-4 py-2 text-glassy-text">
                        <span className="flex items-center gap-2">
                          <DeviceTypeIcon type={host.deviceType} />
                          <span className="truncate">{displayName(host)}</span>
                        </span>
                      </td>
                      <td className="px-4 py-2 font-mono text-glassy-text">{host.ip}</td>
                      <td className="max-w-52 px-4 py-2">
                        <span className="font-mono text-xs text-glassy-text">{host.mac ?? '—'}</span>
                        {host.vendor ? <span className="ml-1.5 text-xs text-glassy-muted">({host.vendor})</span> : null}
                      </td>
                      <td className="px-4 py-2">
                        <DeviceTypeIcon type={host.deviceType} withLabel className="text-glassy-accent/70" />
                      </td>
                      <td className="max-w-36 px-4 py-2">
                        {host.openPorts.length > 0 ? (
                          <span className="flex flex-wrap gap-1">
                            {host.openPorts.slice(0, 4).map((p) => (
                              <span
                                key={p}
                                title={`${p} · ${portServiceName(p)}`}
                                className="rounded bg-glassy-good/10 px-1.5 py-0.5 font-mono text-[10px] text-glassy-good"
                              >
                                {p}
                              </span>
                            ))}
                            {host.openPorts.length > 4 ? <span className="text-[10px] text-glassy-muted">+{host.openPorts.length - 4}</span> : null}
                          </span>
                        ) : (
                          <span className="text-glassy-muted/60">—</span>
                        )}
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
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {detailHost ? (
        <DeviceDetailsModal
          host={detailHost}
          profile={profiles.get(deviceKey(detailHost))}
          onUpdate={(patch) => onUpdateDevice(deviceKey(detailHost), patch)}
          onClose={() => setDetailKey(null)}
        />
      ) : null}
    </div>
  )
}
