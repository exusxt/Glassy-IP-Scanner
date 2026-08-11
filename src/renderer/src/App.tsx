/**
 * Renderer entry component: the top-level app shell. Applies the active theme,
 * shows the gallery background for glass themes, owns the shared scan state
 * (hosts, progress, logs) subscribed from the main process, and routes between
 * the feature screens behind the frameless title bar and sidebar.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Shuffle } from 'lucide-react'
import type { AppSettings, DeviceProfile, DeviceProfiles, HostResult, KnownDevice, MonitorEvent, NetworkInterface, ScanEvent, ScanProgress, ScanStatus, ScanSummary } from '../../shared/types'
import { applyTheme, isGalleryTheme, THEMES, type ThemeId } from './lib'
import { BACKGROUNDS } from './backgrounds'
import { useUpdater } from './updater'
import { TitleBar } from './components/TitleBar'
import { Header } from './components/Header'
import { Sidebar, type ScreenId } from './components/Sidebar'
import { UpdateDialog } from './components/UpdateDialog'
import { Button } from './components/ui'
import { OverviewScreen } from './screens/OverviewScreen'
import { ScannerScreen } from './screens/ScannerScreen'
import { HistoryScreen } from './screens/HistoryScreen'
import { MapScreen } from './screens/MapScreen'
import { ConsoleScreen } from './screens/ConsoleScreen'
import { SettingsScreen } from './screens/SettingsScreen'

const THEME_KEY = 'glassy-ip-scanner-theme'

function loadTheme(): ThemeId {
  const saved = window.localStorage.getItem(THEME_KEY)
  return saved && saved in THEMES ? (saved as ThemeId) : 'gallery'
}

export interface ScanLogLine {
  id: number
  level: 'info' | 'warn' | 'error'
  message: string
}

let logIdCounter = 0

export default function App(): React.JSX.Element {
  const [theme, setTheme] = useState<ThemeId>(loadTheme)
  const [version, setVersion] = useState('')
  const [maximized, setMaximized] = useState(false)
  const [screen, setScreen] = useState<ScreenId>('overview')
  const [galleryBg, setGalleryBg] = useState<string | null>(null)
  const [initialTarget, setInitialTarget] = useState<string | null>(null)

  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [status, setStatus] = useState<ScanStatus>('idle')
  const [hosts, setHosts] = useState<HostResult[]>([])
  const [progress, setProgress] = useState<ScanProgress | null>(null)
  const [summary, setSummary] = useState<ScanSummary | null>(null)
  const [logs, setLogs] = useState<ScanLogLine[]>([])
  const [settings, setSettings] = useState<AppSettings>({ autoUpdate: false, skipUpdateVersion: null })
  const [devices, setDevices] = useState<DeviceProfiles>({})
  const [monitorEvents, setMonitorEvents] = useState<MonitorEvent[]>([])
  const [knownDevices, setKnownDevices] = useState<KnownDevice[]>([])
  const updater = useUpdater()
  const hostsRef = useRef<HostResult[]>([])

  const saveSettings = useCallback((patch: Partial<AppSettings>): void => {
    void window.api.setSettings(patch).then(setSettings).catch(() => undefined)
  }, [])

  const updateDevice = useCallback((key: string, patch: Partial<DeviceProfile>): void => {
    void window.api.setDeviceProfile(key, patch).then(setDevices).catch(() => undefined)
  }, [])

  const refreshInterfaces = useCallback(async (): Promise<void> => {
    setRefreshing(true)
    try {
      setInterfaces(await window.api.listInterfaces())
    } catch {
      setInterfaces([])
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void refreshInterfaces()
    window.api.getVersion().then(setVersion).catch(() => undefined)
    window.api.windowIsMaximized().then(setMaximized).catch(() => undefined)
    window.api.getSettings().then(setSettings).catch(() => undefined)
    window.api.scanState().then((s) => {
      setStatus(s.status)
      setHosts(s.hosts)
      setSummary(s.summary)
      hostsRef.current = s.hosts
    })
    window.api.getDevices().then(setDevices).catch(() => undefined)
    window.api.getMonitorEvents().then(setMonitorEvents).catch(() => undefined)
    window.api.getKnownDevices().then(setKnownDevices).catch(() => undefined)
    const offMax = window.api.onWindowMaximized(setMaximized)
    const offMonitor = window.api.onMonitorEvent((ev) => {
      setKnownDevices((prev) => {
        const next = prev.filter((d) => d.key !== ev.device.key)
        next.push(ev.device)
        return next
      })
      setMonitorEvents((prev) => (prev.some((e) => e.id === ev.id) ? prev : [...prev, ev]))
    })
    return () => {
      offMax()
      offMonitor()
    }
  }, [refreshInterfaces])

  useEffect(() => {
    applyTheme(theme)
    window.localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    if (!isGalleryTheme(theme)) {
      setGalleryBg(null)
      return
    }
    setGalleryBg(BACKGROUNDS.length > 0 ? BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)] : null)
  }, [theme])

  useEffect(() => {
    const off = window.api.onScanEvent((ev: ScanEvent) => {
      switch (ev.type) {
        case 'progress': {
          setProgress(ev.progress)
          break
        }
        case 'host': {
          hostsRef.current = [...hostsRef.current.filter((h) => h.ip !== ev.host.ip), ev.host]
          setHosts(hostsRef.current)
          break
        }
        case 'done': {
          setSummary(ev.summary)
          setStatus('finished')
          setProgress((p) => (p ? { ...p, done: ev.summary.total, online: ev.summary.online } : p))
          break
        }
        case 'log': {
          setLogs((prev) => [...prev.slice(-199), { id: ++logIdCounter, level: ev.level, message: ev.message }])
          break
        }
        case 'portProgress':
        case 'portDone':
          // Port-scan progress is tracked locally in the Scanner screen; the
          // 'host' events for updated open ports are handled above.
          break
      }
    })
    return off
  }, [])

  const shuffleBg = (): void => {
    setGalleryBg((prev) => {
      if (BACKGROUNDS.length === 0) return prev
      if (BACKGROUNDS.length === 1) return BACKGROUNDS[0]
      let next = prev
      while (next === prev) {
        next = BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)]
      }
      return next
    })
  }

  const scanning = status === 'running' || status === 'paused'

  const screenEl = useMemo(() => {
    switch (screen) {
      case 'overview':
        return (
          <OverviewScreen
            interfaces={interfaces}
            hosts={hosts}
            summary={summary}
            status={status}
            progress={progress}
            alerts={monitorEvents}
            knownDevices={knownDevices}
            onGoScan={(target) => {
              setInitialTarget(target ?? null)
              setScreen('scanner')
            }}
            onGoMap={() => setScreen('map')}
          />
        )
      case 'scanner':
        return (
          <ScannerScreen
            interfaces={interfaces}
            status={status}
            progress={progress}
            summary={summary}
            hosts={hosts}
            devices={devices}
            onUpdateDevice={updateDevice}
            initialTarget={initialTarget}
            onTargetConsumed={() => setInitialTarget(null)}
            onStatusChange={setStatus}
          />
        )
      case 'history':
        return <HistoryScreen devices={devices} />
      case 'map':
        return (
          <MapScreen
            hosts={hosts}
            devices={devices}
            onGoScan={(target) => {
              setInitialTarget(target ?? null)
              setScreen('scanner')
            }}
          />
        )
      case 'console':
        return <ConsoleScreen logs={logs} />
      case 'settings':
        return (
          <SettingsScreen
            version={version}
            autoUpdate={settings.autoUpdate}
            onAutoUpdateChange={(v) => saveSettings({ autoUpdate: v })}
            skipVersion={settings.skipUpdateVersion}
            onClearSkip={() => saveSettings({ skipUpdateVersion: null })}
            updateState={updater.state}
            onCheckNow={() => void updater.checkNow()}
          />
        )
    }
  }, [screen, interfaces, hosts, summary, status, progress, logs, version, settings, devices, monitorEvents, knownDevices, updateDevice, updater.state, updater.checkNow, saveSettings])

  return (
    <div className="relative flex h-screen flex-col overflow-hidden">
      {isGalleryTheme(theme) && galleryBg ? (
        <>
          <img src={galleryBg} alt="" className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-0 z-0" style={{ background: THEMES[theme].vars['--glassy-gallery-overlay'] }} />
        </>
      ) : null}

      <div className="relative z-40 shrink-0">
        <TitleBar
          version={version}
          theme={theme}
          maximized={maximized}
          onThemeChange={setTheme}
          onMinimize={() => void window.api.windowMinimize()}
          onToggleMaximize={() => void window.api.windowToggleMaximize().then(setMaximized)}
          onClose={() => void window.api.windowClose()}
        />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1">
        <Sidebar active={screen} onNavigate={setScreen} />

        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto px-6 pb-6 pt-5">
          <Header
            interfaceCount={interfaces.length}
            onlineCount={hosts.filter((h) => h.status === 'online').length}
            refreshing={refreshing}
            onRefresh={() => void refreshInterfaces()}
          />
          <main className="flex-1">{screenEl}</main>
          <footer className="mt-6 flex items-center justify-between border-t border-glassy-border pt-4">
            <div className="truncate text-[11px] text-glassy-muted">
              {scanning ? (
                <span className="text-glassy-accent">
                  {status === 'paused' ? 'Scan paused' : 'Scanning'} · {progress ? `${progress.done}/${progress.total} probed` : ''}
                </span>
              ) : summary ? (
                <span>
                  Last scan: <span className="font-mono text-glassy-text">{summary.target}</span> · {summary.online} device(s) in{' '}
                  {(summary.durationMs / 1000).toFixed(1)}s
                </span>
              ) : (
                'Ready — pick a network and start scanning'
              )}
            </div>
            <div className="flex items-center gap-2">
              {isGalleryTheme(theme) ? (
                <Button variant="outline" size="sm" onClick={shuffleBg} title="Shuffle background">
                  <Shuffle className="h-3.5 w-3.5" /> Shuffle
                </Button>
              ) : null}
            </div>
          </footer>
        </div>
      </div>

      <UpdateDialog
        state={updater.state}
        manual={updater.manualCheck}
        onDownload={() => void updater.download()}
        onLater={() => undefined}
        onSkip={(v) => void updater.skip(v)}
        onRestart={() => void updater.install()}
        onManualDone={updater.clearManualCheck}
      />
    </div>
  )
}
