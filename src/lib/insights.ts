// Plain-language insights. Each one is generated only when the data directly supports it, and
// relationships are described as co-occurring, never causal.
import { addDays, toMin, weekday } from './dates'
import { MICRO_INFO, DAY_TYPE_LABEL } from './nutrition'
import { sorted } from './measurements'
import type { DayRow } from './trends'
import { groupEntries } from './trends'
import type { DayType, FoodEntry, ISODate, Measurement, Micro, Recovery, Settings } from './types'
import { MICROS } from './types'
import { mean, round } from './utils'

export interface Insight {
  id: string
  text: string
}

export function insights(p: {
  today: ISODate
  rows: DayRow[] // up to ~90 days, oldest first
  entries: FoodEntry[]
  recovery: Recovery[]
  measurements: Measurement[]
  settings: Settings
}): Insight[] {
  const out: Insight[] = []
  const d30 = addDays(p.today, -29)
  const last30 = p.rows.filter((r) => r.date >= d30 && r.logged)

  if (last30.length >= 7) {
    out.push({ id: 'protein30', text: `Your 30-day average protein is ${Math.round(mean(last30.map((r) => r.protein))!)} g/day (${last30.length} logged days).` })
    const fiber = mean(last30.map((r) => r.fiber))!
    if (fiber < p.settings.targets.default.fiber.min)
      out.push({ id: 'fiber', text: `Fiber averaged ${Math.round(fiber)} g/day, below your usual ${p.settings.targets.default.fiber.min}–${p.settings.targets.default.fiber.max}+ g goal.` })
  }

  const logged = p.rows.filter((r) => r.logged)
  const weekend = logged.filter((r) => [0, 6].includes(weekday(r.date)))
  const weekdays = logged.filter((r) => ![0, 6].includes(weekday(r.date)))
  if (weekend.length >= 3 && weekdays.length >= 6) {
    const diff = mean(weekdays.map((r) => r.protein))! - mean(weekend.map((r) => r.protein))!
    if (diff >= 10) out.push({ id: 'weekend', text: `Protein tends to be lower on weekends (about ${Math.round(diff)} g less than weekdays).` })
  }

  const byType = new Map<DayType, number[]>()
  for (const r of logged) if (r.dayType) byType.set(r.dayType, [...(byType.get(r.dayType) ?? []), r.carbs])
  const types = [...byType.entries()].filter(([, v]) => v.length >= 2)
  if (types.length >= 3) {
    const [top] = types.sort((a, b) => mean(b[1])! - mean(a[1])!)
    out.push({ id: 'carbs', text: `Your average carbohydrate intake is highest on ${DAY_TYPE_LABEL[top[0]]} days (${Math.round(mean(top[1])!)} g).` })
  }

  // Waist change while calories were stable
  const ms = sorted(p.measurements).filter((m) => m.date >= d30 && m.values.waist != null)
  if (ms.length >= 2 && last30.length >= 14) {
    const dw = ms[ms.length - 1].values.waist! - ms[0].values.waist!
    const kcals = last30.map((r) => r.kcal)
    const avg = mean(kcals)!
    const sd = Math.sqrt(mean(kcals.map((k) => (k - avg) ** 2))!)
    if (Math.abs(dw) >= 0.25 && sd < 250) {
      out.push({
        id: 'waist-kcal',
        text: `Your waist ${dw < 0 ? 'decreased' : 'increased'} by ${Math.abs(round(dw, 2))} in during the same period that average calories stayed around ${Math.round(avg).toLocaleString()}.`,
      })
    }
  }

  // Midday meal vs hunger / evening eating — the pattern this app is meant to help with
  const byDate = groupEntries(p.entries)
  const recMap = new Map(p.recovery.map((r) => [r.date, r]))
  const withMid: { hunger?: number; evening: number }[] = []
  const withoutMid: { hunger?: number; evening: number }[] = []
  for (const r of logged) {
    const es = byDate.get(r.date) ?? []
    const mid = es.some((e) => e.meal === 'lunch' || (toMin(e.time) >= 11 * 60 && toMin(e.time) <= 15 * 60 && e.per.kcal * e.qty >= 250))
    const evening = es.filter((e) => toMin(e.time) >= 19 * 60).reduce((a, e) => a + e.per.kcal * e.qty, 0)
    const row = { hunger: recMap.get(r.date)?.hunger, evening }
    ;(mid ? withMid : withoutMid).push(row)
  }
  if (withMid.length >= 3 && withoutMid.length >= 3) {
    const hA = mean(withMid.map((x) => x.hunger).filter((x): x is number => x != null))
    const hB = mean(withoutMid.map((x) => x.hunger).filter((x): x is number => x != null))
    if (hA != null && hB != null && hB - hA >= 0.5) out.push({ id: 'midday-hunger', text: 'Hunger ratings tend to be higher on days without a logged midday meal.' })
    const eA = mean(withMid.map((x) => x.evening))!
    const eB = mean(withoutMid.map((x) => x.evening))!
    if (eB - eA >= 150) out.push({ id: 'midday-evening', text: `On days without a midday meal, you logged about ${Math.round(eB - eA)} more kcal after 7 PM.` })
  }

  // Gap between the first meal and the next
  const gaps: number[] = []
  for (const r of logged) {
    const times = (byDate.get(r.date) ?? []).filter((e) => e.per.kcal * e.qty >= 150).map((e) => toMin(e.time)).sort((a, b) => a - b)
    const uniq = times.filter((t, i) => i === 0 || t - times[i - 1] > 30)
    if (uniq.length >= 2) gaps.push(uniq[1] - uniq[0])
  }
  if (gaps.length >= 7) {
    const g = mean(gaps)!
    if (g >= 300) out.push({ id: 'gap', text: `On average, ${round(g / 60, 1)} hours pass between your first meal and your next one — a midday meal can help keep evenings steadier.` })
  }

  // Recurring micronutrient gaps (weekly average below ~70% of target)
  const last14 = p.rows.filter((r) => r.date >= addDays(p.today, -13) && r.logged)
  if (last14.length >= 7) {
    const low: string[] = []
    for (const m of MICROS as readonly Micro[]) {
      const avg = mean(last14.map((r) => r.micros?.[m] ?? 0))!
      if (avg < p.settings.microTargets[m] * 0.7) low.push(`${MICRO_INFO[m].label} (${round(avg, 1)} ${MICRO_INFO[m].unit})`)
    }
    if (low.length)
      out.push({ id: 'micros', text: `Recurring gaps over the last 2 weeks (from foods with stored micronutrient data): ${low.slice(0, 4).join(', ')}.` })
  }
  return out
}
