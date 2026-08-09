/**
 * In-window header/banner below the frameless title bar. Shows the app
 * identity and a quick summary of the active network interfaces.
 */
import { Network, RefreshCw } from 'lucide-react'
import { Badge, Button, Spinner } from './ui'
import appIcon from '../assets/app-icon.png'

export function Header({
  interfaceCount,
  onlineCount,
  refreshing,
  onRefresh
}: {
  interfaceCount: number
  onlineCount: number
  refreshing: boolean
  onRefresh: () => void
}): React.JSX.Element {
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-glassy-accent/40 shadow-glow">
          <img src={appIcon} alt="Glassy IP Scanner" className="h-full w-full object-cover" />
        </div>
        <div>
          <h1 className="text-lg font-bold leading-tight text-glassy-text">Glassy IP Scanner</h1>
          <p className="text-xs text-glassy-muted">Discover and understand devices on your network</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent">
          <Network className="h-3 w-3" />
          {interfaceCount} network interface(s)
        </Badge>
        <Badge tone="good">{onlineCount} device(s) online</Badge>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </Button>
      </div>
    </header>
  )
}
