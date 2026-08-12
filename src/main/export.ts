/**
 * Scan-results export. Takes the current HostResult[] from the renderer and
 * writes it to a user-chosen file in either CSV (a flat table, one row per
 * device) or JSON (the raw result objects plus metadata). Runs in the main
 * process so the save dialog and file write stay out of the renderer.
 */

import { dialog, type BrowserWindow } from 'electron'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { ExportFormat, ExportResult, HostResult } from '../shared/types'

const EXPORT_APP = 'Glassy IP Scanner'

/** Quotes a CSV cell when it contains a comma, quote or newline; "" escapes quotes. */
function escapeCsvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value)
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/** Serializes hosts to a CSV table with one row per device. */
function toCsv(hosts: HostResult[]): string {
  const header = [
    'ip',
    'status',
    'hostname',
    'mac',
    'vendor',
    'deviceType',
    'latencyMs',
    'via',
    'openPorts',
    'gateway',
    'firstSeen',
    'lastSeen'
  ]
  const lines = [header.map(escapeCsvCell).join(',')]
  for (const h of hosts) {
    lines.push(
      [
        escapeCsvCell(h.ip),
        escapeCsvCell(h.status),
        escapeCsvCell(h.hostname),
        escapeCsvCell(h.mac),
        escapeCsvCell(h.vendor),
        escapeCsvCell(h.deviceType),
        escapeCsvCell(h.latencyMs),
        escapeCsvCell((h.via ?? []).join(' ')),
        escapeCsvCell(h.openPorts.join(' ')),
        escapeCsvCell(h.isGateway ? 'yes' : 'no'),
        escapeCsvCell(h.firstSeen),
        escapeCsvCell(h.lastSeen)
      ].join(',')
    )
  }
  return lines.join('\r\n')
}

/**
 * Shows a save dialog and writes the scan results in the requested format.
 * `win` is the parent BrowserWindow so the dialog stays modal to the app.
 */
export async function exportScanResults(
  win: BrowserWindow | null,
  hosts: HostResult[],
  format: ExportFormat
): Promise<ExportResult> {
  const extension = format === 'csv' ? 'csv' : 'json'
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
  const options: Electron.SaveDialogOptions = {
    title: format === 'csv' ? 'Export scan results as CSV' : 'Export scan results as JSON',
    defaultPath: `glassy-scan-${stamp}.${extension}`,
    filters: [
      {
        name: format === 'csv' ? 'CSV spreadsheet' : 'JSON data',
        extensions: [extension]
      }
    ]
  }
  const res = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
  if (res.canceled || !res.filePath) return { ok: false, cancelled: true, path: null }

  let content: string
  if (format === 'csv') {
    content = toCsv(hosts)
  } else {
    content = JSON.stringify(
      {
        app: EXPORT_APP,
        exportedAt: new Date().toISOString(),
        count: hosts.length,
        hosts
      },
      null,
      2
    )
  }
  try {
    mkdirSync(dirname(res.filePath), { recursive: true })
    writeFileSync(res.filePath, content, 'utf8')
    return { ok: true, path: res.filePath, count: hosts.length }
  } catch (err) {
    return {
      ok: false,
      path: res.filePath,
      error: `Could not write the export: ${err instanceof Error ? err.message : String(err)}`
    }
  }
}
