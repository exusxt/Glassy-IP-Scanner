/**
 * Left-hand navigation sidebar listing the Glassy IP Scanner features. The
 * active item is tinted with the accent color; each row uses the standard
 * panel/border styling so it matches the reference app's look.
 */
import { LayoutDashboard, ScanLine, Settings, Terminal } from 'lucide-react'
import { cn } from '../lib'

export type ScreenId = 'overview' | 'scanner' | 'console' | 'settings'

const ITEMS: Array<{ id: ScreenId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'scanner', label: 'Network Scanner', icon: ScanLine },
  { id: 'console', label: 'Console', icon: Terminal },
  { id: 'settings', label: 'Settings', icon: Settings }
]

export function Sidebar({
  active,
  onNavigate
}: {
  active: ScreenId
  onNavigate: (id: ScreenId) => void
}): React.JSX.Element {
  return (
    <nav className="flex w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r border-glassy-border bg-glassy-panel/50 p-2">
      {ITEMS.map((item) => {
        const Icon = item.icon
        const isActive = active === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-all duration-150',
              isActive
                ? 'border border-glassy-accent/60 bg-glassy-accent/10 text-glassy-accent shadow-glow'
                : 'border border-transparent text-glassy-muted hover:bg-glassy-panel hover:text-glassy-text'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
