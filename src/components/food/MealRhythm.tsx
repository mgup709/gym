import { Check } from 'lucide-react'
import { toMin } from '@/lib/dates'
import { fmtWindow, type RhythmItem } from '@/lib/mealtiming'
import type { MealSlot } from '@/lib/types'
import { cn } from '@/lib/utils'

export function MealRhythm({ items, logged, now, isToday }: { items: RhythmItem[]; logged: Set<MealSlot>; now: string; isToday: boolean }) {
  const t = toMin(now)
  const nextIdx = isToday ? items.findIndex((r) => r.kind === 'meal' && !(r.meal && logged.has(r.meal)) && toMin(r.end) + 60 >= t) : -1
  return (
    <ol className="relative space-y-0.5">
      {items.map((r, i) => {
        const done = r.kind === 'meal' && r.meal && logged.has(r.meal) && r.key !== 'topup'
        const next = i === nextIdx
        return (
          <li key={r.key} className={cn('flex gap-3 rounded-2xl px-2 py-1.5', next && 'bg-accent-soft/70')}>
            <span
              className={cn(
                'mt-1 grid size-4 shrink-0 place-items-center rounded-full border',
                r.kind !== 'meal' ? 'border-sage bg-sage' : done ? 'border-sage bg-sage text-white' : next ? 'border-accent' : 'border-border',
              )}
            >
              {done && <Check className="size-3" strokeWidth={3} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className={cn('text-sm font-medium', r.optional && 'text-ink-2')}>{r.label}</span>
                <span className="text-xs text-ink-3 tabular-nums">{fmtWindow(r)}</span>
              </div>
              {(next || r.kind !== 'meal') && <div className="text-xs text-ink-2">{r.aim}</div>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
