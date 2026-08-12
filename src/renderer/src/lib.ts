/**
 * Renderer-side UI utilities: the theme registry (including the Gallery Glass
 * family that is the default), background handling and formatting helpers.
 */

import type { DeviceTypeId } from '../../shared/types'

/** Normalizes a MAC to uppercase, separator-free form (aa:bb:… → AABBCCDDEEFF). */
export function normalizeMac(mac: string): string {
  return mac.replace(/[^0-9a-fA-F]/g, '').toUpperCase()
}

/**
 * Stable identity for a host in topology bindings: the normalized MAC when
 * known, otherwise the IP (same convention as device profiles).
 */
export function deviceKey(mac: string | null, ip: string): string {
  return mac ? normalizeMac(mac) : ip
}

/** Human-readable labels for each device type classification. */
export const DEVICE_TYPE_META: Record<DeviceTypeId, { label: string }> = {
  router: { label: 'Router' },
  switch: { label: 'Switch' },
  printer: { label: 'Printer' },
  nas: { label: 'NAS' },
  camera: { label: 'Camera' },
  tv: { label: 'TV' },
  speaker: { label: 'Speaker' },
  phone: { label: 'Phone' },
  tablet: { label: 'Tablet' },
  laptop: { label: 'Laptop' },
  computer: { label: 'Computer' },
  console: { label: 'Console' },
  rpi: { label: 'Raspberry Pi' },
  server: { label: 'Server' },
  'smart-device': { label: 'Smart device' },
  unknown: { label: 'Unknown' }
}

/** Well-known TCP ports -> service names for the port scanner results. */
export const PORT_SERVICES: Record<number, string> = {
  20: 'FTP data',
  21: 'FTP',
  22: 'SSH',
  23: 'Telnet',
  25: 'SMTP',
  53: 'DNS',
  67: 'DHCP',
  68: 'DHCP',
  69: 'TFTP',
  80: 'HTTP',
  81: 'HTTP',
  88: 'Kerberos',
  110: 'POP3',
  111: 'RPC',
  123: 'NTP',
  135: 'RPC',
  137: 'NetBIOS',
  138: 'NetBIOS',
  139: 'NetBIOS',
  143: 'IMAP',
  161: 'SNMP',
  162: 'SNMP',
  179: 'BGP',
  194: 'IRC',
  389: 'LDAP',
  443: 'HTTPS',
  445: 'SMB',
  465: 'SMTPS',
  500: 'IPsec',
  514: 'Syslog',
  515: 'LPR',
  548: 'AFP',
  554: 'RTSP',
  587: 'SMTP',
  631: 'IPP',
  636: 'LDAPS',
  873: 'rsync',
  993: 'IMAPS',
  995: 'POP3S',
  1025: 'NFS',
  1080: 'SOCKS',
  1433: 'MSSQL',
  1521: 'Oracle DB',
  1723: 'PPTP',
  1812: 'RADIUS',
  1883: 'MQTT',
  1900: 'SSDP',
  1935: 'RTMP',
  2049: 'NFS',
  2181: 'ZooKeeper',
  2222: 'SSH alt',
  2375: 'Docker',
  2376: 'Docker TLS',
  2480: 'OrientDB',
  3000: 'Web app',
  3001: 'Web app',
  3128: 'HTTP proxy',
  3306: 'MySQL',
  3389: 'RDP',
  3690: 'SVN',
  3724: 'WoW',
  4000: 'Web app',
  4333: 'mSQL',
  4443: 'HTTPS alt',
  5000: 'UPnP',
  5001: 'UPnP',
  5050: 'Web app',
  5060: 'SIP',
  5353: 'mDNS',
  5432: 'PostgreSQL',
  5601: 'Kibana',
  5666: 'NRPE',
  5672: 'AMQP',
  5900: 'VNC',
  5901: 'VNC',
  5984: 'CouchDB',
  5985: 'WinRM',
  6000: 'X11',
  6379: 'Redis',
  6443: 'Kubernetes API',
  6667: 'IRC',
  7001: 'WebLogic',
  7443: 'HTTPS alt',
  7777: 'Game server',
  8000: 'HTTP alt',
  8005: 'Tomcat',
  8006: 'Plex',
  8008: 'HTTP',
  8009: 'AJP',
  8010: 'HTTP',
  8080: 'HTTP alt',
  8081: 'HTTP alt',
  8082: 'HTTP alt',
  8083: 'HTTP alt',
  8086: 'InfluxDB',
  8088: 'HTTP',
  8089: 'Splunk',
  8090: 'HTTP',
  8161: 'ActiveMQ',
  8181: 'HTTP',
  8443: 'HTTPS alt',
  8500: 'Consul',
  8883: 'MQTT TLS',
  8888: 'HTTP alt',
  9000: 'Web app',
  9001: 'Web app',
  9042: 'Cassandra',
  9090: 'Prometheus',
  9092: 'Kafka',
  9200: 'Elasticsearch',
  9300: 'Elasticsearch',
  9443: 'HTTPS alt',
  10000: 'Webmin',
  10250: 'Kubelet',
  11211: 'Memcached',
  11434: 'Ollama',
  15672: 'RabbitMQ',
  25565: 'Minecraft',
  27000: 'Steam',
  27015: 'Source server',
  27016: 'Source server',
  27017: 'MongoDB',
  30000: 'Game server',
  3074: 'Xbox Live',
  32400: 'Plex',
  32469: 'Plex'
}

/** Friendly service name for a TCP port, or "unknown". */
export function portServiceName(port: number): string {
  return PORT_SERVICES[port] ?? 'unknown'
}

/** Accent color per device type, used by the network map and dashboard. */
export const DEVICE_TYPE_COLORS: Record<DeviceTypeId, string> = {
  router: '#f59e0b',
  switch: '#14b8a6',
  printer: '#8b5cf6',
  nas: '#06b6d4',
  camera: '#f472b6',
  tv: '#fb7185',
  speaker: '#a3e635',
  phone: '#60a5fa',
  tablet: '#38bdf8',
  laptop: '#6366f1',
  computer: '#818cf8',
  console: '#e879f9',
  rpi: '#34d399',
  server: '#f97316',
  'smart-device': '#94a3b8',
  unknown: '#64748b'
}

/** Renders an ISO timestamp as a short, human-friendly "x ago" string. */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return '—'
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (seconds < 60) return seconds <= 1 ? 'just now' : `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

/** Formats an ISO timestamp as "12 Aug 2026, 14:05" (locale-aware). */
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/** CSS custom properties (--glassy-*) a theme defines; applied via applyTheme. */
export type ThemeVars = Record<string, string>

/** The selectable theme ids, grouped: Gallery Glass family first, then solid. */
export type ThemeId =
  | 'gallery'
  | 'galleryblack'
  | 'gallerygreen'
  | 'galleryblue'
  | 'galleryred'
  | 'galleryorange'
  | 'gallerypurple'
  | 'midnight'
  | 'ocean'
  | 'forest'
  | 'sunset'
  | 'royal'
  | 'candy'
  | 'paper'

export const THEME_IDS: ThemeId[] = [
  'gallery',
  'galleryblack',
  'gallerygreen',
  'galleryblue',
  'galleryred',
  'galleryorange',
  'gallerypurple',
  'midnight',
  'ocean',
  'forest',
  'sunset',
  'royal',
  'candy',
  'paper'
]

export const THEME_NAMES: Record<ThemeId, string> = {
  gallery: 'Gallery Glass',
  galleryblack: 'Gallery Black Glass',
  gallerygreen: 'Gallery Green Glass',
  galleryblue: 'Gallery Blue Glass',
  galleryred: 'Gallery Red Glass',
  galleryorange: 'Gallery Orange Glass',
  gallerypurple: 'Gallery Purple Glass',
  midnight: 'Midnight',
  ocean: 'Ocean',
  forest: 'Forest',
  sunset: 'Sunset',
  royal: 'Royal',
  candy: 'Candy',
  paper: 'Paper'
}

/** Formats a byte count into a human-readable unit string (B..PB). */
export function formatBytes(bytes: number | null | undefined, decimals = 1): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let value = bytes
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(i === 0 ? 0 : decimals)} ${units[i]}`
}

type GalleryVariant = {
  panel: string
  panel2: string
  deep: string
  border: string
  borderlight: string
  accent: string
  accent2: string
  good: string
  warn: string
  bad: string
  muted: string
  text: string
  glow: string
  overlay: string
}

/**
 * Builds the full CSS variable set for a Gallery (photo-background) variant:
 * panels stay translucent so the background image shows through.
 */
function glassVars(v: GalleryVariant): ThemeVars {
  return {
    '--glassy-bg': '#0b1020',
    '--glassy-panel': v.panel,
    '--glassy-panel2': v.panel2,
    '--glassy-deep': v.deep,
    '--glassy-border': v.border,
    '--glassy-borderlight': v.borderlight,
    '--glassy-accent': v.accent,
    '--glassy-accent2': v.accent2,
    '--glassy-good': v.good,
    '--glassy-warn': v.warn,
    '--glassy-bad': v.bad,
    '--glassy-muted': v.muted,
    '--glassy-text': v.text,
    '--glassy-glow': v.glow,
    '--glassy-gallery-overlay': v.overlay
  }
}

// Color variants for the Gallery Glass family, listed first in THEMES because
// "gallery" is the default theme on fresh installs.
const GALLERY_VARIANTS: Record<string, GalleryVariant> = {
  gallery: {
    panel: 'rgba(17, 26, 48, 0.68)',
    panel2: 'rgba(14, 21, 38, 0.60)',
    deep: '#070b16',
    border: '#223052',
    borderlight: '#2e3f6b',
    accent: '#38bdf8',
    accent2: '#a78bfa',
    good: '#34d399',
    warn: '#fbbf24',
    bad: '#f87171',
    muted: '#8b98b8',
    text: '#e2e8f0',
    glow: '0 0 24px rgba(56, 189, 248, 0.25)',
    overlay: 'rgba(7, 11, 22, 0.55)'
  },
  galleryblack: {
    panel: 'rgba(8, 10, 17, 0.74)',
    panel2: 'rgba(5, 7, 12, 0.66)',
    deep: '#05070d',
    border: '#1b2338',
    borderlight: '#2b3a55',
    accent: '#cbd5e1',
    accent2: '#94a3b8',
    good: '#34d399',
    warn: '#fbbf24',
    bad: '#f87171',
    muted: '#8b98b8',
    text: '#e2e8f0',
    glow: '0 0 24px rgba(203, 213, 225, 0.22)',
    overlay: 'rgba(0, 0, 0, 0.62)'
  },
  gallerygreen: {
    panel: 'rgba(12, 30, 22, 0.68)',
    panel2: 'rgba(9, 24, 17, 0.60)',
    deep: '#04120c',
    border: '#1e3b2f',
    borderlight: '#2c5847',
    accent: '#34d399',
    accent2: '#a3e635',
    good: '#6ee7b7',
    warn: '#fbbf24',
    bad: '#f87171',
    muted: '#87a89a',
    text: '#e7f5ee',
    glow: '0 0 24px rgba(52, 211, 153, 0.25)',
    overlay: 'rgba(5, 18, 11, 0.50)'
  },
  galleryblue: {
    panel: 'rgba(13, 24, 46, 0.68)',
    panel2: 'rgba(10, 19, 37, 0.60)',
    deep: '#04070d',
    border: '#1e3452',
    borderlight: '#2b4c7a',
    accent: '#60a5fa',
    accent2: '#22d3ee',
    good: '#34d399',
    warn: '#fbbf24',
    bad: '#fb7185',
    muted: '#8aa4c8',
    text: '#e0f2fe',
    glow: '0 0 24px rgba(96, 165, 250, 0.25)',
    overlay: 'rgba(5, 10, 24, 0.50)'
  },
  galleryred: {
    panel: 'rgba(38, 16, 20, 0.68)',
    panel2: 'rgba(30, 12, 15, 0.60)',
    deep: '#170506',
    border: '#47222a',
    borderlight: '#66313b',
    accent: '#fb7185',
    accent2: '#fbbf24',
    good: '#34d399',
    warn: '#facc15',
    bad: '#fb7185',
    muted: '#d39aa3',
    text: '#fde8ea',
    glow: '0 0 24px rgba(251, 113, 133, 0.25)',
    overlay: 'rgba(24, 5, 8, 0.50)'
  },
  galleryorange: {
    panel: 'rgba(40, 24, 12, 0.68)',
    panel2: 'rgba(32, 18, 9, 0.60)',
    deep: '#180b03',
    border: '#4a3017',
    borderlight: '#6b4520',
    accent: '#fb923c',
    accent2: '#fbbf24',
    good: '#34d399',
    warn: '#fbbf24',
    bad: '#f87171',
    muted: '#d3ad92',
    text: '#fdf0e3',
    glow: '0 0 24px rgba(251, 146, 60, 0.25)',
    overlay: 'rgba(26, 11, 3, 0.50)'
  },
  gallerypurple: {
    panel: 'rgba(30, 18, 48, 0.68)',
    panel2: 'rgba(24, 14, 38, 0.60)',
    deep: '#0f0718',
    border: '#3a2a55',
    borderlight: '#553d78',
    accent: '#a78bfa',
    accent2: '#f472b6',
    good: '#34d399',
    warn: '#fbbf24',
    bad: '#f87171',
    muted: '#b5a6d8',
    text: '#f3ecfc',
    glow: '0 0 24px rgba(167, 139, 250, 0.25)',
    overlay: 'rgba(14, 5, 24, 0.50)'
  }
}

/** True for the Gallery Glass family (ids starting with "gallery"). */
export function isGalleryTheme(id: ThemeId): boolean {
  return id.startsWith('gallery')
}

// All selectable themes. The Gallery Glass family is grouped first and is the
// default on fresh installs.
export const THEMES: Record<ThemeId, { name: string; vars: ThemeVars }> = {
  midnight: {
    name: 'Midnight',
    vars: {
      '--glassy-bg': '#0b1020',
      '--glassy-panel': '#111a30',
      '--glassy-panel2': '#0e1526',
      '--glassy-deep': '#070b16',
      '--glassy-border': '#223052',
      '--glassy-borderlight': '#2e3f6b',
      '--glassy-accent': '#38bdf8',
      '--glassy-accent2': '#a78bfa',
      '--glassy-good': '#34d399',
      '--glassy-warn': '#fbbf24',
      '--glassy-bad': '#f87171',
      '--glassy-muted': '#8b98b8',
      '--glassy-text': '#e2e8f0',
      '--glassy-glow': '0 0 24px rgba(56, 189, 248, 0.25)'
    }
  },
  ocean: {
    name: 'Ocean',
    vars: {
      '--glassy-bg': '#04141f',
      '--glassy-panel': '#082b3d',
      '--glassy-panel2': '#06212f',
      '--glassy-deep': '#020d14',
      '--glassy-border': '#0e3d56',
      '--glassy-borderlight': '#17567a',
      '--glassy-accent': '#22d3ee',
      '--glassy-accent2': '#60a5fa',
      '--glassy-good': '#34d399',
      '--glassy-warn': '#facc15',
      '--glassy-bad': '#fb7185',
      '--glassy-muted': '#7aa2bb',
      '--glassy-text': '#e0f2fe',
      '--glassy-glow': '0 0 24px rgba(34, 211, 238, 0.25)'
    }
  },
  forest: {
    name: 'Forest',
    vars: {
      '--glassy-bg': '#0c1512',
      '--glassy-panel': '#14241d',
      '--glassy-panel2': '#0f1d17',
      '--glassy-deep': '#070d0a',
      '--glassy-border': '#1e3b2f',
      '--glassy-borderlight': '#2c5847',
      '--glassy-accent': '#34d399',
      '--glassy-accent2': '#a3e635',
      '--glassy-good': '#4ade80',
      '--glassy-warn': '#fbbf24',
      '--glassy-bad': '#f87171',
      '--glassy-muted': '#87a89a',
      '--glassy-text': '#e7f5ee',
      '--glassy-glow': '0 0 24px rgba(52, 211, 153, 0.25)'
    }
  },
  sunset: {
    name: 'Sunset',
    vars: {
      '--glassy-bg': '#1d0f1e',
      '--glassy-panel': '#2d1530',
      '--glassy-panel2': '#251226',
      '--glassy-deep': '#150a16',
      '--glassy-border': '#47224a',
      '--glassy-borderlight': '#653466',
      '--glassy-accent': '#fb7185',
      '--glassy-accent2': '#fbbf24',
      '--glassy-good': '#4ade80',
      '--glassy-warn': '#fbbf24',
      '--glassy-bad': '#fb7185',
      '--glassy-muted': '#b58ab5',
      '--glassy-text': '#fce7f3',
      '--glassy-glow': '0 0 24px rgba(251, 113, 133, 0.25)'
    }
  },
  gallery: { name: 'Gallery Glass', vars: glassVars(GALLERY_VARIANTS.gallery) },
  galleryblack: { name: 'Gallery Black Glass', vars: glassVars(GALLERY_VARIANTS.galleryblack) },
  gallerygreen: { name: 'Gallery Green Glass', vars: glassVars(GALLERY_VARIANTS.gallerygreen) },
  galleryblue: { name: 'Gallery Blue Glass', vars: glassVars(GALLERY_VARIANTS.galleryblue) },
  galleryred: { name: 'Gallery Red Glass', vars: glassVars(GALLERY_VARIANTS.galleryred) },
  galleryorange: { name: 'Gallery Orange Glass', vars: glassVars(GALLERY_VARIANTS.galleryorange) },
  gallerypurple: { name: 'Gallery Purple Glass', vars: glassVars(GALLERY_VARIANTS.gallerypurple) },
  royal: {
    name: 'Royal',
    vars: {
      '--glassy-bg': '#0d0b21',
      '--glassy-panel': '#171436',
      '--glassy-panel2': '#13102c',
      '--glassy-deep': '#08071a',
      '--glassy-border': '#2a2652',
      '--glassy-borderlight': '#3d3780',
      '--glassy-accent': '#818cf8',
      '--glassy-accent2': '#c084fc',
      '--glassy-good': '#34d399',
      '--glassy-warn': '#fbbf24',
      '--glassy-bad': '#f87171',
      '--glassy-muted': '#9aa3d8',
      '--glassy-text': '#e6e7f5',
      '--glassy-glow': '0 0 24px rgba(129, 140, 248, 0.25)'
    }
  },
  candy: {
    name: 'Candy',
    vars: {
      '--glassy-bg': '#1a0b2e',
      '--glassy-panel': '#261040',
      '--glassy-panel2': '#1f0c36',
      '--glassy-deep': '#120623',
      '--glassy-border': '#3d1d63',
      '--glassy-borderlight': '#5b2f8f',
      '--glassy-accent': '#f472b6',
      '--glassy-accent2': '#22d3ee',
      '--glassy-good': '#4ade80',
      '--glassy-warn': '#fbbf24',
      '--glassy-bad': '#fb7185',
      '--glassy-muted': '#c39bd8',
      '--glassy-text': '#fae8ff',
      '--glassy-glow': '0 0 24px rgba(244, 114, 182, 0.28)'
    }
  },
  paper: {
    name: 'Paper',
    vars: {
      '--glassy-bg': '#f1f5f9',
      '--glassy-panel': '#ffffff',
      '--glassy-panel2': '#e2e8f0',
      '--glassy-deep': '#cbd5e1',
      '--glassy-border': '#cbd5e1',
      '--glassy-borderlight': '#94a3b8',
      '--glassy-accent': '#2563eb',
      '--glassy-accent2': '#7c3aed',
      '--glassy-good': '#16a34a',
      '--glassy-warn': '#d97706',
      '--glassy-bad': '#dc2626',
      '--glassy-muted': '#64748b',
      '--glassy-text': '#1e293b',
      '--glassy-glow': '0 0 24px rgba(37, 99, 235, 0.18)'
    }
  }
}

/**
 * Applies a theme by writing its CSS variables onto <html> and recording the
 * active id in the dataset. Falls back to the default Gallery Glass theme.
 */
export function applyTheme(id: ThemeId): void {
  const theme = THEMES[id] ?? THEMES.gallery
  for (const [key, value] of Object.entries(theme.vars)) {
    document.documentElement.style.setProperty(key, value)
  }
  document.documentElement.dataset.theme = id
}

/** Joins non-empty class names with spaces (a tiny classnames helper). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
