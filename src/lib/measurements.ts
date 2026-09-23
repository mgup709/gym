import { addDays, diffDays, monthKey } from './dates'
import type { ISODate, MeasureKey, Measurement } from './types'

export const MEASURE_LABEL: Record<MeasureKey, string> = {
  waist: 'Smallest waist',
  belly: 'Belly button / lower stomach',
  hips: 'Full hips / glutes',
  highHip: 'High hip',
  bust: 'Bust',
  underbust: 'Underbust / ribcage',
  upperThigh: 'Upper thigh',
  midThigh: 'Mid-thigh',
  calf: 'Calf',
  wWaist: 'Smallest waist (front width)',
  wBelly: 'Belly button (front width)',
  wHighHip: 'High hip (front width)',
  wHips: 'Full hips (front width)',
  wShoulders: 'Shoulders (front width)',
  wBust: 'Bust (front width)',
  wRibcage: 'Ribcage (front width)',
  wUpperThigh: 'Upper thigh (front width)',
  wCalf: 'Calf (front width)',
}

export const SHORT_LABEL: Partial<Record<MeasureKey, string>> = {
  waist: 'Waist',
  belly: 'Belly button',
  hips: 'Hips',
  highHip: 'High hip',
  wWaist: 'Waist width',
  wBelly: 'Belly width',
  wHighHip: 'High-hip width',
  wHips: 'Hip width',
}

/** Changes smaller than this are within normal tape-measure noise. */
export const NOISE = 0.25

export interface Ratios {
  whr: number | null
  bhr: number | null
  diff: number | null
  widthDiff: number | null
}

export function ratios(v: Measurement['values']): Ratios {
  return {
    whr: v.waist && v.hips ? v.waist / v.hips : null,
    bhr: v.belly && v.hips ? v.belly / v.hips : null,
    diff: v.waist && v.hips ? v.hips - v.waist : null,
    widthDiff: v.wWaist && v.wHips ? v.wHips - v.wWaist : null,
  }
}

export function sorted(ms: Measurement[]): Measurement[] {
  return [...ms].sort((a, b) => (a.date === b.date ? (a.baseline ? -1 : 1) : a.date < b.date ? -1 : 1))
}

/** Latest known value of a key at or before `m` (optional measures aren't taken every week). */
export function valueAt(ms: Measurement[], m: Measurement, k: MeasureKey): number | undefined {
  const list = sorted(ms).filter((x) => x.date <= m.date)
  for (let i = list.length - 1; i >= 0; i--) if (list[i].values[k] != null) return list[i].values[k]
  return undefined
}

export interface Comparisons {
  baseline?: Measurement
  lastWeek?: Measurement
  fourWeeks?: Measurement
  monthStart?: Measurement
}

export function comparisons(ms: Measurement[], current: Measurement): Comparisons {
  const list = sorted(ms).filter((m) => m.id !== current.id && m.date <= current.date)
  const baseline = list.find((m) => m.baseline) ?? list[0]
  const lastWeek = [...list].reverse().find((m) => diffDays(current.date, m.date) >= 4)
  const target = addDays(current.date, -28)
  const near = list
    .filter((m) => Math.abs(diffDays(m.date, target)) <= 7)
    .sort((a, b) => Math.abs(diffDays(a.date, target)) - Math.abs(diffDays(b.date, target)))
  const monthStart = list.find((m) => monthKey(m.date) === monthKey(current.date))
  return { baseline, lastWeek, fourWeeks: near[0], monthStart }
}

export function describeChange(delta: number | null | undefined): 'down' | 'up' | 'unchanged' | null {
  if (delta == null) return null
  if (Math.abs(delta) < NOISE) return 'unchanged'
  return delta < 0 ? 'down' : 'up'
}

/** A previous measurement from a similar cycle phase (cycle day within ±3, at least 3 weeks earlier). */
export function samePhase(ms: Measurement[], current: Measurement): Measurement | undefined {
  if (current.cycleDay == null) return undefined
  return sorted(ms)
    .reverse()
    .find(
      (m) =>
        m.id !== current.id &&
        m.cycleDay != null &&
        diffDays(current.date, m.date) >= 21 &&
        Math.abs(m.cycleDay - current.cycleDay!) <= 3,
    )
}

export function isMeasurementWeek(ms: Measurement[], date: ISODate): boolean {
  const last = sorted(ms).filter((m) => !m.baseline).pop()
  return !last || diffDays(date, last.date) >= 6
}
