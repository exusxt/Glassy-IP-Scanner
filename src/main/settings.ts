// Tiny JSON-backed settings store living in the app's userData directory.
// Loaded lazily and cached; every write is atomic-ish (write temp then rename).

import { app } from 'electron'
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { AppSettings } from '../shared/types'

const DEFAULTS: AppSettings = {
  autoUpdate: false,
  skipUpdateVersion: null
}

let cache: AppSettings | null = null

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export function getSettings(): AppSettings {
  if (cache) return cache
  try {
    const parsed = JSON.parse(readFileSync(settingsPath(), 'utf8')) as Partial<AppSettings>
    cache = { ...DEFAULTS, ...parsed }
  } catch {
    cache = { ...DEFAULTS }
  }
  return cache
}

export function setSettings(patch: Partial<AppSettings>): AppSettings {
  const next: AppSettings = { ...getSettings(), ...patch }
  try {
    const dir = dirname(settingsPath())
    mkdirSync(dir, { recursive: true })
    const tmp = `${settingsPath()}.tmp`
    writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8')
    renameSync(tmp, settingsPath())
  } catch {
    // Settings are best-effort; never crash the app over a write failure.
  }
  cache = next
  return next
}
