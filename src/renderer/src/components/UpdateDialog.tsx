/**
 * Update UI: a glass modal for the actionable states (available / downloading /
 * downloaded) and a small auto-expiring toast for check results. The user is
 * always in control — nothing is downloaded or installed without a button press
 * unless they turned on automatic updates.
 */
import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Download, RotateCw, X } from 'lucide-react'
import type { UpdateState } from '../../../shared/types'
import { cn } from '../lib'
import { Button, ProgressBar } from './ui'

export function UpdateDialog({
  state,
  manual,
  onDownload,
  onLater,
  onSkip,
  onRestart,
  onManualDone
}: {
  state: UpdateState
  manual: boolean
  onDownload: () => void
  onLater: () => void
  onSkip: (version: string) => void
  onRestart: () => void
  onManualDone: () => void
}): React.JSX.Element | null {
  const [dismissed, setDismissed] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Re-surface the modal whenever the updater moves to a new phase/version.
  useEffect(() => {
    setDismissed(false)
  }, [state.phase, state.version])

  // Feedback for manual checks: you're up to date, or the check failed.
  useEffect(() => {
    if (state.phase === 'not-available' && manual) {
      setToast("You're up to date")
      onManualDone()
    } else if (state.phase === 'error' && manual) {
      setToast(`Update check failed: ${state.error ?? 'unknown error'}`)
      onManualDone()
    }
  }, [state.phase, state.error, manual, onManualDone])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(t)
  }, [toast])

  const open = !dismissed && (state.phase === 'available' || state.phase === 'downloading' || state.phase === 'downloaded')

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Dismiss"
            className="absolute inset-0 cursor-default bg-black/45 backdrop-blur-sm"
            onClick={onLater}
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-glassy-border bg-glassy-panel/90 p-5 shadow-2xl shadow-black/60 backdrop-blur-xl">
            {state.phase === 'available' ? (
              <>
                <div className="mb-3 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-glassy-accent/15 text-glassy-accent">
                    <Download className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold text-glassy-text">Update available</h2>
                    <p className="text-xs text-glassy-muted">Version {state.version} is ready to download</p>
                  </div>
                </div>
                <p className="mb-4 text-sm leading-relaxed text-glassy-muted">
                  What would you like to do? Download it now, later, or skip this version entirely.
                </p>
                <div className="flex flex-col gap-2">
                  <Button variant="primary" onClick={onDownload}>
                    <Download className="h-4 w-4" /> Download update
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="default" className="flex-1" onClick={onLater}>
                      Later
                    </Button>
                    <Button
                      variant="ghost"
                      className="flex-1"
                      onClick={() => onSkip(state.version ?? '')}
                    >
                      Skip this version
                    </Button>
                  </div>
                </div>
              </>
            ) : null}

            {state.phase === 'downloading' ? (
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-glassy-accent/15 text-glassy-accent">
                  <Download className="h-5 w-5" />
                </span>
                <div className="flex-1">
                  <h2 className="text-base font-semibold text-glassy-text">Downloading {state.version}…</h2>
                  <div className="mt-2">
                    <ProgressBar value={state.progress} max={100} />
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={onLater} aria-label="Hide">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : null}

            {state.phase === 'downloaded' ? (
              <>
                <div className="mb-3 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-glassy-good/15 text-glassy-good">
                    <CheckCircle2 className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold text-glassy-text">Update ready</h2>
                    <p className="text-xs text-glassy-muted">Version {state.version} has been downloaded</p>
                  </div>
                </div>
                <p className="mb-4 text-sm leading-relaxed text-glassy-muted">
                  Restart now to finish installing, or keep it for when you quit the app.
                </p>
                <div className="flex gap-2">
                  <Button variant="primary" className="flex-1" onClick={onRestart}>
                    <RotateCw className="h-4 w-4" /> Restart now
                  </Button>
                  <Button variant="default" className="flex-1" onClick={onLater}>
                    Later
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-6 right-6 z-[70] flex max-w-xs items-start gap-3 rounded-xl border border-glassy-border bg-glassy-panel/95 p-4 shadow-2xl shadow-black/60 backdrop-blur-xl">
          {state.phase === 'error' ? (
            <AlertCircle className="h-4 w-4 shrink-0 text-glassy-warn" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-glassy-good" />
          )}
          <p
            className={cn(
              'min-w-0 text-sm',
              state.phase === 'error' ? 'text-glassy-warn' : 'text-glassy-text'
            )}
          >
            {toast}
          </p>
        </div>
      ) : null}
    </>
  )
}
