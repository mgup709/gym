import type { AppState, WeeklyCheckin } from './types'
import { latestValues, proportionReport } from './proportions'
import { strengthTrend } from './progression'
import { weeklyScorecard } from './scorecard'
import { cycleStatus } from './cycle'
import { addDays, daysBetween } from './dates'
import { averageTargets } from './nutrition'

export type Verdict = 'working' | 'lowerNotGrowing' | 'shoulders' | 'waistUp' | 'tooEarly' | 'steady'

export interface ReviewItem {
  factor: string
  status: 'ok' | 'check' | 'unknown'
  detail: string
}

export interface PlanReview {
  verdict: Verdict
  headline: string
  actions: string[]
  checklist: ReviewItem[]
}

const G = ['hipThrust', 'smithHipThrust', 'bStanceThrust', 'gluteBridge']
const H = ['rdl', 'dbRdl']

function strengthUp(state: AppState, today: string): boolean | null {
  const t = strengthTrend(state.sessions, [...G, ...H]).filter((p) => daysBetween(p.date, today) <= 42)
  if (t.length < 3) return null
  return t[t.length - 1].e1rm > t[0].e1rm
}

/**
 * Plan-adjustment logic. Defaults to stability: the program should run long enough to measure.
 */
export function reviewPlan(state: AppState, today: string): PlanReview {
  const weeksOfData = state.measurements.length ? daysBetween(state.baseline.date, [...state.measurements].sort((a, b) => a.date.localeCompare(b.date)).pop()!.date) / 7 : 0
  const current = latestValues(state.baseline, state.measurements)
  const report = proportionReport(state.baseline.values, current)
  const s = report.signals
  const up = strengthUp(state, today)
  const lastCheckins = [...state.checkins].sort((a, b) => a.date.localeCompare(b.date)).slice(-3)
  const shoulderFlag = s.shoulders === 'up' || lastCheckins.some((c) => c.shoulderLooksBigger)
  const latestMeasure = [...state.measurements].sort((a, b) => a.date.localeCompare(b.date)).pop()
  const inRetention = latestMeasure && state.cycle.enabled && cycleStatus(state.cycle, latestMeasure.date).retentionWindow

  // 35. Shoulders appear to be growing → immediate review.
  if (shoulderFlag) {
    return {
      verdict: 'shoulders',
      headline: 'Shoulder growth flagged — reducing upper-body hypertrophy stimulus.',
      actions: shoulderActions(state, today),
      checklist: [],
    }
  }

  if (weeksOfData < 4) {
    return {
      verdict: 'tooEarly',
      headline: 'Keep the program stable. Measurement trends need ~4–6 weeks before they mean much.',
      actions: [
        'Measure priority sites weekly, same time of day and same method.',
        state.cycle.enabled ? 'Use the follicular-phase measurement as your monthly "official" comparison.' : 'Measure at the same point each week (e.g. Friday morning).',
        'Keep progressing hip thrusts and RDLs with double progression.',
      ],
      checklist: [],
    }
  }

  // 33. Everything moving the right way → change nothing.
  const lowerOk = s.glutes !== 'down' && s.thighs !== 'down' && s.hips !== 'down'
  if (s.waist !== 'up' && lowerOk && up !== false && (s.waist === 'down' || s.glutes === 'up' || s.hips === 'up' || s.thighs === 'up')) {
    return {
      verdict: 'working',
      headline: 'The program appears to be working. Continue progressing — no calorie cuts, no exercise changes.',
      actions: [
        'Do not reduce calories: the waist is moving while lower-body size holds or grows.',
        'Keep the same exercises so progress stays measurable.',
        'Keep adding reps/load on glute lifts.',
      ],
      checklist: [],
    }
  }

  if (s.waist === 'up' && s.glutes !== 'up') {
    return {
      verdict: 'waistUp',
      headline: inRetention
        ? 'Waist is up, but the latest measurement fell in a water-retention window — re-measure after your period before changing anything.'
        : 'Waist is trending up without matching glute/hip gains.',
      actions: inRetention
        ? ['Re-measure in the follicular phase.', 'No plan changes yet.']
        : ['Check calorie adherence and weekend intake first.', 'If adherence is good and the trend holds 3+ weeks, reduce ~100–150 kcal/day from fat (keep carbs around lower-body sessions).', 'Keep protein steady.'],
      checklist: [],
    }
  }

  // 34. Lower body not growing → evaluate in order; do not just add volume.
  if (s.glutes !== 'up' && s.hips !== 'up' && s.thighs !== 'up') {
    return {
      verdict: 'lowerNotGrowing',
      headline: 'Lower-body measurements are flat. Work through the checklist in order — adding lots of volume is the last resort, not the first.',
      actions: ['Fix the first "check" item before changing anything else.'],
      checklist: lowerChecklist(state, today, up, lastCheckins),
    }
  }

  return { verdict: 'steady', headline: 'Mixed but stable signals. Hold the plan steady and re-assess in 2 weeks.', actions: [], checklist: [] }
}

function shoulderActions(state: AppState, today: string): string[] {
  const card = weeklyScorecard(state.sessions, state.kneeCheckins, today)
  const out = [
    `Direct deltoid work this week: ${card.shoulder.directSets} effective sets (target: ~0).`,
    card.shoulder.overhead ? 'Overhead pressing was logged — remove it.' : 'No overhead pressing logged — good.',
    'No lateral raises or shrugs are programmed. Remove any you added.',
    'Indirect: drop the chest press to 1 set or swap to push-ups at RIR 3, and keep rows/pulldowns without shrugging.',
    'Upper-body loads are frozen — no progression on upper-body exercises until shoulders are stable for 4 weeks.',
    'Re-measure shoulders with the same method: arms relaxed, same posture, same photo distance. A 0.25 in change can be measurement noise.',
  ]
  return out
}

function lowerChecklist(state: AppState, today: string, strengthIsUp: boolean | null, recent: WeeklyCheckin[]): ReviewItem[] {
  const since = addDays(today, -28)
  const sessions = state.sessions.filter((s) => s.date >= since)
  const lowerSessions = sessions.filter((s) => ['glutesHams', 'glutesThighs', 'lowerAccessory'].includes(s.dayType))
  const card = weeklyScorecard(state.sessions, state.kneeCheckins, addDays(today, -7))
  const allSets = lowerSessions.flatMap((s) => s.exercises.flatMap((e) => e.sets))
  const avgRir = allSets.length ? allSets.reduce((a, s) => a + s.rir, 0) / allSets.length : null
  const avg = (f: (c: WeeklyCheckin) => number) => (recent.length ? recent.reduce((a, c) => a + f(c), 0) / recent.length : null)
  const protein = avg((c) => c.proteinHit)
  const adherence = avg((c) => c.calorieAdherence)
  const sleep = avg((c) => c.sleepHours)
  const fatigue = avg((c) => c.fatigue)
  const completion = avg((c) => c.completion)
  const carbs = recent.length ? recent.filter((c) => c.carbsAroundTraining).length / recent.length : null
  const targets = averageTargets(state.profile)

  const item = (factor: string, ok: boolean | null, good: string, bad: string): ReviewItem => ({
    factor, status: ok === null ? 'unknown' : ok ? 'ok' : 'check', detail: ok === null ? 'Not enough data logged.' : ok ? good : bad,
  })

  return [
    item('1. Training progression', strengthIsUp, 'Glute-lift strength is trending up.', 'Hip thrust / RDL estimated strength is flat — review double progression and effort.'),
    item('2. Effective weekly volume', lowerSessions.length ? card.coverage.gluteMax !== 'below' && card.coverage.upperGlute !== 'below' : null, 'Glute and side-glute volume are on target.', 'Glute or side-glute sets fell below target last week — complete planned sessions before adding sets.'),
    item('3. Proximity to failure', avgRir === null ? null : avgRir <= 2.5, `Average RIR ${avgRir?.toFixed(1)} — close enough to failure.`, `Average RIR ${avgRir?.toFixed(1)} — most hypertrophy sets should end at 0–2 RIR.`),
    item('4. Exercise selection', card.knee === 'Needs modification' ? false : true, 'Exercises are tolerated.', 'Knee issues may be limiting effort — use the substitution engine to keep stimulus high.'),
    item('5. Protein intake', protein === null ? null : protein >= 5, 'Protein hit most days.', `Protein target hit only ~${protein?.toFixed(0)} days/week.`),
    item('6. Calorie availability', adherence === null ? null : state.profile.goalMode !== 'gentleCut' || adherence < 4, 'Energy intake is not overly restrictive.', 'A deficit may be limiting growth — consider switching to recomp or maintenance for 6–8 weeks.'),
    item('7. Carbs around training', carbs === null ? null : carbs >= 0.67, 'Carbs are there around lower-body sessions.', 'Carbohydrate around lower-body sessions is often missing — prioritise the pre-workout and post-workout meals.'),
    item('8. Sleep', sleep === null ? null : sleep >= 7, `~${sleep?.toFixed(1)} h average.`, `~${sleep?.toFixed(1)} h average — under 7 h blunts recovery.`),
    item('9. Recovery', fatigue === null ? null : fatigue <= 3, 'Fatigue manageable.', 'Fatigue is high — more volume would likely make this worse.'),
    item('10. Consistency', completion === null ? null : completion >= 80, `${completion?.toFixed(0)}% of sessions completed.`, `${completion?.toFixed(0)}% completion — consistency comes before any program change.`),
    ...(targets ? [] : [{ factor: 'Nutrition setup', status: 'unknown' as const, detail: 'Add your weight and age in Settings so calorie availability can be checked.' }]),
  ]
}
