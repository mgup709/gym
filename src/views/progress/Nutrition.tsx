import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Lightbulb } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { axis, C, TooltipBox } from '@/components/charts/common'
import { TrendChart, type TrendPoint } from '@/components/charts/TrendChart'
import { Empty } from '@/components/ui/card'
import { Chip, Switch } from '@/components/ui/controls'
import { Select } from '@/components/ui/input'
import { addDays, diffDays, fmtDate, fmtMonth, monthKey, parseISO, rangeDates, toISO, weekStart } from '@/lib/dates'
import { db } from '@/lib/db'
import { navigate } from '@/lib/hooks'
import { insights } from '@/lib/insights'
import { sorted } from '@/lib/measurements'
import { band, DAY_TYPE_LABEL, MICRO_INFO } from '@/lib/nutrition'
import { bestE1RM, historyFor } from '@/lib/progression'
import { aggregate, dailyRows, monthlySummaries, movingAverage, summarize, targetRange, valueOf, type DayRow, type MonthSummary, type NutrientKey } from '@/lib/trends'
import type { DayType, ISODate, Settings } from '@/lib/types'
import { MICROS } from '@/lib/types'
import { showL } from '@/lib/units'
import { cn, fmtNum, mean } from '@/lib/utils'

type RangeKey = '7d' | '30d' | '3m' | '6m' | '1y' | 'all'
const RANGES: { value: RangeKey; label: string; days: number }[] = [
  { value: '7d', label: '7 days', days: 7 },
  { value: '30d', label: '30 days', days: 30 },
  { value: '3m', label: '3 months', days: 91 },
  { value: '6m', label: '6 months', days: 182 },
  { value: '1y', label: '1 year', days: 365 },
  { value: 'all', label: 'All time', days: 0 },
]

const METRICS: { key: NutrientKey; label: string; unit: string }[] = [
  { key: 'kcal', label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'fiber', label: 'Fiber', unit: 'g' },
  ...MICROS.map((m) => ({ key: m as NutrientKey, label: MICRO_INFO[m].label, unit: MICRO_INFO[m].unit })),
]

/** All nutrition history (days + entries), live. */
export function useNutritionHistory(today: ISODate) {
  return useLiveQuery(async () => {
    const [days, entries] = await Promise.all([db.days.toArray(), db.entries.toArray()])
    const first = [...days.map((d) => d.date), ...entries.map((e) => e.date)].sort()[0] ?? today
    return { days, entries, first: first < today ? first : today }
  }, [today])
}

export function NutritionTrends({ settings, today }: { settings: Settings; today: ISODate }) {
  const hist = useNutritionHistory(today)
  const [range, setRange] = useState<RangeKey>('30d')
  const [metric, setMetric] = useState<NutrientKey>('kcal')
  const [ma30, setMa30] = useState(false)

  const view = useMemo(() => {
    if (!hist) return null
    const r = RANGES.find((x) => x.value === range)!
    const from = range === 'all' ? hist.first : addDays(today, -(r.days - 1))
    const lookback = addDays(from, -30)
    const rows = dailyRows(lookback, today, hist.days, hist.entries)
    const ma7 = movingAverage(rows, metric, 7, 3)
    const ma30v = movingAverage(rows, metric, 30, 10)
    const start = rows.findIndex((x) => x.date === from)
    const visible = rows.slice(start)
    const span = diffDays(today, from) + 1
    const grain: 'day' | 'week' | 'month' = span <= 100 ? 'day' : span <= 420 ? 'week' : 'month'
    let data: TrendPoint[]
    if (grain === 'day') {
      data = visible.map((row, i) => ({
        key: row.date,
        value: row.logged ? valueOf(row, metric) : null,
        ma7: ma7[start + i],
        ma30: ma30v[start + i],
        band: metric === 'kcal' || metric === 'protein' || metric === 'carbs' || metric === 'fat' || metric === 'fiber' ? targetRange(row, metric) : null,
      }))
    } else {
      data = aggregate(visible, grain, [metric]).map((b) => ({ key: b.key, value: b.avg[metric] ?? null, band: b.target, n: b.logged }))
    }
    if ((MICROS as readonly string[]).includes(metric)) {
      const t = settings.microTargets[metric as keyof Settings['microTargets']]
      data = data.map((d) => ({ ...d, band: [t, t * 1.02] }))
    }
    const sum = summarize(visible)
    const avg = mean(visible.filter((x) => x.logged).map((x) => valueOf(x, metric)))
    return { data, grain, sum, avg, visible }
  }, [hist, range, metric, today, settings])

  if (!hist || !view) return null
  const m = METRICS.find((x) => x.key === metric)!
  const withinShare = (() => {
    const logged = view.visible.filter((r) => r.logged && r.targets)
    if (!logged.length || (MICROS as readonly string[]).includes(metric)) return null
    const ok = logged.filter((r) => {
      const t = targetRange(r, metric)
      return t && (metric === 'protein' || metric === 'fiber' ? valueOf(r, metric) >= t[0] : band(valueOf(r, metric), { min: t[0], max: t[1] }) === 'within')
    })
    return ok.length / logged.length
  })()

  return (
    <div className="space-y-3">
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
        {RANGES.map((r) => (
          <Chip key={r.value} active={range === r.value} onClick={() => setRange(r.value)}>
            {r.label}
          </Chip>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Select value={metric} onChange={(e) => setMetric(e.target.value as NutrientKey)} className="h-9 flex-1">
          {METRICS.map((x) => (
            <option key={x.key} value={x.key}>
              {x.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-surface-2 p-2">
          <div className="text-[11px] text-ink-3">Average</div>
          <div className="font-display text-lg tabular-nums">{fmtNum(view.avg, metric === 'b12' || metric === 'vitaminD' ? 1 : 0)}</div>
        </div>
        <div className="rounded-2xl bg-surface-2 p-2">
          <div className="text-[11px] text-ink-3">Days logged</div>
          <div className="font-display text-lg tabular-nums">{view.sum.logged}</div>
        </div>
        <div className="rounded-2xl bg-surface-2 p-2">
          <div className="text-[11px] text-ink-3">{metric === 'protein' || metric === 'fiber' ? 'Days ≥ target' : 'Days in range'}</div>
          <div className="font-display text-lg tabular-nums">{withinShare == null ? '—' : `${Math.round(withinShare * 100)}%`}</div>
        </div>
      </div>
      {view.sum.logged === 0 ? (
        <Empty>Nothing logged in this range yet.</Empty>
      ) : (
        <TrendChart data={view.data} unit={m.unit} grain={view.grain} showMA30={ma30} label={m.label} onSelect={view.grain === 'day' ? (d) => navigate(`food?date=${d}`) : undefined} />
      )}
      {view.grain === 'day' && <Switch checked={ma30} onChange={setMa30} label="Show 30-day average" />}
      <p className="text-xs text-ink-3">
        {view.grain === 'day' ? 'The 7-day average is the trend to watch; single days are just data. Tap a bar to open that day.' : `Showing ${view.grain}ly averages of logged days.`}
        {(MICROS as readonly string[]).includes(metric) && ' Micronutrients count only foods with stored values.'}
      </p>
    </div>
  )
}

// ── Monthly summaries & comparison ──────────────────────

const TYPES: DayType[] = ['lowerA', 'upper', 'core', 'lowerB', 'glute', 'rest']

function MonthCard({ m }: { m: MonthSummary }) {
  return (
    <div className="rounded-2xl border border-border p-3">
      <div className="font-display text-lg">{fmtMonth(m.month)}</div>
      <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-sm">
        {[
          ['Avg calories', fmtNum(m.kcal)],
          ['Avg protein', `${fmtNum(m.protein)} g`],
          ['Avg carbs', `${fmtNum(m.carbs)} g`],
          ['Avg fat', `${fmtNum(m.fat)} g`],
          ['Avg fiber', `${fmtNum(m.fiber)} g`],
          ['Protein target hit', m.proteinHit == null ? '—' : `${Math.round(m.proteinHit * 100)}%`],
          ['Calories in range', m.kcalWithin == null ? '—' : `${Math.round(m.kcalWithin * 100)}%`],
          ['Days logged', String(m.logged)],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2">
            <dt className="text-ink-3">{k}</dt>
            <dd className="tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function MonthlySummary({ today }: { today: ISODate }) {
  const hist = useNutritionHistory(today)
  const months = useMemo(() => (hist ? monthlySummaries(dailyRows(hist.first, today, hist.days, hist.entries)) : []), [hist, today])
  const [a, setA] = useState<string>('')
  const [b, setB] = useState<string>('')
  if (!hist) return null
  if (!months.length) return <Empty>Monthly summaries appear once you've logged some food.</Empty>
  const A = months.find((m) => m.month === a) ?? months[1] ?? months[0]
  const B = months.find((m) => m.month === b) ?? months[0]
  const delta = (x: number | null, y: number | null, pct = false) => (x == null || y == null ? '—' : `${y - x >= 0 ? '+' : '−'}${fmtNum(Math.abs((y - x) * (pct ? 100 : 1)))}${pct ? ' pts' : ''}`)
  return (
    <div className="space-y-4">
      <MonthCard m={months[0]} />
      {months.length > 1 && (
        <div className="space-y-2">
          <div className="text-sm font-medium">Compare months</div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={A.month} onChange={(e) => setA(e.target.value)}>
              {months.map((m) => (
                <option key={m.month} value={m.month}>
                  {fmtMonth(m.month)}
                </option>
              ))}
            </Select>
            <Select value={B.month} onChange={(e) => setB(e.target.value)}>
              {months.map((m) => (
                <option key={m.month} value={m.month}>
                  {fmtMonth(m.month)}
                </option>
              ))}
            </Select>
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs text-ink-3">
              <tr>
                <th className="py-1 text-left font-medium" />
                <th className="text-right font-medium">{fmtMonth(A.month).split(' ')[0]}</th>
                <th className="text-right font-medium">{fmtMonth(B.month).split(' ')[0]}</th>
                <th className="text-right font-medium">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border tabular-nums">
              {(
                [
                  ['Calories', A.kcal, B.kcal, false],
                  ['Protein g', A.protein, B.protein, false],
                  ['Carbs g', A.carbs, B.carbs, false],
                  ['Fat g', A.fat, B.fat, false],
                  ['Fiber g', A.fiber, B.fiber, false],
                  ['Protein hit', A.proteinHit, B.proteinHit, true],
                  ['Calories in range', A.kcalWithin, B.kcalWithin, true],
                ] as [string, number | null, number | null, boolean][]
              ).map(([k, x, y, pct]) => (
                <tr key={k}>
                  <td className="py-1.5">{k}</td>
                  <td className="text-right">{pct ? (x == null ? '—' : `${Math.round(x * 100)}%`) : fmtNum(x)}</td>
                  <td className="text-right">{pct ? (y == null ? '—' : `${Math.round(y * 100)}%`) : fmtNum(y)}</td>
                  <td className="text-right text-ink-2">{delta(x, y, pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <details>
        <summary className="cursor-pointer list-none text-sm font-medium text-accent">All months ({months.length})</summary>
        <div className="mt-2 space-y-2">
          {months.map((m) => (
            <MonthCard key={m.month} m={m} />
          ))}
        </div>
      </details>
    </div>
  )
}

export function DayTypeAnalysis({ today }: { today: ISODate }) {
  const hist = useNutritionHistory(today)
  const [days, setDays] = useState(30)
  const s = useMemo(() => (hist ? summarize(dailyRows(addDays(today, -(days - 1)), today, hist.days, hist.entries)) : null), [hist, today, days])
  if (!s) return null
  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        {[30, 90, 365].map((d) => (
          <Chip key={d} active={days === d} onClick={() => setDays(d)}>
            {d === 365 ? '1 year' : `${d} days`}
          </Chip>
        ))}
      </div>
      <table className="w-full text-sm">
        <thead className="text-xs text-ink-3">
          <tr>
            <th className="py-1 text-left font-medium">Day type</th>
            <th className="text-right font-medium">Days</th>
            <th className="text-right font-medium">kcal</th>
            <th className="text-right font-medium">Protein</th>
            <th className="text-right font-medium">Carbs</th>
            <th className="text-right font-medium">Fat</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border tabular-nums">
          {TYPES.map((t) => {
            const b = s.byType[t]
            return (
              <tr key={t}>
                <td className="py-1.5">{DAY_TYPE_LABEL[t]}</td>
                <td className="text-right text-ink-3">{b?.n ?? 0}</td>
                <td className="text-right">{fmtNum(b?.kcal)}</td>
                <td className="text-right">{b ? `${fmtNum(b.protein)} g` : '—'}</td>
                <td className="text-right">{b ? `${fmtNum(b.carbs)} g` : '—'}</td>
                <td className="text-right">{b ? `${fmtNum(b.fat)} g` : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Consistency calendar ────────────────────────────────

export function ConsistencyCalendar({ settings, today }: { settings: Settings; today: ISODate }) {
  const [month, setMonth] = useState(monthKey(today))
  const data = useLiveQuery(async () => {
    const from = `${month}-01`
    const end = parseISO(from)
    end.setMonth(end.getMonth() + 1)
    end.setDate(0)
    const to = toISO(end)
    const [days, entries, sessions, rec] = await Promise.all([
      db.days.where('date').between(from, to, true, true).toArray(),
      db.entries.where('date').between(from, to, true, true).toArray(),
      db.sessions.where('date').between(from, to, true, true).toArray(),
      db.recovery.where('date').between(from, to, true, true).toArray(),
    ])
    return { rows: dailyRows(from, to, days, entries), sessions, rec, from, to }
  }, [month])
  if (!data) return null
  const first = parseISO(data.from)
  const offset = (first.getDay() + 6) % 7 // Monday-first
  const workout = new Set(data.sessions.filter((s) => s.status === 'done').map((s) => s.date))
  const recLogged = new Set(data.rec.filter((r) => Object.keys(r).length > 1).map((r) => r.date))
  const shift = (n: number) => {
    const d = parseISO(`${month}-01`)
    d.setMonth(d.getMonth() + n)
    setMonth(monthKey(toISO(d)))
  }
  const cell = (r: DayRow) => {
    const future = r.date > today
    const P = r.logged && r.targets && r.protein >= r.targets.protein.min
    const F = r.logged && r.fruit + r.veg >= Math.max(4, settings.wholeFood.fruit + settings.wholeFood.veg - 1)
    const b = r.logged && r.targets ? band(r.kcal, r.targets.kcal) : null
    return (
      <button
        key={r.date}
        disabled={future}
        onClick={() => navigate(`food?date=${r.date}`)}
        className={cn('flex aspect-square flex-col items-center justify-between rounded-xl p-1 text-[10px]', r.date === today ? 'ring-1 ring-accent' : '', future ? 'opacity-30' : 'bg-surface-2/60')}
        aria-label={fmtDate(r.date)}
      >
        <span className="flex w-full items-center justify-between">
          <span className="text-ink-3">{parseISO(r.date).getDate()}</span>
          {b && (
            <span
              title={`Calories ${b} range`}
              className={cn(
                'size-2 rounded-full',
                b === 'within' && 'bg-ink-2',
                b === 'below' && 'border border-ink-3',
                b === 'above' && 'bg-ink-2 ring-2 ring-ink-3/40',
              )}
            />
          )}
        </span>
        <span className="grid w-full grid-cols-2 gap-px font-semibold leading-none">
          <span className={P ? 'text-accent' : 'text-transparent'}>P</span>
          <span className={workout.has(r.date) ? 'text-sage' : 'text-transparent'}>W</span>
          <span className={F ? 'text-amber' : 'text-transparent'}>F</span>
          <span className={recLogged.has(r.date) ? 'text-ink-2' : 'text-transparent'}>R</span>
        </span>
      </button>
    )
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button onClick={() => shift(-1)} className="rounded-full p-2 text-ink-3" aria-label="Previous month">
          <ChevronLeft className="size-4" />
        </button>
        <span className="font-medium">{fmtMonth(month)}</span>
        <button onClick={() => shift(1)} disabled={month >= monthKey(today)} className="rounded-full p-2 text-ink-3 disabled:opacity-30" aria-label="Next month">
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-ink-3">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`o${i}`} />
        ))}
        {data.rows.map(cell)}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-3">
        <span><b className="text-accent">P</b> protein target</span>
        <span><b className="text-sage">W</b> workout</span>
        <span><b className="text-amber">F</b> fruit + veg</span>
        <span><b className="text-ink-2">R</b> recovery logged</span>
        <span className="flex items-center gap-1"><span className="size-2 rounded-full border border-ink-3" /> below range</span>
        <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-ink-2" /> within</span>
        <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-ink-2 ring-2 ring-ink-3/40" /> above</span>
      </div>
    </div>
  )
}

export function Insights({ settings, today }: { settings: Settings; today: ISODate }) {
  const data = useLiveQuery(async () => {
    const from = addDays(today, -89)
    const [days, entries, recovery, measurements] = await Promise.all([
      db.days.where('date').between(from, today, true, true).toArray(),
      db.entries.where('date').between(from, today, true, true).toArray(),
      db.recovery.toArray(),
      db.measurements.toArray(),
    ])
    return insights({ today, rows: dailyRows(from, today, days, entries), entries, recovery, measurements, settings })
  }, [today, settings])
  if (!data) return null
  if (!data.length) return <Empty>Insights appear once there's enough data to support them — usually after a week or two of logging.</Empty>
  return (
    <ul className="space-y-2">
      {data.map((i) => (
        <li key={i.id} className="flex gap-2.5 text-sm">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber" />
          <span>{i.text}</span>
        </li>
      ))}
    </ul>
  )
}

// ── Nutrition + physique (small multiples on a shared weekly axis — no dual axes) ──

export function PhysiqueCompare({ settings, today }: { settings: Settings; today: ISODate }) {
  const hist = useNutritionHistory(today)
  const ms = useLiveQuery(() => db.measurements.toArray(), [])
  const sessions = useLiveQuery(() => db.sessions.toArray(), [])
  const weeks = useMemo(() => {
    if (!hist || !ms || !sessions) return []
    const from = weekStart(hist.first)
    const rows = dailyRows(from, today, hist.days, hist.entries)
    const buckets = aggregate(rows, 'week', ['kcal', 'protein'])
    const list = sorted(ms)
    const ht = historyFor('hip-thrust', sessions)
    return buckets.map((b) => {
      const inWeek = list.filter((m) => m.date >= b.from && m.date <= b.to)
      const m = inWeek[inWeek.length - 1]
      const lifts = ht.filter((h) => h.session.date >= b.from && h.session.date <= b.to)
      return {
        key: b.key,
        kcal: b.avg.kcal != null ? Math.round(b.avg.kcal) : null,
        protein: b.avg.protein != null ? Math.round(b.avg.protein) : null,
        waist: m?.values.waist != null ? showL(m.values.waist, settings.units) : null,
        belly: m?.values.belly != null ? showL(m.values.belly, settings.units) : null,
        hips: m?.values.hips != null ? showL(m.values.hips, settings.units) : null,
        strength: lifts.length ? Math.round(Math.max(...lifts.map((h) => bestE1RM(h.sets)))) : null,
        logged: b.logged,
      }
    })
  }, [hist, ms, sessions, today, settings.units])

  // "At roughly what intake was my waist trending down while strength remained stable?"
  const finding = useMemo(() => {
    const pts = weeks.filter((w) => w.waist != null)
    const hits: number[] = []
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]
      const b = pts[i]
      const span = weeks.filter((w) => w.key > a.key && w.key <= b.key && w.kcal != null && w.logged >= 4)
      if (!span.length) continue
      const waistDown = b.waist! - a.waist! <= -0.25 * (settings.units.length === 'cm' ? 2.54 : 1)
      const sA = weeks.filter((w) => w.key <= a.key && w.strength != null).pop()?.strength
      const sB = weeks.filter((w) => w.key <= b.key && w.strength != null).pop()?.strength
      const strengthOk = sA == null || sB == null || sB >= sA * 0.97
      if (waistDown && strengthOk) hits.push(...span.map((w) => w.kcal!))
    }
    if (hits.length < 2) return null
    return { lo: Math.min(...hits), hi: Math.max(...hits), avg: mean(hits)! }
  }, [weeks, settings.units])

  if (!hist || !ms || !sessions) return null
  const withData = weeks.filter((w) => w.kcal != null || w.waist != null)
  if (withData.length < 3) return <Empty>This comparison needs a few weeks of food logs and weekly measurements.</Empty>

  const small = ({ k, label, unit, kind = 'line' }: { k: 'kcal' | 'protein' | 'waist' | 'belly' | 'hips' | 'strength'; label: string; unit: string; kind?: 'bar' | 'line' }) => (
    <div>
      <div className="mb-0.5 text-xs font-medium text-ink-2">{label}</div>
      <div className="h-24">
        <ResponsiveContainer>
          {kind === 'bar' ? (
            <BarChart data={weeks} syncId="physique" margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis dataKey="key" hide />
              <YAxis {...axis} width={44} domain={['dataMin - 100', 'dataMax + 50']} />
              <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={({ active, payload }) => (active && payload?.length ? <TooltipBox title={`Week of ${fmtDate(payload[0].payload.key)}`} rows={[{ label, value: payload[0].payload[k] == null ? '—' : `${payload[0].payload[k]} ${unit}` }]} /> : null)} />
              <Bar dataKey={k} fill={C.bar} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
            </BarChart>
          ) : (
            <LineChart data={weeks} syncId="physique" margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis dataKey="key" hide />
              <YAxis {...axis} width={44} domain={['dataMin - 0.5', 'dataMax + 0.5']} tickFormatter={(v) => fmtNum(v, 1)} />
              <Tooltip cursor={{ stroke: C.ink3, strokeDasharray: '3 3' }} content={({ active, payload }) => (active && payload?.length ? <TooltipBox title={`Week of ${fmtDate(payload[0].payload.key)}`} rows={[{ label, value: payload[0].payload[k] == null ? '—' : `${payload[0].payload[k]} ${unit}` }]} /> : null)} />
              <Line dataKey={k} stroke={C.line} strokeWidth={2} dot={{ r: 2.5, fill: C.line, strokeWidth: 0 }} connectNulls isAnimationActive={false} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-3">Weekly view, aligned by week — hover one chart to see the same week in all of them.</p>
      {small({ k: "kcal", label: "Average calories (7-day)", unit: "kcal", kind: "bar" })}
      {small({ k: "protein", label: "Average protein", unit: "g", kind: "bar" })}
      {small({ k: "waist", label: "Smallest waist", unit: settings.units.length })}
      {small({ k: "belly", label: "Belly button", unit: settings.units.length })}
      {small({ k: "hips", label: "Hips / glutes", unit: settings.units.length })}
      {small({ k: "strength", label: "Hip thrust est. strength", unit: "lb" })}
      <p className="rounded-2xl bg-surface-2 px-3 py-2 text-sm text-ink-2">
        {finding
          ? `Weeks when your waist trended down while strength held steady averaged about ${fmtNum(finding.avg)} kcal/day (range ${fmtNum(finding.lo)}–${fmtNum(finding.hi)}). These trends occurred during the same period — they don't prove cause and effect.`
          : 'Not enough overlapping data yet to say at what intake your waist trended down while strength held — keep logging and measuring weekly.'}
      </p>
      <p className="text-xs text-ink-3">Range covered: {rangeDates(weeks[0]?.key ?? today, today).length} days.</p>
    </div>
  )
}
