import { Minus, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Segmented<T extends string>({ value, onChange, options, className, size = 'md' }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string; size?: 'sm' | 'md' }) {
  return (
    <div className={cn('flex rounded-full bg-surface-2 p-1', className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex-1 rounded-full font-medium whitespace-nowrap transition-colors',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-ink-3',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Stepper({ value, onChange, step = 1, min = 0, max = 99, format, className }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; format?: (v: number) => ReactNode; className?: string }) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v * 1000) / 1000)))
  return (
    <div className={cn('inline-flex items-center rounded-full bg-surface-2', className)}>
      <button className="grid size-8 place-items-center rounded-full text-ink-2 hover:bg-border disabled:opacity-30" onClick={() => set(value - step)} disabled={value <= min} aria-label="Decrease">
        <Minus className="size-4" />
      </button>
      <span className="min-w-9 text-center text-sm font-semibold tabular-nums">{format ? format(value) : value}</span>
      <button className="grid size-8 place-items-center rounded-full text-ink-2 hover:bg-border disabled:opacity-30" onClick={() => set(value + step)} disabled={value >= max} aria-label="Increase">
        <Plus className="size-4" />
      </button>
    </div>
  )
}

/** 1–5 tap rating. Tapping the selected value clears it. */
export function Rating({ value, onChange, low, high, label }: { value?: number; onChange: (v: number | undefined) => void; low?: string; high?: string; label: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        {(low || high) && (
          <span className="text-[11px] text-ink-3">
            {low} → {high}
          </span>
        )}
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onChange(value === n ? undefined : n)}
            aria-pressed={value === n}
            className={cn('h-9 rounded-xl text-sm font-medium transition-colors', value === n ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink-2 hover:bg-border')}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Chip({ active, onClick, children, className }: { active?: boolean; onClick?: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm whitespace-nowrap transition-colors',
        active ? 'border-accent bg-accent-soft text-accent' : 'border-border bg-surface text-ink-2 hover:bg-surface-2',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-1">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-ink-3">{hint}</span>}
      </span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={(e) => {
          e.preventDefault()
          onChange(!checked)
        }}
        className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-accent' : 'bg-border')}
      >
        <span className={cn('absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform', checked && 'translate-x-5')} />
      </button>
    </label>
  )
}
