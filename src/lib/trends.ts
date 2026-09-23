// Nutrition history: daily rows, moving averages, weekly/monthly aggregation and summaries.
// Days with no entries (or marked incomplete) are "not logged" and never count as zero.
import { addDays, monthKey, rangeDates, weekStart } from './dates'
import { band, carbRange, dayTotals, type DayTotals } from './nutrition'
import type { DayLog, DayTargets, DayType, FoodEntry, ISODate, Micro } from './types'
import { MICROS } from './types'
import { mean } from './utils'

export interface DayRow extends DayTotals {
  date: ISODate
  logged: boolean
  excluded: boolean
  dayType: DayType | null
  targets: DayTargets | null
}

export type NutrientKey = 'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber' | Micro

export function valueOf(r: DayRow, k: NutrientKey): number {
  if ((MICROS as readonly string[]).includes(k)) return r.micros?.[k as Micro] ?? 0
  return r[k as 'kcal']
}

export function groupEntries(entries: FoodEntry[]): Map<ISODate, FoodEntry[]> {
  const m = new Map<ISODate, FoodEntry[]>()
  for (const e of entries) {
    const arr = m.get(e.date)
    if (arr) arr.push(e)
    else m.set(e.date, [e])
  }
  return m
}

export function dailyRows(from: ISODate, to: ISODate, days: DayLog[], entries: FoodEntry[]): DayRow[] {
  const byDate = groupEntries(entries)
  const dayMap = new Map(days.map((d) => [d.date, d]))
  return rangeDates(from, to).map((date) => {
    const es = byDate.get(date) ?? []
    const d = dayMap.get(date)
    const excluded = !!d?.excluded
    return {
      date,
      ...dayTotals(es),
      logged: es.length > 0 && !excluded,
      excluded,
      dayType: d?.dayType ?? null,
      targets: d?.targets ?? null,
    }
  })
}

/** Trailing moving average over calendar days, using logged days only. */
export function movingAverage(rows: DayRow[], k: NutrientKey, window: number, minDays = Math.ceil(window / 3)): (number | null)[] {
  return rows.map((_, i) => {
    const vals: number[] = []
    for (let j = Math.max(0, i - window + 1); j <= i; j++) if (rows[j].logged) vals.push(valueOf(rows[j], k))
    return vals.length >= minDays ? mean(vals) : null
  })
}

export function targetRange(r: DayRow, k: NutrientKey): [number, number] | null {
  if (!r.targets) return null
  const t = r.targets
  switch (k) {
    case 'kcal':
      return [t.kcal.min, t.kcal.max]
    case 'protein':
      return [t.protein.min, t.protein.max]
    case 'fat':
      return [t.fat.min, t.fat.max]
    case 'carbs': {
      const c = carbRange(t)
      return [c.min, c.max]
    }
    case 'fiber':
      return [t.fiber.min, t.fiber.max]
    default:
      return null
  }
}

export interface Bucket {
  key: string // week start or month
  from: ISODate
  to: ISODate
  logged: number
  avg: Partial<Record<NutrientKey, number>>
  target: [number, number] | null
}

export function aggregate(rows: DayRow[], by: 'week' | 'month', keys: NutrientKey[]): Bucket[] {
  const groups = new Map<string, DayRow[]>()
  for (const r of rows) {
    const key = by === 'week' ? weekStart(r.date) : monthKey(r.date)
    const g = groups.get(key)
    if (g) g.push(r)
    else groups.set(key, [r])
  }
  return [...groups.entries()].map(([key, rs]) => {
    const logged = rs.filter((r) => r.logged)
    const avg: Bucket['avg'] = {}
    for (const k of keys) {
      const m = mean(logged.map((r) => valueOf(r, k)))
      if (m != null) avg[k] = m
    }
    const ranges = logged.map((r) => targetRange(r, keys[0])).filter((x): x is [number, number] => !!x)
    const target: [number, number] | null = ranges.length
      ? [mean(ranges.map((x) => x[0]))!, mean(ranges.map((x) => x[1]))!]
      : null
    return { key, from: rs[0].date, to: rs[rs.length - 1].date, logged: logged.length, avg, target }
  })
}

export interface MonthSummary {
  month: string
  logged: number
  kcal: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
  fiber: number | null
  proteinHit: number | null // share of logged days with protein ≥ that day's minimum
  kcalWithin: number | null // share of logged days within that day's calorie range
  byType: Partial<Record<DayType, { n: number; kcal: number; protein: number; carbs: number; fat: number }>>
}

export function summarize(rows: DayRow[]): Omit<MonthSummary, 'month'> {
  const logged = rows.filter((r) => r.logged)
  const withT = logged.filter((r) => r.targets)
  const byType: MonthSummary['byType'] = {}
  for (const r of logged) {
    if (!r.dayType) continue
    const b = byType[r.dayType] ?? { n: 0, kcal: 0, protein: 0, carbs: 0, fat: 0 }
    b.n++
    b.kcal += r.kcal
    b.protein += r.protein
    b.carbs += r.carbs
    b.fat += r.fat
    byType[r.dayType] = b
  }
  for (const b of Object.values(byType)) {
    if (!b) continue
    b.kcal /= b.n
    b.protein /= b.n
    b.carbs /= b.n
    b.fat /= b.n
  }
  return {
    logged: logged.length,
    kcal: mean(logged.map((r) => r.kcal)),
    protein: mean(logged.map((r) => r.protein)),
    carbs: mean(logged.map((r) => r.carbs)),
    fat: mean(logged.map((r) => r.fat)),
    fiber: mean(logged.map((r) => r.fiber)),
    proteinHit: withT.length ? withT.filter((r) => r.protein >= r.targets!.protein.min).length / withT.length : null,
    kcalWithin: withT.length ? withT.filter((r) => band(r.kcal, r.targets!.kcal) === 'within').length / withT.length : null,
    byType,
  }
}

export function monthlySummaries(rows: DayRow[]): MonthSummary[] {
  const groups = new Map<string, DayRow[]>()
  for (const r of rows) {
    const k = monthKey(r.date)
    const g = groups.get(k)
    if (g) g.push(r)
    else groups.set(k, [r])
  }
  return [...groups.entries()]
    .map(([month, rs]) => ({ month, ...summarize(rs) }))
    .filter((m) => m.logged > 0)
    .sort((a, b) => (a.month < b.month ? 1 : -1))
}

// ── Frequently eaten ─────────────────────────────────────

export interface Frequent {
  foodId: string
  name: string
  last7: number
  last30: number
  nearNow: number
  score: number
}

export function frequentFoods(entries: FoodEntry[], today: ISODate, nowMin: number): Frequent[] {
  const d7 = addDays(today, -6)
  const d30 = addDays(today, -29)
  const m = new Map<string, Frequent>()
  for (const e of entries) {
    if (!e.foodId || e.date < d30 || e.date > today) continue
    const f = m.get(e.foodId) ?? { foodId: e.foodId, name: e.name, last7: 0, last30: 0, nearNow: 0, score: 0 }
    f.last30++
    if (e.date >= d7) f.last7++
    const [h, mm] = e.time.split(':').map(Number)
    if (Math.abs(h * 60 + mm - nowMin) <= 120) f.nearNow++
    m.set(e.foodId, f)
  }
  for (const f of m.values()) f.score = f.last7 * 2 + f.last30 + f.nearNow * 1.5
  return [...m.values()].sort((a, b) => b.score - a.score)
}

export function recentFoods(entries: FoodEntry[], limit = 12): { foodId: string; name: string; at: number }[] {
  const seen = new Set<string>()
  const out: { foodId: string; name: string; at: number }[] = []
  for (const e of [...entries].sort((a, b) => b.createdAt - a.createdAt)) {
    if (!e.foodId || seen.has(e.foodId)) continue
    seen.add(e.foodId)
    out.push({ foodId: e.foodId, name: e.name, at: e.createdAt })
    if (out.length >= limit) break
  }
  return out
}
