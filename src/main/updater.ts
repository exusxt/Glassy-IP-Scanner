// Built-in updater backed by electron-updater + GitHub Releases. The app never
// downloads or installs anything without the user's consent: by default every
// available update shows a prompt and the user decides. Turning on "Automatic
// updates" in Settings makes it download silently and install on app quit.
//
// Installed (NSIS) builds use electron-updater. Portable builds cannot run the
// NSIS installer, so they drive their own flow: they resolve the latest version
// through the github.com web endpoint (no API rate limit), download the matching
// portable exe into the temp dir and, on install, swap it over the running exe
// via a hidden detached helper once this process exits.

import { app, BrowserWindow, ipcMain, net } from 'electron'
import { autoUpdater, type UpdateInfo } from 'electron-updater'
import { createWriteStream, existsSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import * as https from 'node:https'
import { join } from 'node:path'
import type { AppSettings, UpdateState } from '../shared/types'
import { appVersion } from './app-version'
import { getSettings, setSettings } from './settings'

let mainWindow: BrowserWindow | null = null
let state: UpdateState = {
  phase: 'idle',
  version: null,
  progress: 0,
  error: null,
  autoUpdate: getSettings().autoUpdate
}

/** True when running from the portable Windows exe (set by electron-builder). */
const IS_PORTABLE = process.platform === 'win32' && Boolean(process.env.PORTABLE_EXECUTABLE_FILE)

/** Release being fetched for a portable self-update. */
let portableTarget: { version: string; url: string } | null = null

function pushState(): void {
  mainWindow?.webContents.send('update:state', state)
}

function setPhase(phase: UpdateState['phase'], patch: Partial<UpdateState> = {}): void {
  state = { ...state, phase, ...patch }
  pushState()
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/** GitHub repo hosting the release feed (kept in sync with electron-builder.yml). */
const APP_REPO = 'exusxt/Glassy-IP-Scanner'

/**
 * Follows redirects and returns the final URL of a successful HEAD request, or
 * null when the target is not reachable. Used against the github.com web
 * endpoints, which are not subject to the API rate limit.
 */
function webHeadRedirect(url: string, redirectsLeft = 5): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'HEAD', headers: { 'User-Agent': 'Glassy-IP-Scanner' } }, (res) => {
      if (
        res.statusCode &&
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location &&
        redirectsLeft > 0
      ) {
        res.resume()
        const next = new URL(res.headers.location, url).toString()
        webHeadRedirect(next, redirectsLeft - 1).then(resolve, reject)
        return
      }
      res.resume()
      resolve(res.statusCode === 200 ? url : null)
    })
    req.on('error', reject)
    req.setTimeout(30000, () => req.destroy(new Error('Request timed out')))
    req.end()
  })
}

/**
 * Resolves the version tag behind a github.com /releases/latest redirect (e.g.
 * .../tag/v1.2.3). Unlike the API this web endpoint has no rate limit, and no
 * per-asset data is needed — just the tag.
 */
async function webLatestTag(ownerRepo: string): Promise<string | null> {
  const [owner, repo] = ownerRepo.split('/')
  const finalUrl = await webHeadRedirect(`https://github.com/${owner}/${repo}/releases/latest`)
  if (!finalUrl) return null
  const match = finalUrl.match(/\/releases\/tag\/([^/?#]+)$/)
  return match ? match[1] : null
}

function semverGt(a: string, b: string): boolean {
  const pa = a.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) {
    const da = pa[i] ?? 0
    const db = pb[i] ?? 0
    if (da !== db) return da > db
  }
  return false
}

async function checkPortable(): Promise<void> {
  setPhase('checking')
  try {
    // Resolve the latest tag through the github.com /releases/latest web
    // redirect instead of the GitHub API: the web endpoints have no
    // unauthenticated rate limit, so frequent checks never start failing on
    // shared IPs. (Electron's net.fetch does not expose the redirect target,
    // so the HEAD follow is done manually with node:https.)
    const tag = await webLatestTag(APP_REPO)
    if (!tag || !semverGt(tag, appVersion())) {
      setPhase('not-available')
      return
    }
    if (getSettings().skipUpdateVersion === tag) {
      setPhase('idle')
      return
    }
    // The portable artifact is now arch-specific (x64 and arm64 builds are
    // separate files), so pick the one matching the running process.
    const version = tag.replace(/^v/i, '')
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
    const name = `Glassy-IP-Scanner-${version}-${arch}.exe`
    const url = `https://github.com/${APP_REPO}/releases/latest/download/${name}`
    portableTarget = { version: tag, url }
    setPhase('available', { version: tag, progress: 0 })
    if (state.autoUpdate) {
      void downloadUpdate()
    }
  } catch (err) {
    setPhase('error', { error: errorMessage(err) })
  }
}

async function downloadPortable(): Promise<void> {
  if (!portableTarget) return
  setPhase('downloading', { version: portableTarget.version, progress: 0 })
  // The new exe is downloaded to the temp dir so the update works even when the
  // folder holding the running portable exe is not writable. It is moved over
  // the running exe only when the user confirms the install (installPortable).
  const finalPath = join(app.getPath('temp'), `glassy-update-${portableTarget.version}.exe`)
  const partPath = `${finalPath}.part`
  try {
    const res = await net.fetch(portableTarget.url)
    if (!res.ok || !res.body) throw new Error(`download failed (HTTP ${res.status})`)
    const total = Number(res.headers.get('content-length')) || 0
    let received = 0
    await new Promise<void>((resolve, reject) => {
      const file = createWriteStream(partPath)
      file.on('error', reject)
      file.on('finish', resolve)
      void (async () => {
        const reader = res.body!.getReader()
        try {
          for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            if (!file.write(value)) {
              await new Promise<void>((r) => file.once('drain', r))
            }
            received += value.length
            if (total) {
              setPhase('downloading', {
                version: portableTarget?.version ?? null,
                progress: Math.min(99, Math.round((received / total) * 100))
              })
            }
          }
          file.end()
        } catch (err) {
          file.destroy()
          reject(err)
        }
      })()
    })
    if (existsSync(finalPath)) rmSync(finalPath)
    renameSync(partPath, finalPath)
    setPhase('downloaded', { version: portableTarget.version, progress: 100 })
  } catch (err) {
    try {
      if (existsSync(partPath)) rmSync(partPath)
    } catch {
      // ignore cleanup failures
    }
    setPhase('error', { error: errorMessage(err) })
  }
}

function installPortable(): void {
  if (!portableTarget) return
  const exePath = process.env.PORTABLE_EXECUTABLE_FILE
  if (!exePath) return
  const src = join(app.getPath('temp'), `glassy-update-${portableTarget.version}.exe`)
  if (!existsSync(src)) return
  // The downloaded exe cannot overwrite the running one directly (it is locked).
  // Run a small detached batch file that retries the move until the app exits
  // and the file unlocks, then relaunches from the same path. windowsHide keeps
  // the swap silent so no console window flashes.
  const helper = join(app.getPath('temp'), `glassy-update-${process.pid}.bat`)
  const lines = [
    '@echo off',
    'set n=0',
    ':loop',
    'set /a n+=1',
    'if %n% gtr 60 goto relaunch',
    `move /y "${src}" "${exePath}" >nul 2>&1`,
    'if errorlevel 1 (',
    '  ping -n 2 127.0.0.1 >nul',
    '  goto loop',
    ')',
    ':relaunch',
    `start "" "${exePath}"`,
    `del /f /q "${helper}"`
  ]
  writeFileSync(helper, lines.join('\r\n'), 'utf8')
  spawn('cmd.exe', ['/c', helper], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
  app.exit(0)
}

async function checkForUpdates(): Promise<void> {
  if (!app.isPackaged) return
  if (IS_PORTABLE) {
    await checkPortable()
    return
  }
  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    setPhase('error', { error: errorMessage(err) })
  }
}

async function downloadUpdate(): Promise<void> {
  if (IS_PORTABLE) {
    await downloadPortable()
    return
  }
  try {
    await autoUpdater.downloadUpdate()
  } catch (err) {
    setPhase('error', { error: errorMessage(err) })
  }
}

/** Re-reads settings after a full-data backup restore so the updater honors them. */
export function syncUpdaterSettings(): void {
  state = { ...state, autoUpdate: getSettings().autoUpdate }
  pushState()
}

export function initUpdater(win: BrowserWindow): void {
  mainWindow = win

  ipcMain.handle('update:check', () => checkForUpdates())
  ipcMain.handle('update:download', () => downloadUpdate())
  ipcMain.handle('update:install', () => {
    if (IS_PORTABLE) {
      installPortable()
      return
    }
    autoUpdater.quitAndInstall(false, true)
  })
  ipcMain.handle('update:skip', (_e, version: string) => {
    setSettings({ skipUpdateVersion: version })
    setPhase('idle', { version: null })
  })
  ipcMain.handle('update:clearSkip', () => {
    setSettings({ skipUpdateVersion: null })
  })
  ipcMain.handle('update:state', () => state)
  ipcMain.handle('settings:get', (): AppSettings => getSettings())
  ipcMain.handle('settings:set', (_e, patch: Partial<AppSettings>): AppSettings => {
    const next = setSettings(patch)
    state = { ...state, autoUpdate: next.autoUpdate }
    pushState()
    return next
  })

  if (!app.isPackaged) return

  if (!IS_PORTABLE) {
    // Never download on its own: even in auto-update mode we call downloadUpdate()
    // explicitly below, so the user's choice is always honored.
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('checking-for-update', () => setPhase('checking'))
    autoUpdater.on('update-available', (info: UpdateInfo) => {
      if (getSettings().skipUpdateVersion === info.version) {
        setPhase('idle')
        return
      }
      setPhase('available', { version: info.version, progress: 0 })
      if (state.autoUpdate) {
        void downloadUpdate()
      }
    })
    autoUpdater.on('update-not-available', () => setPhase('not-available'))
    autoUpdater.on('download-progress', (p) => {
      setPhase('downloading', { progress: Math.round(p.percent) })
    })
    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      setPhase('downloaded', { version: info.version, progress: 100 })
    })
    autoUpdater.on('error', (err: Error) => {
      setPhase('error', { error: errorMessage(err) })
    })
  }

  // Check shortly after startup so the window is visible and the UI is ready.
  setTimeout(() => void checkForUpdates(), 4000)
}
