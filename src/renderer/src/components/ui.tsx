/**
 * Shared renderer UI primitives: Button, Checkbox, Badge, Spinner, ProgressBar,
 * Field, Input and Select. All styling is Tailwind-based on the glassy-* theme
 * CSS variables so the components inherit whichever theme is active.
 */
import React from 'react'
import { cn } from '../lib'

/**
 * Themed button. variant picks the visual style (default/primary/danger/ghost/
 * outline), size picks padding and font size; all native button props pass
 * through to the underlying <button>.
 */
export function Button({
  variant = 'default',
  size = 'md',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'danger' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
}): React.JSX.Element {
  const variants: Record<string, string> = {
    default: 'bg-glassy-panel border border-glassy-borderlight text-glassy-text hover:bg-glassy-borderlight/60',
    primary: 'bg-gradient-to-r from-glassy-accent to-glassy-accent2 text-glassy-deep hover:brightness-110 shadow-glow border border-transparent',
    danger: 'bg-glassy-bad/15 border border-glassy-bad/40 text-glassy-bad hover:bg-glassy-bad/25',
    ghost: 'bg-transparent border border-transparent text-glassy-muted hover:text-glassy-text hover:bg-glassy-panel',
    outline: 'bg-transparent border border-glassy-borderlight text-glassy-accent hover:bg-glassy-panel'
  }
  const sizes: Record<string, string> = {
    sm: 'px-2.5 py-1.5 text-xs rounded-md',
    md: 'px-4 py-2 text-sm rounded-lg',
    lg: 'px-6 py-3 text-base rounded-xl'
  }
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-glassy-accent/60',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  )
}

/**
 * Card-style checkbox row with an optional hint line; the whole card is
 * clickable. onChange receives the checked state of the hidden input.
 */
export function Checkbox({
  label,
  hint,
  checked,
  onChange,
  disabled,
  className
}: {
  label: React.ReactNode
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  className?: string
}): React.JSX.Element {
  return (
    <label
      className={cn(
        'group flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all duration-150',
        checked
          ? 'border-glassy-accent/60 bg-glassy-accent/10'
          : 'border-glassy-border bg-glassy-panel/60 hover:border-glassy-borderlight',
        disabled && 'opacity-50 pointer-events-none',
        className
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer appearance-none rounded border border-glassy-borderlight bg-glassy-panel2 transition-all checked:border-glassy-accent checked:bg-glassy-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-glassy-accent/60"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-glassy-text">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-glassy-muted">{hint}</span> : null}
      </span>
    </label>
  )
}

/** Small pill label; tone selects the color scheme for status/type indicators. */
export function Badge({
  children,
  tone = 'default',
  className
}: {
  children: React.ReactNode
  tone?: 'default' | 'good' | 'warn' | 'bad' | 'accent'
  className?: string
}): React.JSX.Element {
  const tones: Record<string, string> = {
    default: 'bg-glassy-panel text-glassy-muted border-glassy-borderlight',
    good: 'bg-glassy-good/10 text-glassy-good border-glassy-good/40',
    warn: 'bg-glassy-warn/10 text-glassy-warn border-glassy-warn/40',
    bad: 'bg-glassy-bad/10 text-glassy-bad border-glassy-bad/40',
    accent: 'bg-glassy-accent/10 text-glassy-accent border-glassy-accent/40'
  }
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium', tones[tone], className)}>
      {children}
    </span>
  )
}

/** Inline spinner for in-flight work; sized and colored via className. */
export function Spinner({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg className={cn('h-4 w-4 animate-spin text-glassy-accent', className)} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

/**
 * Labeled progress bar. Shows a percentage when max > 0, otherwise an animated
 * indeterminate track via the indeterminate flag.
 */
export function ProgressBar({ value, max, label, indeterminate }: { value: number; max: number; label?: string; indeterminate?: boolean }): React.JSX.Element {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-mono text-glassy-muted">{label}</span>
        {max > 0 ? <span className="font-mono text-glassy-muted">{Math.round(pct)}%</span> : null}
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-glassy-panel2 border border-glassy-border">
        <div
          className={cn('h-full rounded-full bg-gradient-to-r from-glassy-accent to-glassy-accent2 transition-[width] duration-200', indeterminate && 'animate-pulse')}
          style={{ width: indeterminate ? '40%' : `${pct}%` }}
        />
      </div>
    </div>
  )
}

/**
 * Form field wrapper: uppercase label above arbitrary children, with an
 * optional hint line below.
 */
export function Field({
  label,
  children,
  hint,
  className
}: {
  label: string
  children: React.ReactNode
  hint?: string
  className?: string
}): React.JSX.Element {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-glassy-muted">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-glassy-muted">{hint}</span> : null}
    </label>
  )
}

/** Themed text input; accepts all native input attributes. */
export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>): React.JSX.Element {
  return (
    <input
      className={cn(
        'w-full rounded-lg px-3 py-2 text-sm text-glassy-text caret-glassy-accent placeholder:text-glassy-muted/80 glass-input',
        className
      )}
      {...props}
    />
  )
}

/** Themed dropdown; accepts all native select attributes and children (options). */
export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>): React.JSX.Element {
  return (
    <select
      className={cn(
        'w-full appearance-none rounded-lg px-3 py-2 text-sm text-glassy-text glass-input',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
}

/** Simple themed panel wrapper with the app's standard card styling. */
export function Panel({ className, children }: { className?: string; children: React.ReactNode }): React.JSX.Element {
  return <div className={cn('rounded-xl border border-glassy-border bg-glassy-panel/70 p-4', className)}>{children}</div>
}
