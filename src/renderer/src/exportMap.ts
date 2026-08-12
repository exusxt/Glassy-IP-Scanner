/**
 * Self-contained SVG generator for exporting the Network Map as an image. The
 * SVG is built as a plain string with inline colors and fonts (no Tailwind
 * classes, no CSS variables) so it rasterizes reliably off-screen — either to
 * a .svg file directly or to a PNG canvas at a chosen pixel size. Kept free of
 * React so it can be unit-tested in isolation.
 */
import { DEVICE_TYPE_COLORS } from './lib'
import { ROOT, type MapLayout } from './mapLayout'

const NODE_RADIUS = 17
const HUB_RADIUS = 20
const CENTER_RADIUS = 24

const TEXT_COLOR = '#e2e8f0'
const MUTED_COLOR = '#8b98b8'
const BG_COLOR = '#0b1020'
const FONT = 'Segoe UI, Arial, sans-serif'
const MONO_FONT = 'Consolas, Courier New, monospace'

export const EXPORT_SIZES = [1024, 2048, 4096] as const
export type ExportSize = (typeof EXPORT_SIZES)[number]

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

const round = (n: number): number => Math.round(n * 10) / 10

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Builds the map as a standalone SVG string. The layout viewBox is a centered
 * square around the origin, so the output is `size`×`size` pixels; the SVG
 * coordinate system is fully self-contained and scales losslessly.
 */
export function buildMapSvg(layout: MapLayout, nameOf: (ip: string) => string, size: number): string {
  const { center, nodes, edges, maxR } = layout
  const side = maxR * 2
  const nodeByIp = new Map(nodes.map((n) => [n.host.ip, n]))

  const edgeLines = edges
    .map((e) => {
      const from = e.from === ROOT ? null : nodeByIp.get(e.from)
      const to = nodeByIp.get(e.to)
      if (!to) return ''
      const hub = from?.hub === true || to.hub
      return `<line x1="${round(from?.x ?? 0)}" y1="${round(from?.y ?? 0)}" x2="${round(to.x)}" y2="${round(to.y)}" stroke="${hub ? 'rgba(20,184,166,0.4)' : 'rgba(148,163,184,0.35)'}" stroke-width="1.5" />`
    })
    .filter(Boolean)
    .join('\n  ')

  const nodeGroups = nodes
    .map((n) => {
      const offline = n.host.status === 'offline'
      const color = DEVICE_TYPE_COLORS[n.host.deviceType]
      const radius = n.hub ? HUB_RADIUS : NODE_RADIUS
      const name = escapeXml(truncate(nameOf(n.host.ip), n.hub ? 14 : 16))
      const fontSize = n.hub ? 14 : 13
      const labelY = radius + (n.hub ? 24 : 17)
      let s = `  <g transform="translate(${round(n.x)} ${round(n.y)})">\n`
      s += offline
        ? `    <circle r="${radius}" fill="rgba(148,163,184,0.06)" stroke="rgba(148,163,184,0.55)" stroke-width="${n.hub ? 2 : 1.5}" stroke-dasharray="3 3" />\n`
        : `    <circle r="${radius}" fill="${color}${n.hub ? '2e' : '33'}" stroke="${color}" stroke-width="${n.hub ? 2 : 1.5}" />\n`
      s += `    <text y="${labelY}" text-anchor="middle" font-size="${fontSize}" font-weight="${n.hub ? 600 : 400}" fill="${TEXT_COLOR}" font-family="${FONT}" opacity="${n.hub ? 1 : 0.55}">${name}</text>\n`
      s += `    <text y="${radius + (n.hub ? 40 : 32)}" text-anchor="middle" font-size="11" fill="${MUTED_COLOR}" font-family="${MONO_FONT}" opacity="0.55">${n.host.ip}</text>\n`
      if (offline) {
        s += `    <text y="${radius + (n.hub ? 55 : 44)}" text-anchor="middle" font-size="8" fill="#fbbf24" font-family="${FONT}">offline</text>\n`
      } else if (n.hub) {
        const sub = n.snmpOk ? `SNMP · ${n.snmpCount} macs` : 'manual only'
        s += `    <text y="${radius + 55}" text-anchor="middle" font-size="10" fill="${n.snmpOk ? '#34d399' : '#fbbf24'}" font-family="${FONT}">${escapeXml(sub)}</text>\n`
      }
      s += '  </g>'
      return s
    })
    .join('\n')

  let centerGroup = ''
  if (center) {
    const label = escapeXml(truncate(nameOf(center.ip), 16))
    centerGroup = `  <g>
    <circle r="${CENTER_RADIUS}" fill="#f59e0b2e" stroke="#f59e0b" stroke-width="2" />
    <text y="${CENTER_RADIUS + 20}" text-anchor="middle" font-size="14" font-weight="600" fill="${TEXT_COLOR}" font-family="${FONT}">${label}</text>
    <text y="${CENTER_RADIUS + 34}" text-anchor="middle" font-size="11" fill="${MUTED_COLOR}" font-family="${MONO_FONT}">${escapeXml(center.ip)}</text>
  </g>`
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${-maxR} ${-maxR} ${side} ${side}">`,
    `  <rect x="${-maxR}" y="${-maxR}" width="${side}" height="${side}" fill="${BG_COLOR}" />`,
    edgeLines,
    nodeGroups,
    centerGroup,
    '</svg>'
  ].join('\n')
}

/** Rasterizes an SVG string to a PNG blob at the given pixel size. */
export async function svgToPng(svg: string, size: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Failed to render the map image'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas is unavailable')
    ctx.drawImage(img, 0, 0, size, size)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to encode the PNG'))), 'image/png')
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Triggers a download for a blob with a suggested filename. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** True when the layout has anything worth exporting. */
export function hasMapContent(layout: MapLayout): boolean {
  return layout.center !== null || layout.nodes.length > 0
}
