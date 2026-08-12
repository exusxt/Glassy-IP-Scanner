/**
 * Settings screen: hosts the update preferences — an opt-in "Automatic
 * updates" toggle (off by default; every update asks first) plus a manual
 * check button and current update status — and a Backup & Restore area that
 * writes or reads a single JSON file holding every local store (app settings,
 * device profiles, map topology, the monitoring ledger and scan history).
 */
import { Archive, BookOpen, Github, RefreshCw, Settings2, Undo2, Upload } from 'lucide-react'
import type { UpdateState } from '../../../shared/types'
import { Badge, Button, Checkbox, Panel } from '../components/ui'

const WIKI_URL = 'https://github.com/exusxt/Glassy-IP-Scanner/wiki'
const HOMEPAGE_URL = 'https://github.com/exusxt/Glassy-IP-Scanner'

function statusLabel(state: UpdateState): { text: string; tone: 'default' | 'good' | 'warn' | 'accent' } | null {
  switch (state.phase) {
    case 'checking':
      return { text: 'Checking for updates…', tone: 'default' }
    case 'available':
      return { text: `Version ${state.version} available`, tone: 'accent' }
    case 'downloading':
      return { text: `Downloading ${state.version}… ${state.progress}%`, tone: 'accent' }
    case 'downloaded':
      return { text: `${state.version} downloaded — restart to install`, tone: 'good' }
    case 'not-available':
      return { text: "You're up to date", tone: 'good' }
    case 'error':
      return state.error ? { text: `Update check failed: ${state.error}`, tone: 'warn' } : { text: 'Update check failed', tone: 'warn' }
    default:
      return null
  }
}

export function SettingsScreen({
  version,
  autoUpdate,
  onAutoUpdateChange,
  skipVersion,
  onClearSkip,
  updateState,
  onCheckNow,
  onBackupAllData,
  onRestoreAllData
}: {
  version: string
  autoUpdate: boolean
  onAutoUpdateChange: (v: boolean) => void
  skipVersion: string | null
  onClearSkip: () => void
  updateState: UpdateState
  onCheckNow: () => void
  onBackupAllData: () => void
  onRestoreAllData: () => void
}): React.JSX.Element {
  const status = statusLabel(updateState)
  const busy = updateState.phase === 'checking' || updateState.phase === 'downloading'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Settings2 className="h-5 w-5 text-glassy-accent" />
        <h2 className="text-lg font-bold text-glassy-text">Settings</h2>
      </div>

      <Panel>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-glassy-text">Updates</h3>
            <p className="mt-0.5 text-xs text-glassy-muted">Built-in updater using the GitHub Releases feed.</p>
          </div>
          <Badge tone="accent">v{version}</Badge>
        </div>

        <div className="space-y-3">
          <Checkbox
            label="Automatic updates"
            hint="Automatically download new versions and install them when you quit. Off by default — updates will ask before doing anything."
            checked={autoUpdate}
            onChange={onAutoUpdateChange}
          />

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onCheckNow} disabled={busy}>
              <RefreshCw className={busy ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              Check for updates
            </Button>
            {status ? <Badge tone={status.tone}>{status.text}</Badge> : null}
          </div>

          {skipVersion ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-glassy-border bg-glassy-panel/60 p-3">
              <p className="text-xs text-glassy-muted">
                You skipped version <span className="font-mono text-glassy-text">{skipVersion}</span>. It won&apos;t be
                offered again until you allow it.
              </p>
              <Button variant="ghost" size="sm" onClick={onClearSkip}>
                <Undo2 className="h-3.5 w-3.5" /> Allow again
              </Button>
            </div>
          ) : null}
        </div>
      </Panel>

      <Panel>
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-glassy-text">Backup &amp; Restore</h3>
          <p className="mt-0.5 text-xs text-glassy-muted">
            Write all locally stored data to a single JSON file, or restore it on this machine — or any other.
          </p>
        </div>

        <div className="mb-3 flex flex-wrap gap-3">
          <Button variant="outline" onClick={onBackupAllData}>
            <Archive className="h-4 w-4" /> Back up all data
          </Button>
          <Button variant="outline" onClick={onRestoreAllData}>
            <Upload className="h-4 w-4" /> Restore from backup
          </Button>
        </div>

        <div className="rounded-xl border border-glassy-border bg-glassy-panel/60 p-3">
          <p className="text-[11px] text-glassy-muted">A backup includes:</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-[11px] text-glassy-muted">
            <li>App settings (automatic-update preference)</li>
            <li>Device profiles (custom names, notes, tags, favorites, type overrides)</li>
            <li>Map connections and cached SNMP switch tables</li>
            <li>Known-device ledger (first/last-seen history)</li>
            <li>Scan history</li>
          </ul>
        </div>
      </Panel>

      <Panel>
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-glassy-text">About &amp; documentation</h3>
          <p className="mt-0.5 text-xs text-glassy-muted">
            Guides, feature documentation and troubleshooting live in the project wiki.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => void window.api.openExternal(WIKI_URL)}>
            <BookOpen className="h-4 w-4" /> Open documentation wiki
          </Button>
          <Button variant="outline" onClick={() => void window.api.openExternal(HOMEPAGE_URL)}>
            <Github className="h-4 w-4" /> GitHub homepage
          </Button>
        </div>
      </Panel>
    </div>
  )
}
