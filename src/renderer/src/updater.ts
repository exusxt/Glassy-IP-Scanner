// Renderer-side updater state: subscribes to the main-process update:state
// channel and exposes actions for the UI (check, download, install, skip).

import { useCallback, useEffect, useState } from 'react'
import type { UpdateState } from '../../shared/types'

export interface Updater {
  state: UpdateState
  /** True right after the user manually asked to check for updates. */
  manualCheck: boolean
  checkNow: () => Promise<void>
  download: () => Promise<void>
  install: () => Promise<void>
  skip: (version: string) => Promise<void>
  clearManualCheck: () => void
}

const IDLE: UpdateState = { phase: 'idle', version: null, progress: 0, error: null, autoUpdate: false }

export function useUpdater(): Updater {
  const [state, setState] = useState<UpdateState>(IDLE)
  const [manualCheck, setManualCheck] = useState(false)

  useEffect(() => {
    void window.api.getUpdateState().then(setState).catch(() => undefined)
    return window.api.onUpdateState(setState)
  }, [])

  const checkNow = useCallback(async (): Promise<void> => {
    setManualCheck(true)
    try {
      await window.api.checkForUpdates()
    } catch {
      // The main process reports failures through the state channel.
    }
  }, [])

  const download = useCallback(async (): Promise<void> => {
    await window.api.downloadUpdate()
  }, [])

  const install = useCallback(async (): Promise<void> => {
    await window.api.installUpdate()
  }, [])

  const skip = useCallback(async (version: string): Promise<void> => {
    await window.api.skipUpdate(version)
  }, [])

  const clearManualCheck = useCallback((): void => setManualCheck(false), [])

  return { state, manualCheck, checkNow, download, install, skip, clearManualCheck }
}
