import { MEASUREMENT_META } from '../data/baseline'
import type { MeasurementEntry, MeasurementKey, Measurements } from './types'

export interface Ratio {
  id: string
  label: string
  formula: string
  num: MeasurementKey
  den: MeasurementKey
  /** Which direction matches your stated goal (descriptive only — not a score). */
  goal: 'up' | 'down'
}

export const RATIOS: Ratio[] = [
  { id: 'hipWaistW', label: 'Hip width ÷ waist width', formula: 'front view', num: 'hipWidth', den: 'waistWidth', goal: 'up' },
  { id: 'hipWaistC', label: 'Full hip ÷ waist', formula: 'circumference', num: 'hipCirc', den: 'waistCirc', goal: 'up' },
  { id: 'highHipWaistC', label: 'High hip ÷ waist', formula: 'circumference', num: 'highHipCirc', den: 'waistCirc', goal: 'up' },
  { id: 'shoulderHipW', label: 'Shoulder width ÷ hip width', formula: 'front view', num: 'shoulderWidth', den: 'hipWidth', goal: 'down' },
  { id: 'thighWaistC', label: 'Upper thigh ÷ waist', formula: 'circumference', num: 'upperThighCirc', den: 'waistCirc', goal: 'up' },
]

export function ratioValue(m: Measurements, r: Ratio): number | null {
  const a = m[r.num]
  const b = m[r.den]
  return a && b ? a / b : null
}

/** Latest known value per key, carrying older values forward when a field wasn't re-measured. */
export function latestValues(baseline: MeasurementEntry, entries: MeasurementEntry[]): Measurements {
  const out: Measurements = { ...baseline.values }
  for (const e of [...entries].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const [k, v] of Object.entries(e.values)) if (typeof v === 'number' && !Number.isNaN(v)) out[k as MeasurementKey] = v
  }
  return out
}

export function series(baseline: MeasurementEntry, entries: MeasurementEntry[], key: MeasurementKey): { date: string; value: number }[] {
  // Baseline is always the first point; later entries follow in date order.
  return [baseline, ...[...entries].sort((a, b) => a.date.localeCompare(b.date))]
    .filter((e) => typeof e.values[key] === 'number')
    .map((e) => ({ date: e.date, value: e.values[key]! }))
}

export function ratioSeries(baseline: MeasurementEntry, entries: MeasurementEntry[], r: Ratio): { date: string; value: number }[] {
  const sorted = [baseline, ...[...entries].sort((a, b) => a.date.localeCompare(b.date))]
  const acc: Measurements = {}
  const out: { date: string; value: number }[] = []
  for (const e of sorted) {
    Object.assign(acc, e.values)
    const touched = e.values[r.num] !== undefined || e.values[r.den] !== undefined
    const v = ratioValue(acc, r)
    if (touched && v) out.push({ date: e.date, value: v })
  }
  return out
}

type Trend = 'up' | 'down' | 'flat'
const trend = (delta: number, threshold = 0.25): Trend => (delta >= threshold ? 'up' : delta <= -threshold ? 'down' : 'flat')

export interface ProportionReport {
  deltas: Partial<Record<MeasurementKey, number>>
  lines: string[]
  /** Summarised signal for plan-adjustment logic. */
  signals: { waist: Trend; hips: Trend; glutes: Trend; thighs: Trend; shoulders: Trend; highHip: Trend }
}

const fmt = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2).replace(/\.?0+$/, '')} in`

/**
 * Proportion-first analysis: describes how the silhouette relationships are changing
 * relative to the goal. No attractiveness judgments, no scores.
 */
export function proportionReport(baseline: Measurements, current: Measurements): ProportionReport {
  const deltas: Partial<Record<MeasurementKey, number>> = {}
  for (const k of Object.keys(MEASUREMENT_META) as MeasurementKey[]) {
    const a = baseline[k]
    const b = current[k]
    if (typeof a === 'number' && typeof b === 'number') deltas[k] = Math.round((b - a) * 100) / 100
  }
  const d = (k: MeasurementKey) => deltas[k] ?? 0
  const waist = trend(d('waistCirc') || d('waistWidth'), 0.25)
  const hips = trend(d('hipWidth'), 0.2)
  const glutes = trend(d('hipCirc'), 0.25)
  const thighs = trend(d('upperThighCirc'), 0.25)
  const shoulders = trend(d('shoulderWidth'), 0.25)
  const highHip = trend(d('highHipCirc') || d('highHipWidth'), 0.25)

  const lines: string[] = []
  const waistPhrase = waist === 'down' ? 'decreased' : waist === 'up' ? 'increased' : 'stayed stable'

  if (glutes === 'up' || hips === 'up') {
    const parts = [glutes === 'up' ? `glute circumference (${fmt(d('hipCirc'))})` : '', hips === 'up' ? `front hip width (${fmt(d('hipWidth'))})` : ''].filter(Boolean)
    lines.push(
      `Your ${parts.join(' and ')} increased while your waist ${waistPhrase}${waist === 'up' ? '' : ', increasing waist-to-hip contrast'}. ${waist === 'up' ? 'Contrast still depends on the balance of the two — see the ratios.' : 'That direction is consistent with your stated physique goal.'}`,
    )
  } else if (waist === 'down') {
    lines.push(`Your waist decreased (${fmt(d('waistCirc') || d('waistWidth'))}) while hips/glutes held steady, so waist-to-hip contrast increased.`)
  }
  if (thighs === 'up') {
    lines.push(
      `Upper-thigh circumference increased (${fmt(d('upperThighCirc'))})${waist !== 'up' ? ' with a stable-or-smaller waist, adding lower-body width relative to the waist. That supports the lower-body-dominant silhouette you described.' : '. Compare it with the waist change before judging it.'}`,
    )
  }
  if (highHip === 'up') lines.push('High-hip measurement increased — upper/side-glute fullness is filling in the area just below the waist.')
  if (shoulders === 'up') {
    lines.push(`Shoulder width increased (${fmt(d('shoulderWidth'))}). This conflicts with your goal — review direct and indirect shoulder work (see Check-in → Plan review).`)
  } else if (deltas.shoulderWidth !== undefined) {
    lines.push('Shoulder width is stable, which is what you want: lower-body gains are not being offset by a wider upper body.')
  }
  if (waist === 'up' && glutes !== 'up') {
    lines.push('Waist increased without a matching hip/glute increase. Check whether it was measured in a water-retention window before acting on it.')
  }
  if (!lines.length) lines.push('No meaningful change yet. Changes under ~0.25 in are within normal measuring noise — keep measuring the same way and let a few weeks accumulate.')

  return { deltas, lines, signals: { waist, hips, glutes, thighs, shoulders, highHip } }
}
