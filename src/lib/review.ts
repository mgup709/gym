// Weekly decision engine. Conservative by design: trends over single weeks, ~3 weeks of data before
// suggesting any calorie change, never automatic changes, and recovery problems always win.
import { addDays, diffDays } from './dates'
import { NOISE, samePhase, sorted } from './measurements'
import { bestE1RM, historyFor } from './progression'
import { recoverySignals, RECOVERY_MESSAGE } from './recovery'
import type { DayRow } from './trends'
import { summarize } from './trends'
import type { CycleDay, ISODate, Measurement, Outcome, Recovery, WeeklyReview, WorkoutSession } from './types'
import { mean, round, slope } from './utils'

export const KEY_LIFTS = ['hip-thrust', 'rdl', 'leg-press', 'bss', 'abduction']

export type Trend = 'up' | 'stable' | 'down' | 'unknown'

export function liftTrend(exerciseId: string, sessions: WorkoutSession[], today: ISODate): { trend: Trend; recent: number; prior: number } {
  const hist = historyFor(exerciseId, sessions)
  const recentFrom = addDays(today, -13)
  const priorFrom = addDays(today, -42)
  const recent = Math.max(0, ...hist.filter((h) => h.session.date >= recentFrom).map((h) => bestE1RM(h.sets)))
  const prior = Math.max(0, ...hist.filter((h) => h.session.date >= priorFrom && h.session.date < recentFrom).map((h) => bestE1RM(h.sets)))
  if (!recent || !prior) return { trend: 'unknown', recent, prior }
  const ch = (recent - prior) / prior
  return { trend: ch > 0.02 ? 'up' : ch < -0.05 ? 'down' : 'stable', recent, prior }
}

export function strengthTrend(sessions: WorkoutSession[], today: ISODate): Trend {
  const ts = KEY_LIFTS.map((id) => liftTrend(id, sessions, today).trend).filter((t) => t !== 'unknown')
  if (!ts.length) return 'unknown'
  const down = ts.filter((t) => t === 'down').length
  const up = ts.filter((t) => t === 'up').length
  if (down > ts.length / 2) return 'down'
  if (up > 0 && down === 0) return 'up'
  return 'stable'
}

/** Measurement trend over the last ~4 weeks: total change and weekly slope. */
export function measureTrend(ms: Measurement[], key: 'waist' | 'belly' | 'hips', today: ISODate) {
  const from = addDays(today, -31)
  const pts = sorted(ms).filter((m) => m.date >= from && m.date <= today && m.values[key] != null)
  if (pts.length < 2) return { change: null as number | null, perWeek: null as number | null, span: 0, n: pts.length }
  const first = pts[0]
  const last = pts[pts.length - 1]
  const s = slope(pts.map((m) => ({ x: diffDays(m.date, first.date) / 7, y: m.values[key]! })))
  return { change: last.values[key]! - first.values[key]!, perWeek: s, span: diffDays(last.date, first.date), n: pts.length }
}

const trendingDown = (t: ReturnType<typeof measureTrend>) =>
  t.change != null && (t.change <= -NOISE || (t.perWeek != null && t.perWeek <= -0.08))

export interface ReviewInput {
  today: ISODate
  measurements: Measurement[]
  current?: Measurement
  retentionWindow: boolean
  cycleDays: CycleDay[]
  recovery: Recovery[]
  sessions: WorkoutSession[]
  rows21: DayRow[] // nutrition, last 21 days
  rows7: DayRow[]
  priorReviews: WeeklyReview[]
  currentKcalMax: number
}

export interface ReviewResult {
  outcome: Outcome
  headline: string
  message: string
  reasons: string[]
  week: { label: string; value: string }[]
  snapshot: WeeklyReview['snapshot']
}

const HEADLINE: Record<Outcome, string> = {
  keep: 'Keep the plan the same',
  reduce: 'Consider a small calorie reduction',
  increase: 'Consider eating a little more',
  hold: 'Hold — possible cycle / bloating effect',
}

function describeLevel(v: number | null | undefined, hard: boolean): string {
  if (v == null) return 'not logged'
  if (hard) return v < 2.5 ? 'low' : v < 3.5 ? 'moderate' : 'high'
  return v < 2.5 ? 'low' : v < 3.5 ? 'okay' : 'good'
}

function fmtDelta(d: number | null | undefined): string {
  if (d == null) return '—'
  if (Math.abs(d) < NOISE) return 'unchanged'
  return `${d > 0 ? '+' : '−'}${Math.abs(round(d, 2))} in`
}

export function weeklyReview(i: ReviewInput): ReviewResult {
  const reasons: string[] = []
  const ms = sorted(i.measurements)
  const cur = i.current ?? ms.filter((m) => m.date <= i.today).pop()
  const prev = cur ? [...ms].reverse().find((m) => m.date < cur.date && diffDays(cur.date, m.date) >= 4) : undefined
  const d = (k: 'waist' | 'belly' | 'hips') => (cur?.values[k] != null && prev?.values[k] != null ? cur.values[k]! - prev.values[k]! : null)
  const dWaist = d('waist')
  const dBelly = d('belly')
  const dHips = d('hips')

  const rec = recoverySignals(i.recovery, i.today)
  const strength = strengthTrend(i.sessions, i.today)
  const waistT = measureTrend(ms, 'waist', i.today)
  const bellyT = measureTrend(ms, 'belly', i.today)
  const hipsT = measureTrend(ms, 'hips', i.today)
  const n21 = summarize(i.rows21)
  const n7 = summarize(i.rows7)
  const visualTighter = cur?.visualWaist === 'tighter'
  const hipsShrinking = hipsT.change != null && hipsT.change <= -0.5 && hipsT.span >= 14 && !i.retentionWindow

  const bloatNear = cur
    ? i.cycleDays.some((c) => Math.abs(diffDays(c.date, cur.date)) <= 1 && (c.bloating ?? 0) >= 2)
    : false
  const suddenUp = (dWaist != null && dWaist >= NOISE) || (dBelly != null && dBelly >= NOISE)
  const bigJump = (dWaist != null && dWaist >= 0.5) || (dBelly != null && dBelly >= 0.5)

  // THIS WEEK summary
  const ht = historyFor('hip-thrust', i.sessions)
  let htText = '—'
  if (ht.length >= 2 && ht[0].session.date >= addDays(i.today, -7)) {
    const [a, b] = ht
    const wa = Math.max(...a.sets.map((s) => s.weight))
    const wb = Math.max(...b.sets.map((s) => s.weight))
    if (wa === wb) {
      const diff = a.sets.reduce((x, s) => x + s.reps, 0) - b.sets.reduce((x, s) => x + s.reps, 0)
      htText = diff === 0 ? 'same reps' : `${diff > 0 ? '+' : '−'}${Math.abs(diff)} reps`
    } else htText = `${wa > wb ? '+' : '−'}${Math.abs(round(wa - wb, 1))} lb load`
  }
  const week = [
    { label: 'Waist', value: fmtDelta(dWaist) },
    { label: 'Belly button', value: fmtDelta(dBelly) },
    { label: 'Hips', value: fmtDelta(dHips) },
    { label: 'Hip thrust', value: htText },
    { label: 'Average protein', value: n7.protein != null ? `${Math.round(n7.protein)} g` : '—' },
    { label: 'Average calories', value: n7.kcal != null ? `${Math.round(n7.kcal).toLocaleString()}` : '—' },
    { label: 'Hunger', value: describeLevel(rec.recent.hunger, true) },
    { label: 'Energy', value: describeLevel(rec.recent.energy, false) },
  ]
  const snapshot: WeeklyReview['snapshot'] = {
    dWaist,
    dBelly,
    dHips,
    waist4w: waistT.change,
    belly4w: bellyT.change,
    hips4w: hipsT.change,
    strength,
    kcal7: n7.kcal,
    protein7: n7.protein,
    kcal21: n21.kcal,
    protein21: n21.protein,
    hunger: rec.recent.hunger ?? null,
    energy: rec.recent.energy ?? null,
    cycleDay: cur?.cycleDay ?? null,
  }

  const done = (outcome: Outcome, message: string): ReviewResult => ({ outcome, headline: HEADLINE[outcome], message, reasons, week, snapshot })

  // 1. Recovery / performance problems take priority and don't need 3 weeks of data.
  const increaseSignals = [...rec.signals]
  if (strength === 'down') increaseSignals.push('Key lifts have trended down over the last few weeks')
  if (hipsShrinking) increaseSignals.push(`Hip/glute measurement is down ${Math.abs(round(hipsT.change!, 2))} in over ~4 weeks`)
  if (rec.concern || increaseSignals.length >= 2 || hipsShrinking) {
    reasons.push(...increaseSignals)
    return done('increase', `${RECOVERY_MESSAGE} Your current intake may be too aggressive for your recomp goal — consider increasing intake slightly (for example +100–150 kcal/day, mostly from carbs around training).`)
  }

  // 2. Cycle / bloating hold
  if (cur && suddenUp && (i.retentionWindow || bloatNear)) {
    reasons.push(i.retentionWindow ? `Measured on cycle day ${cur.cycleDay ?? '?'} — a common water-retention window` : 'Bloating logged around measurement day')
    const same = samePhase(ms, cur)
    if (same?.values.waist != null && cur.values.waist != null)
      reasons.push(`Same-phase comparison (cycle day ${same.cycleDay}): waist ${fmtDelta(cur.values.waist - same.values.waist)}`)
    return done('hold', "Cycle-related water retention may be affecting this week's measurements. Do not change calories based on this week alone.")
  }
  if (cur && bigJump) {
    reasons.push('A sudden jump of 0.5 in or more in a single week is usually water, digestion or tape placement')
    return done('hold', 'One unusual measurement is not a trend. Keep everything the same and re-measure next week under similar conditions.')
  }

  // 3. Enough data?
  const span = waistT.span
  if (span < 18 || waistT.n < 3) {
    reasons.push(`Measurement history covers ${span} days — about 3 weeks are needed before judging trends`)
    if (n7.protein != null && n7.protein < 125) reasons.push(`Protein averaged ${Math.round(n7.protein)} g — consistency here is the most useful focus`)
    return done('keep', 'Keep nutrition and training the same while the trend builds.')
  }

  const waistDown = trendingDown(waistT) || visualTighter
  const bellyDown = trendingDown(bellyT)
  const hipsOk = hipsT.change == null || hipsT.change > -NOISE

  if ((waistDown || bellyDown) && hipsOk && strength !== 'down') {
    if (waistT.change != null) reasons.push(`Waist ${fmtDelta(waistT.change)} over ~4 weeks`)
    if (bellyT.change != null) reasons.push(`Belly button ${fmtDelta(bellyT.change)} over ~4 weeks`)
    if (visualTighter) reasons.push('Midsection looks tighter to you')
    reasons.push(`Hips ${fmtDelta(hipsT.change)} · strength ${strength === 'unknown' ? 'not enough data' : strength}`)
    return done('keep', 'Progress looks aligned with your goal. Keep nutrition and training the same.')
  }

  // 4. Stalled — only suggest a reduction when everything else is going well.
  const recentReduce = i.priorReviews.some((r) => r.outcome === 'reduce' && diffDays(i.today, r.date) < 21)
  const hungerOk = (rec.recent.hunger ?? 3) <= 3.5
  const recoveryOk = rec.signals.length === 0
  const perfOk = strength !== 'down'
  const adherent = n21.logged >= 10 && n21.kcal != null
  const aboveRange = n21.kcal != null && n21.kcal > i.currentKcalMax + 75
  reasons.push(`Waist ${fmtDelta(waistT.change)} and belly button ${fmtDelta(bellyT.change)} over ~4 weeks`)
  if (cur?.visualWaist && cur.visualWaist !== 'tighter') reasons.push(`Midsection looks ${cur.visualWaist === 'unsure' ? 'about the same (unsure)' : cur.visualWaist} to you`)

  if (!adherent) {
    reasons.push(`Food was logged on ${n21.logged} of the last 21 days — not enough to judge intake`)
    return done('keep', 'Keep the plan the same. Log most days for a couple of weeks so the trend is reliable before changing anything.')
  }
  if (aboveRange) {
    reasons.push(`Average intake was ${Math.round(n21.kcal!)} kcal — above the planned range`)
    return done('keep', 'Keep the targets as they are — intake has been running above the planned range, so the plan itself hasn’t been tested yet.')
  }
  if (recentReduce) {
    reasons.push('A reduction was suggested within the last 3 weeks — give it time')
    return done('keep', 'Keep the plan the same and give the last change at least 3 weeks.')
  }
  if (!(hungerOk && recoveryOk && perfOk)) {
    reasons.push('Hunger, recovery or performance is not clearly good right now')
    return done('keep', 'Keep the plan the same. A reduction only makes sense when hunger, recovery and performance are all good.')
  }
  if (i.currentKcalMax - 150 < 1750) {
    reasons.push('Targets are already near a conservative floor for your training load')
    return done('keep', 'Keep intake where it is. Focus on training progression, protein, fiber and consistency rather than eating less.')
  }
  reasons.push('Performance is stable, hunger is manageable and recovery looks good')
  return done('reduce', 'Consider reducing intake by about 100–150 kcal/day — mostly from carbs on rest/upper days or from sauces and oils. Nothing changes unless you apply it.')
}

export const OUTCOME_TONE: Record<Outcome, string> = {
  keep: 'Steady',
  reduce: 'Small adjustment',
  increase: 'Support recovery',
  hold: 'Hold',
}

export function avgOrNull(xs: (number | null | undefined)[]) {
  return mean(xs.filter((x): x is number => x != null))
}
