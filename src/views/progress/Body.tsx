import { useLiveQuery } from 'dexie-react-hooks'
import { Pencil } from 'lucide-react'
import { useMemo, useState } from 'react'
import { LineChartSimple } from '@/components/charts/LineChartSimple'
import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/card'
import { Chip } from '@/components/ui/controls'
import { Field, NumInput } from '@/components/ui/input'
import { Sheet } from '@/components/ui/sheet'
import { toast } from '@/components/ui/toast'
import { fmtDate } from '@/lib/dates'
import { db } from '@/lib/db'
import { comparisons, describeChange, MEASURE_LABEL, ratios, samePhase, SHORT_LABEL, sorted, valueAt } from '@/lib/measurements'
import type { MeasureKey, Measurement, Settings } from '@/lib/types'
import { OPTIONAL_MEASURES, REQUIRED_MEASURES, WIDTHS } from '@/lib/types'
import { readL, showL } from '@/lib/units'
import { cn, fmtNum } from '@/lib/utils'

const KEYS: MeasureKey[] = ['waist', 'belly', 'hips', 'highHip', 'wWaist', 'wBelly', 'wHighHip', 'wHips']

function Delta({ d, units, invert = false }: { d: number | null | undefined; units: Settings['units']; invert?: boolean }) {
  if (d == null) return <span className="text-ink-3">—</span>
  const dir = describeChange(d)
  const v = showL(Math.abs(d), units)
  // Neutral styling: direction is information. Sage marks change in the goal direction.
  const toward = dir === 'unchanged' ? false : invert ? dir === 'up' : dir === 'down'
  return (
    <span className={cn('tabular-nums', toward ? 'text-sage' : 'text-ink-2')}>
      {dir === 'unchanged' ? '±0' : `${d > 0 ? '+' : '−'}${fmtNum(v, 2)}`}
    </span>
  )
}

export function BodySection({ settings }: { settings: Settings }) {
  const ms = useLiveQuery(() => db.measurements.toArray(), [])
  const [chartKey, setChartKey] = useState<MeasureKey>('waist')
  const [edit, setEdit] = useState<Measurement | null>(null)
  const u = settings.units
  const list = useMemo(() => sorted(ms ?? []), [ms])
  if (!ms) return null
  const current = list[list.length - 1]
  if (!current) return <Empty>No measurements yet.</Empty>
  const cmp = comparisons(list, current)
  const same = samePhase(list, current)
  const v = (m: Measurement | undefined, k: MeasureKey) => (m ? valueAt(list, m, k) : undefined)
  const d = (m: Measurement | undefined, k: MeasureKey) => {
    const a = v(current, k)
    const b = v(m, k)
    return a != null && b != null && m && m.id !== current.id ? a - b : null
  }
  const baseline = list.find((m) => m.baseline)
  const hipsGoalUp = (k: MeasureKey) => k === 'hips' || k === 'wHips'

  const ratioRows: { label: string; fn: (m: Measurement) => number | null; dp: number; unit?: boolean; invert?: boolean }[] = [
    { label: 'Waist ÷ hip', fn: (m) => ratios({ waist: v(m, 'waist'), hips: v(m, 'hips') }).whr, dp: 3 },
    { label: 'Belly button ÷ hip', fn: (m) => ratios({ belly: v(m, 'belly'), hips: v(m, 'hips') }).bhr, dp: 3 },
    { label: 'Hip − waist', fn: (m) => ratios({ waist: v(m, 'waist'), hips: v(m, 'hips') }).diff, dp: 2, unit: true, invert: true },
    { label: 'Front width: hip − waist', fn: (m) => ratios({ wWaist: v(m, 'wWaist'), wHips: v(m, 'wHips') }).widthDiff, dp: 2, unit: true, invert: true },
  ]

  const chartData = list.filter((m) => m.values[chartKey] != null).map((m) => ({ date: m.date, value: showL(m.values[chartKey]!, u), cycleDay: m.cycleDay }))

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-3">
        Latest: {fmtDate(current.date, { month: 'short', day: 'numeric' })}
        {current.cycleDay ? ` · cycle day ${current.cycleDay}` : ''}. Values in {u.length}; changes under 0.25 in are shown as ±0.
      </p>
      <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
        <table className="w-full min-w-[440px] text-sm">
          <thead className="text-xs text-ink-3">
            <tr>
              <th className="py-1.5 pr-2 text-left font-medium" />
              <th className="px-1 text-right font-medium">Now</th>
              <th className="px-1 text-right font-medium">Last wk</th>
              <th className="px-1 text-right font-medium">4 wk</th>
              <th className="px-1 text-right font-medium">Month</th>
              <th className="pl-1 text-right font-medium">Baseline</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {KEYS.map((k) => {
              const now = v(current, k)
              if (now == null) return null
              return (
                <tr key={k}>
                  <td className="py-1.5 pr-2">{SHORT_LABEL[k]}</td>
                  <td className="px-1 text-right font-medium tabular-nums">{fmtNum(showL(now, u), 2)}</td>
                  <td className="px-1 text-right"><Delta d={d(cmp.lastWeek, k)} units={u} invert={hipsGoalUp(k)} /></td>
                  <td className="px-1 text-right"><Delta d={d(cmp.fourWeeks, k)} units={u} invert={hipsGoalUp(k)} /></td>
                  <td className="px-1 text-right"><Delta d={d(cmp.monthStart, k)} units={u} invert={hipsGoalUp(k)} /></td>
                  <td className="pl-1 text-right"><Delta d={d(cmp.baseline, k)} units={u} invert={hipsGoalUp(k)} /></td>
                </tr>
              )
            })}
            {ratioRows.map((r) => {
              const now = r.fn(current)
              if (now == null) return null
              const dd = (m?: Measurement) => {
                if (!m || m.id === current.id) return <span className="text-ink-3">—</span>
                const b = r.fn(m)
                if (b == null) return <span className="text-ink-3">—</span>
                const x = now - b
                if (r.unit) return <Delta d={x} units={u} invert={r.invert} />
                return <span className={cn('tabular-nums', Math.abs(x) < 0.005 ? 'text-ink-3' : x < 0 ? 'text-sage' : 'text-ink-2')}>{Math.abs(x) < 0.005 ? '±0' : `${x > 0 ? '+' : '−'}${fmtNum(Math.abs(x), 3)}`}</span>
              }
              return (
                <tr key={r.label} className="bg-surface-2/40">
                  <td className="py-1.5 pr-2">{r.label}</td>
                  <td className="px-1 text-right font-medium tabular-nums">{r.unit ? fmtNum(showL(now, u), 2) : fmtNum(now, 3)}</td>
                  <td className="px-1 text-right">{dd(cmp.lastWeek)}</td>
                  <td className="px-1 text-right">{dd(cmp.fourWeeks)}</td>
                  <td className="px-1 text-right">{dd(cmp.monthStart)}</td>
                  <td className="pl-1 text-right">{dd(cmp.baseline)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {same && (
        <p className="rounded-2xl bg-surface-2 px-3 py-2 text-sm text-ink-2">
          Same cycle phase comparison (day {same.cycleDay} on {fmtDate(same.date)} vs day {current.cycleDay} now): waist{' '}
          <Delta d={d(same, 'waist')} units={u} />, belly button <Delta d={d(same, 'belly')} units={u} />, hips <Delta d={d(same, 'hips')} units={u} invert />.
        </p>
      )}

      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
        {KEYS.map((k) => (
          <Chip key={k} active={chartKey === k} onClick={() => setChartKey(k)}>
            {SHORT_LABEL[k]}
          </Chip>
        ))}
      </div>
      {chartData.length >= 2 ? (
        <LineChartSimple
          data={chartData}
          unit={u.length}
          baseline={baseline?.values[chartKey] != null ? showL(baseline.values[chartKey]!, u) : undefined}
          note={(p) => ((p as { cycleDay?: number | null }).cycleDay ? `cycle day ${(p as { cycleDay?: number }).cycleDay}` : undefined)}
        />
      ) : (
        <Empty>The chart fills in after your first weekly check-in.</Empty>
      )}

      <details className="group">
        <summary className="cursor-pointer list-none text-sm font-medium text-accent">Measurement history ({list.length})</summary>
        <ul className="mt-2 divide-y divide-border">
          {[...list].reverse().map((m) => (
            <li key={m.id} className="flex items-center gap-2 py-2">
              <div className="min-w-0 flex-1 text-sm">
                <div>
                  {fmtDate(m.date, { month: 'short', day: 'numeric', year: 'numeric' })}
                  {m.baseline && <span className="text-ink-3"> · baseline</span>}
                  {m.cycleDay ? <span className="text-ink-3"> · cycle day {m.cycleDay}</span> : null}
                </div>
                <div className="text-xs text-ink-3 tabular-nums">
                  {REQUIRED_MEASURES.map((k) => (m.values[k] != null ? `${SHORT_LABEL[k]} ${showL(m.values[k]!, u)}` : null)).filter(Boolean).join(' · ')}
                </div>
              </div>
              <button className="rounded-full p-2 text-ink-3" onClick={() => setEdit(structuredClone(m))} aria-label="Edit">
                <Pencil className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      </details>

      <Sheet
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit ? `Edit ${fmtDate(edit.date)}` : ''}
        footer={
          <div className="flex gap-2">
            {edit && !edit.baseline && (
              <Button
                variant="outline"
                onClick={async () => {
                  const copy = ms.find((x) => x.id === edit.id)
                  await db.measurements.delete(edit.id)
                  if (copy) toast('Measurement deleted', () => db.measurements.put(copy).then(() => undefined))
                  setEdit(null)
                }}
              >
                Delete
              </Button>
            )}
            <Button
              className="flex-1"
              onClick={async () => {
                if (edit) await db.measurements.put(edit)
                setEdit(null)
              }}
            >
              Save
            </Button>
          </div>
        }
      >
        {edit && (
          <div className="grid grid-cols-2 gap-3">
            {[...REQUIRED_MEASURES, ...OPTIONAL_MEASURES, ...WIDTHS, 'wShoulders' as const].map((k) => (
              <Field key={k} label={`${MEASURE_LABEL[k]} (${u.length})`}>
                <NumInput
                  value={edit.values[k] != null ? showL(edit.values[k]!, u) : null}
                  onChange={(val) => {
                    const values = { ...edit.values }
                    if (val == null) delete values[k]
                    else values[k] = readL(val, u)
                    setEdit({ ...edit, values })
                  }}
                />
              </Field>
            ))}
          </div>
        )}
      </Sheet>
    </div>
  )
}
