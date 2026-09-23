import { cn, fmtNum } from '@/lib/utils'
import type { Range } from '@/lib/types'

/**
 * Macro bar with the target range shown as a band. Neutral styling — being above or below a range is
 * information, not a failure, so there's no red.
 */
export function MacroBar({ label, value, range, unit = 'g', openEnded = false, compact = false }: { label: string; value: number; range: Range; unit?: string; openEnded?: boolean; compact?: boolean }) {
  const scaleMax = Math.max(range.max * 1.2, value * 1.02, 1)
  const pct = (v: number) => `${Math.min(100, (v / scaleMax) * 100)}%`
  const inRange = value >= range.min && (openEnded || value <= range.max)
  const rangeText = range.min === range.max ? fmtNum(range.min) : `${fmtNum(range.min)}–${fmtNum(range.max)}${openEnded ? '+' : ''}`
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className={cn('font-medium', compact ? 'text-xs' : 'text-sm')}>{label}</span>
        <span className={cn('tabular-nums text-ink-2', compact ? 'text-xs' : 'text-sm')}>
          <span className="font-semibold text-ink">{fmtNum(value)}</span> / {rangeText}
          {unit && ` ${unit}`}
        </span>
      </div>
      <div className={cn('relative overflow-hidden rounded-full bg-surface-2', compact ? 'h-1.5' : 'h-2.5')}>
        <div className="absolute inset-y-0 bg-sage/25" style={{ left: pct(range.min), width: `calc(${pct(openEnded ? scaleMax : range.max)} - ${pct(range.min)})` }} />
        <div className={cn('absolute inset-y-0 left-0 rounded-full transition-[width] duration-300', inRange ? 'bg-sage' : 'bg-accent')} style={{ width: pct(value) }} />
      </div>
    </div>
  )
}

export function Ring({ value, max, size = 120, stroke = 10, children }: { value: number; max: number; size?: number; stroke?: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const frac = Math.min(1, max > 0 ? value / max : 0)
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} style={{ transition: 'stroke-dashoffset 0.4s' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}
