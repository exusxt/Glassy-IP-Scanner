/**
 * The app's own version, resolved independently of Electron's app path lookup.
 *
 * electron-vite injects __APP_VERSION__ (from package.json) at build time, so
 * this stays correct in every launch mode. The fallback to app.getVersion()
 * covers tooling that loads the bundle without that define; app.getVersion()
 * returns Electron's own version when no package.json is found at the app path
 * (e.g. launching `electron out/main/index.js` directly), which we reject.
 */

import { app } from 'electron'

declare const __APP_VERSION__: string | undefined

export function appVersion(): string {
  const injected = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : ''
  if (injected) return injected
  const viaApp = app.getVersion()
  if (viaApp && viaApp !== process.versions.electron) return viaApp
  return ''
}
