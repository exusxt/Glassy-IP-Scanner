/**
 * Console screen: a live, tailing log view of what the scanner is doing. Each
 * line carries a level (info/warn/error) rendered with a matching color, and
 * the view auto-scrolls to the newest entry. New scans start a fresh capture.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Terminal } from 'lucide-react'
import { cn } from '../lib'
import { Panel } from '../components/ui'
import type { ScanLogLine } from '../App'

type Filter = 'all' | 'info' | 'warn' | 'error'

const LEVEL_COLOR: Record<ScanLogLine['level'], string> = {
  info: 'text-glassy-text',
  warn: 'text-glassy-warn',
  error: 'text-glassy-danger'
}

export function ConsoleScreen({ logs }: { logs: ScanLogLine[] }): React.JSX.Element {
  const [filter, setFilter] = useState<Filter>('all')
  const scrollRef = useRef<HTMLDivElement>(null)

  const visible = useMemo(
    () => (filter === 'all' ? logs : logs.filter((l) => l.level === filter)),
    [logs, filter]
  )

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [visible.length])

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5 text-glassy-accent" />
          <h2 className="text-lg font-bold text-glassy-text">Scanner Console</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'info', 'warn', 'error'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider transition-colors',
                filter === f
                  ? 'border-glassy-accent/60 bg-glassy-accent/15 text-glassy-accent shadow-glow'
                  : 'border-glassy-borderlight bg-glassy-panel2/60 text-glassy-muted hover:text-glassy-text'
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <Panel className="flex min-h-0 flex-1 flex-col p-0">
        <div className="flex items-center justify-between border-b border-glassy-border px-4 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-glassy-muted">
            {visible.length} line(s)
          </span>
        </div>
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-3 font-mono text-xs leading-relaxed">
          {visible.length === 0 ? (
            <div className="flex h-full items-center justify-center text-glassy-muted/70">
              No log lines yet. Start a scan to watch the probe activity here.
            </div>
          ) : (
            <ul className="space-y-0.5">
              {visible.map((line) => (
                <li key={line.id} className="flex gap-2 whitespace-pre-wrap break-all">
                  <span className={cn('w-12 shrink-0 uppercase', LEVEL_COLOR[line.level])}>
                    {line.level}
                  </span>
                  <span className="text-glassy-muted">{line.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>
    </div>
  )
}
