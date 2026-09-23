import { MacroBar, Ring } from '@/components/ui/progress'
import { carbRange } from '@/lib/nutrition'
import type { DayData } from './useDay'
import { fmtNum } from '@/lib/utils'

export function NutritionSummary({ data, compact = false }: { data: DayData; compact?: boolean }) {
  const t = data.day.targets
  const tot = data.totals
  const carbs = carbRange(t)
  return (
    <div className="flex items-center gap-5">
      <Ring value={tot.kcal} max={t.kcal.max} size={compact ? 96 : 112} stroke={compact ? 8 : 9}>
        <span className="font-display text-2xl leading-none tabular-nums">{fmtNum(tot.kcal)}</span>
        <span className="mt-1 text-[11px] leading-tight text-ink-3">
          of {t.kcal.min === t.kcal.max ? fmtNum(t.kcal.max) : `${fmtNum(t.kcal.min)}–${fmtNum(t.kcal.max)}`}
          <br />
          kcal
        </span>
      </Ring>
      <div className="min-w-0 flex-1 space-y-2">
        <MacroBar compact label="Protein" value={tot.protein} range={t.protein} />
        <MacroBar compact label={t.carbs ? 'Carbs' : 'Carbs (fill)'} value={tot.carbs} range={carbs} />
        <MacroBar compact label="Fat" value={tot.fat} range={t.fat} />
        <MacroBar compact label="Fiber" value={tot.fiber} range={t.fiber} openEnded />
      </div>
    </div>
  )
}
