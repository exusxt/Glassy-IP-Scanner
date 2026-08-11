// Tiny JSON-backed device profile store (Phase 2) living in the app's
// userData directory, keyed by the normalized MAC address. Same pattern as the
// settings store: lazy-loaded, cached, written atomically (tmp + rename).

import { app } from 'electron'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { DeviceProfile, DeviceProfiles } from '../shared/types'

const DEFAULTS: DeviceProfile = {
  customName: null,
  notes: null,
  tags: [],
  favorite: false
}

let cache: DeviceProfiles | null = null

function devicesPath(): string {
  return join(app.getPath('userData'), 'devices.json')
}

export function getDevices(): DeviceProfiles {
  if (cache) return cache
  try {
    const parsed = JSON.parse(readFileSync(devicesPath(), 'utf8')) as Partial<DeviceProfiles>
    cache = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (value && typeof value === 'object') {
        cache[key] = { ...DEFAULTS, ...(value as Partial<DeviceProfile>) }
      }
    }
  } catch {
    cache = {}
  }
  return cache
}

export function setDeviceProfile(key: string, patch: Partial<DeviceProfile>): DeviceProfiles {
  const next = getDevices()
  next[key] = { ...(next[key] ?? { ...DEFAULTS }), ...patch }
  try {
    const dir = dirname(devicesPath())
    mkdirSync(dir, { recursive: true })
    const tmp = `${devicesPath()}.tmp`
    writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8')
    renameSync(tmp, devicesPath())
  } catch {
    // Profiles are best-effort; never crash the app over a write failure.
  }
  cache = next
  return next
}
