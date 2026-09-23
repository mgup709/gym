// Menstrual-cycle context. Used only to add context (never to judge) — especially to avoid reading
// premenstrual / menstrual water retention as fat gain.
import { addDays, diffDays } from './dates'
import type { CycleDay, ISODate, Settings } from './types'

const BLEED = new Set(['light', 'medium', 'heavy'])

/** Period start dates, from logged flow days plus the start date set in Settings. */
export function periodStarts(days: CycleDay[], settings: Settings): ISODate[] {
  const bleeding = new Set(days.filter((d) => d.flow && BLEED.has(d.flow)).map((d) => d.date))
  const starts = new Set<ISODate>()
  for (const d of [...bleeding].sort()) {
    let prior = false
    for (let i = 1; i <= 5; i++) if (bleeding.has(addDays(d, -i))) prior = true
    if (!prior) starts.add(d)
  }
  if (settings.cycle.lastStart) {
    const ls = settings.cycle.lastStart
    if (![...starts].some((s) => Math.abs(diffDays(s, ls)) <= 5)) starts.add(ls)
  }
  return [...starts].sort()
}

export interface CycleInfo {
  day: number
  length: number
  estimated: boolean // no logged start in the current cycle — projected
  phase: 'menstrual' | 'follicular' | 'ovulatory' | 'luteal' | 'premenstrual'
  label: string
  retention: boolean // window where water retention / bloating is common
}

export function cycleInfo(date: ISODate, starts: ISODate[], settings: Settings): CycleInfo | null {
  if (!settings.cycle.enabled) return null
  const prior = starts.filter((s) => s <= date)
  if (!prior.length) return null
  const length = averageLength(starts) ?? settings.cycle.length
  const start = prior[prior.length - 1]
  let day = diffDays(date, start) + 1
  let estimated = false
  if (day > length + 7) {
    day = ((day - 1) % length) + 1
    estimated = true
  }
  const ov = length - 14
  const phase: CycleInfo['phase'] =
    day <= settings.cycle.periodLength
      ? 'menstrual'
      : day >= length - 4
        ? 'premenstrual'
        : Math.abs(day - ov) <= 1
          ? 'ovulatory'
          : day < ov
            ? 'follicular'
            : 'luteal'
  const label = { menstrual: 'Period', follicular: 'Follicular', ovulatory: 'Around ovulation', luteal: 'Luteal', premenstrual: 'Premenstrual' }[phase]
  return { day, length, estimated, phase, label, retention: day <= 3 || day >= length - 5 }
}

export function averageLength(starts: ISODate[]): number | null {
  const gaps: number[] = []
  for (let i = 1; i < starts.length; i++) {
    const g = diffDays(starts[i], starts[i - 1])
    if (g >= 20 && g <= 45) gaps.push(g)
  }
  if (gaps.length < 2) return null
  return Math.round(gaps.slice(-6).reduce((a, b) => a + b, 0) / Math.min(6, gaps.length))
}

export function cycleLengths(starts: ISODate[]): { start: ISODate; length: number }[] {
  const out: { start: ISODate; length: number }[] = []
  for (let i = 1; i < starts.length; i++) out.push({ start: starts[i - 1], length: diffDays(starts[i], starts[i - 1]) })
  return out
}
