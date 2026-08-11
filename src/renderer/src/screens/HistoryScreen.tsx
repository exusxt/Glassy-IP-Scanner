/**
 * Scan History screen (Phase 3): a persisted list of completed scans with
 * their summaries, plus a comparison tool that diffs any two entries and
 * reports added / removed / changed devices.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRightLeft, History, Plus, Trash2, X } from 'lucide-react'
import type { DeviceProfiles, HistoryDiff, HistoryDevice, HistoryEntry } from '../../../shared/types'
import { Badge, Button, Panel, Select, Spinner } from '../components/ui'
import { DeviceTypeIcon } from '../components/DeviceTypeIcon'
import { cn, formatDateTime } from '../lib'

function deviceName(device: HistoryDevice, profiles: DeviceProfiles): string {
  const profile = profiles[device.key]
  return profile?.customName?.trim() || device.hostname || device.vendor || device.ip
}

function DiffList({
  devices,
  profiles,
  empty
}: {
  devices: HistoryDevice[]
  profiles: DeviceProfiles
  empty: string
}): React.JSX.Element {
  if (devices.length === 0) {
    return <p className="px-4 py-3 text-xs text-glassy-muted">{empty}</p>
  }
  return (
    <ul className="divide-y divide-glassy-border">
      {devices.map((d) => (
        <li key={d.key} className="flex items-center justify-between gap-3 px-4 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <DeviceTypeIcon type={d.deviceType} className="text-glassy-accent/70" />
            <span className="truncate text-sm text-glassy-text">{deviceName(d, profiles)}</span>
            <span className="truncate font-mono text-[11px] text-glassy-muted">{d.ip}</span>
          </div>
          {d.mac ? <span className="shrink-0 font-mono text-[11px] text-glassy-muted">{d.mac}</span> : null}
        </li>
      ))}
    </ul>
  )
}

export function HistoryScreen({ devices }: { devices: DeviceProfiles }): React.JSX.Element {
  const [history, setHistory] = useState<HistoryEntry[] | null>(null)
  const [entryA, setEntryA] = useState<string>('')
  const [entryB, setEntryB] = useState<string>('')
  const [diff, setDiff] = useState<HistoryDiff | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)

  const loadHistory = useCallback(async (): Promise<void> => {
    try {
      setHistory(await window.api.getHistory())
    } catch {
      setHistory([])
    }
  }, [])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  const selectA = (id: string): void => {
    setEntryA(id)
    setDiff(null)
  }
  const selectB = (id: string): void => {
    setEntryB(id)
    setDiff(null)
  }

  const runDiff = async (): Promise<void> => {
    if (!entryA || !entryB || entryA === entryB) return
    setDiffLoading(true)
    try {
      setDiff(await window.api.diffScans(entryA, entryB))
    } finally {
      setDiffLoading(false)
    }
  }

  const clear = async (): Promise<void> => {
    await window.api.clearHistory()
    setEntryA('')
    setEntryB('')
    setDiff(null)
    await loadHistory()
  }

  const entries = history ?? []
  const a = entries.find((e) => e.id === entryA)
  const b = entries.find((e) => e.id === entryB)

  const compareDisabled = !entryA || !entryB || entryA === entryB
  const diffStats = useMemo(() => {
    if (!diff) return null
    return [
      { label: 'Added', value: diff.added.length, tone: 'accent' as const },
      { label: 'Removed', value: diff.removed.length, tone: 'bad' as const },
      { label: 'Changed', value: diff.changed.length, tone: 'warn' as const },
      { label: 'Unchanged', value: diff.unchanged, tone: 'good' as const }
    ]
  }, [diff])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-glassy-accent" />
          <h2 className="text-lg font-bold text-glassy-text">Scan History</h2>
          {history !== null ? <Badge tone="default">{history.length} scan(s)</Badge> : null}
        </div>
        {entries.length > 0 ? (
          <Button variant="danger" size="sm" onClick={() => void clear()}>
            <Trash2 className="h-3.5 w-3.5" /> Clear history
          </Button>
        ) : null}
      </div>

      {entries.length >= 2 ? (
        <Panel className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-glassy-muted">
            <ArrowRightLeft className="h-3.5 w-3.5" /> Compare scans
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-52 flex-1 flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-glassy-muted">From</span>
              <Select value={entryA} onChange={(e) => selectA(e.target.value)}>
                <option value="">— choose a scan —</option>
                {entries.map((e) => (
                  <option key={e.id} value={e.id}>{e.target} · {formatDateTime(e.finishedAt)}</option>
                ))}
              </Select>
            </label>
            <label className="flex min-w-52 flex-1 flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-glassy-muted">To</span>
              <Select value={entryB} onChange={(e) => selectB(e.target.value)}>
                <option value="">— choose a scan —</option>
                {entries.map((e) => (
                  <option key={e.id} value={e.id}>{e.target} · {formatDateTime(e.finishedAt)}</option>
                ))}
              </Select>
            </label>
            <Button variant="primary" size="sm" onClick={() => void runDiff()} disabled={compareDisabled || diffLoading}>
              {diffLoading ? <Spinner className="h-3.5 w-3.5" /> : <ArrowRightLeft className="h-3.5 w-3.5" />} Compare
            </Button>
          </div>

          {diff && diffStats && a && b ? (
            <div className="space-y-3 rounded-lg border border-glassy-border bg-glassy-panel2/40 p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-glassy-muted">
                  <span className="font-mono text-glassy-text">{a.target}</span> vs{' '}
                  <span className="font-mono text-glassy-text">{b.target}</span>
                </span>
                {diffStats.map((s) => (
                  <Badge key={s.label} tone={s.tone}>
                    {s.value} {s.label.toLowerCase()}
                  </Badge>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Panel className="p-0">
                  <div className="flex items-center gap-1.5 border-b border-glassy-border px-4 py-2 text-xs font-semibold uppercase tracking-wider text-glassy-accent">
                    <Plus className="h-3.5 w-3.5" /> New devices
                  </div>
                  <DiffList devices={diff.added} profiles={devices} empty="No new devices." />
                </Panel>
                <Panel className="p-0">
                  <div className="flex items-center gap-1.5 border-b border-glassy-border px-4 py-2 text-xs font-semibold uppercase tracking-wider text-glassy-bad">
                    <X className="h-3.5 w-3.5" /> Removed devices
                  </div>
                  <DiffList devices={diff.removed} profiles={devices} empty="No removed devices." />
                </Panel>
                <Panel className="p-0">
                  <div className="flex items-center gap-1.5 border-b border-glassy-border px-4 py-2 text-xs font-semibold uppercase tracking-wider text-glassy-warn">
                    <ArrowRightLeft className="h-3.5 w-3.5" /> Changed devices
                  </div>
                  {diff.changed.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-glassy-muted">No changed devices.</p>
                  ) : (
                    <ul className="divide-y divide-glassy-border">
                      {diff.changed.map((c) => (
                        <li key={c.key} className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <DeviceTypeIcon type={c.to.deviceType} className="text-glassy-accent/70" />
                            <span className="truncate text-sm text-glassy-text">{deviceName(c.to, devices)}</span>
                            <span className="truncate font-mono text-[11px] text-glassy-muted">{c.to.ip}</span>
                          </div>
                          <ul className="mt-1 space-y-0.5 pl-5 text-[11px] text-glassy-muted">
                            {c.changes.map((change) => (
                              <li key={change} className="list-disc">{change}</li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              </div>
            </div>
          ) : null}
        </Panel>
      ) : null}

      {history === null ? (
        <Panel className="flex items-center justify-center gap-2 py-8 text-sm text-glassy-muted">
          <Spinner className="h-4 w-4" /> Loading history…
        </Panel>
      ) : entries.length === 0 ? (
        <Panel className="text-sm text-glassy-muted">
          No scans recorded yet. Completed scans are saved here automatically so you can compare the network over time.
        </Panel>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <Panel key={entry.id} className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-glassy-text">{entry.target}</span>
                  <Badge tone={entry.online > 0 ? 'good' : 'default'}>{entry.online} online</Badge>
                </div>
                <div className="mt-0.5 text-xs text-glassy-muted">
                  {formatDateTime(entry.finishedAt)} · {entry.total} addresses · {(entry.durationMs / 1000).toFixed(1)}s · {entry.devices.length} device(s) recorded
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectA(entry.id)}
                  className={cn(entryA === entry.id && 'border-glassy-accent/60 text-glassy-accent')}
                >
                  Compare from
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectB(entry.id)}
                  className={cn(entryB === entry.id && 'border-glassy-accent/60 text-glassy-accent')}
                >
                  Compare to
                </Button>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  )
}
