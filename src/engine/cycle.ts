import type { CycleSettings, CycleSymptoms } from './types'
import { daysBetween, addDays } from './dates'

export type Phase = 'menstrual' | 'follicular' | 'ovulatory' | 'earlyLuteal' | 'lateLuteal' | 'late' | 'hormonal' | 'unknown'

export interface CycleStatus {
  phase: Phase
  cycleDay: number | null
  cycleLength: number
  nextPeriod: string | null
  /** True when water retention commonly inflates waist / lower-stomach measurements and scale weight. */
  retentionWindow: boolean
  /** Best window for "official" comparison measurements and photos. */
  measurementWindow: boolean
}

export const PHASE_LABEL: Record<Phase, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulatory: 'Ovulatory',
  earlyLuteal: 'Early luteal',
  lateLuteal: 'Late luteal (pre-period)',
  late: 'Period later than predicted',
  hormonal: 'Hormonal contraception — symptom-based',
  unknown: 'Log a period start to enable',
}

/** Average of recent observed cycle lengths (ignores implausible gaps), falling back to the setting. */
export function observedCycleLength(settings: CycleSettings): number {
  const starts = [...settings.periodStarts].sort()
  const gaps: number[] = []
  for (let i = 1; i < starts.length; i++) {
    const g = daysBetween(starts[i - 1], starts[i])
    if (g >= 20 && g <= 45) gaps.push(g)
  }
  const recent = gaps.slice(-6)
  if (!recent.length) return settings.cycleLength
  return Math.round(recent.reduce((a, b) => a + b, 0) / recent.length)
}

export function cycleStatus(settings: CycleSettings, date: string): CycleStatus {
  const cycleLength = observedCycleLength(settings)
  const base: CycleStatus = { phase: 'unknown', cycleDay: null, cycleLength, nextPeriod: null, retentionWindow: false, measurementWindow: false }
  if (!settings.enabled) return base
  const last = [...settings.periodStarts].filter((d) => d <= date).sort().pop()
  if (settings.hormonalContraception) {
    const day = last ? daysBetween(last, date) + 1 : null
    return { ...base, phase: 'hormonal', cycleDay: day }
  }
  if (!last) return base

  const day = daysBetween(last, date) + 1
  const nextPeriod = addDays(last, cycleLength)
  const ovulation = cycleLength - 14
  let phase: Phase
  if (day <= settings.periodLength) phase = 'menstrual'
  else if (day < ovulation - 1) phase = 'follicular'
  else if (day <= ovulation + 1) phase = 'ovulatory'
  else if (day <= cycleLength - 6) phase = 'earlyLuteal'
  else if (day <= cycleLength + 3) phase = 'lateLuteal'
  else phase = 'late'

  const retentionWindow = phase === 'lateLuteal' || phase === 'late' || (phase === 'menstrual' && day <= 3)
  const measurementWindow = phase === 'follicular'
  return { phase, cycleDay: day, cycleLength, nextPeriod, retentionWindow, measurementWindow }
}

export type Readiness = 'good' | 'reduced' | 'low'

/** Symptoms drive adjustments; the calendar phase only sets expectations. */
export function readiness(symptoms: CycleSymptoms | undefined): Readiness {
  if (!symptoms) return 'good'
  const flags =
    (symptoms.energy <= 2 ? 1 : 0) +
    (symptoms.cramps >= 2 ? 1 : 0) +
    (symptoms.sleep <= 2 ? 1 : 0) +
    (symptoms.bloating >= 3 ? 1 : 0)
  if (flags >= 2 || symptoms.cramps >= 3) return 'low'
  if (flags === 1) return 'reduced'
  return 'good'
}

export interface CycleGuidance {
  training: string
  nutrition: string
  measurement: string
  knee?: string
  kcalDelta: number
  carbDeltaG: number
  /** If true, the progression engine holds load instead of adding weight today. */
  holdProgression: boolean
  /** Extra reps-in-reserve to add to today's targets. */
  extraRir: number
}

export function cycleGuidance(status: CycleStatus, ready: Readiness): CycleGuidance {
  const g: CycleGuidance = {
    training: 'Train as planned.',
    nutrition: 'Normal targets.',
    measurement: status.measurementWindow
      ? 'Good window for official measurements and progress photos.'
      : 'Measurements are fine to log; compare against the same cycle phase when judging trends.',
    kcalDelta: 0,
    carbDeltaG: 0,
    holdProgression: false,
    extraRir: 0,
  }

  switch (status.phase) {
    case 'menstrual':
      g.training = 'Train as planned if you feel fine. Research does not show a need to skip or deload by default — let symptoms decide.'
      g.nutrition = 'Keep protein steady. Iron-containing foods (red meat, lentils, spinach with vitamin C) are useful this week.'
      break
    case 'follicular':
      g.training = 'Often a good-feeling stretch. If performance is up, it\'s a fine time to push rep targets on hip thrusts and RDLs.'
      break
    case 'ovulatory':
      g.training = 'Train normally.'
      g.knee = 'Some studies find slightly greater knee-ligament laxity around ovulation. Evidence is mixed — just prioritise controlled reps and knee tracking on lunges/split squats; no need to avoid anything.'
      break
    case 'earlyLuteal':
      g.training = 'Train normally. Body temperature is slightly higher, so the same load can feel a bit harder — rate RIR honestly.'
      g.nutrition = 'Energy use rises slightly in the luteal phase. A small bump (~+75 kcal, mostly carbs) is reasonable.'
      g.kcalDelta = 75
      g.carbDeltaG = 15
      break
    case 'lateLuteal':
    case 'late':
      g.training = 'Hard sessions may feel harder. Keep the main glute lifts; it\'s fine to leave an extra rep in reserve.'
      g.nutrition = 'Hunger is often higher. Built in ~+125 kcal (mostly carbs) so you are not fighting your appetite. Keep sodium/water consistent.'
      g.kcalDelta = 125
      g.carbDeltaG = 25
      g.measurement = 'Water retention window: waist, lower stomach and scale weight can read higher (often 0.5–1 in and 1–3 lb). Don\'t judge fat loss from these — compare against the same phase or wait until after your period.'
      break
    case 'hormonal':
      g.training = 'With hormonal contraception, phases don\'t apply in the usual way — adjustments below come only from how you feel.'
      break
    default:
      break
  }

  if (ready === 'reduced') {
    g.training += ' Today: keep the plan but add 1 rep in reserve and don\'t chase a load increase.'
    g.extraRir = 1
    g.holdProgression = true
  } else if (ready === 'low') {
    g.training += ' Today: do the first 2 glute exercises at RIR 2–3, drop 1 set from accessories, and keep deep-core breathing work. A walk counts.'
    g.extraRir = 2
    g.holdProgression = true
  }
  return g
}

/** Average knee score per cycle phase — surfaces whether knee symptoms cluster in a phase. */
export function kneeByPhase(settings: CycleSettings, entries: { date: string; score: number }[]): Partial<Record<Phase, { avg: number; n: number }>> {
  const acc: Partial<Record<Phase, { sum: number; n: number }>> = {}
  for (const e of entries) {
    const p = cycleStatus(settings, e.date).phase
    if (p === 'unknown') continue
    const a = (acc[p] ??= { sum: 0, n: 0 })
    a.sum += e.score
    a.n++
  }
  const out: Partial<Record<Phase, { avg: number; n: number }>> = {}
  for (const [p, a] of Object.entries(acc)) out[p as Phase] = { avg: a!.sum / a!.n, n: a!.n }
  return out
}
