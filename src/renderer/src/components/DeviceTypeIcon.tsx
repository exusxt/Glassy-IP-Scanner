/**
 * Icon + tooltip for a device type classification. Renders the lucide icon for
 * the given DeviceTypeId with an accessible title and the human label.
 */
import { ArrowLeftRight, Cpu, Gamepad2, HardDrive, HelpCircle, Laptop, Monitor, Printer, Radio, Router, Server, Smartphone, Speaker, Tablet, Tv, Video } from 'lucide-react'
import type { DeviceTypeId } from '../../../shared/types'
import { DEVICE_TYPE_META } from '../lib'
import { cn } from '../lib'

const ICONS: Record<DeviceTypeId, React.ComponentType<{ className?: string }>> = {
  router: Router,
  switch: ArrowLeftRight,
  printer: Printer,
  nas: HardDrive,
  camera: Video,
  tv: Tv,
  speaker: Speaker,
  phone: Smartphone,
  tablet: Tablet,
  laptop: Laptop,
  computer: Monitor,
  console: Gamepad2,
  rpi: Cpu,
  server: Server,
  'smart-device': Radio,
  unknown: HelpCircle
}

export function DeviceTypeIcon({
  type,
  className,
  withLabel = false
}: {
  type: DeviceTypeId
  className?: string
  withLabel?: boolean
}): React.JSX.Element {
  const Icon = ICONS[type] ?? HelpCircle
  const label = DEVICE_TYPE_META[type].label
  return (
    <span className="inline-flex items-center gap-1.5" title={label}>
      <Icon className={cn('h-3.5 w-3.5 shrink-0 text-glassy-muted', className)} />
      {withLabel ? <span className="truncate text-xs text-glassy-muted">{label}</span> : null}
    </span>
  )
}
