import { DAY_PLANS } from '../data/program'
import { CORE_BY_ID, CORE_SESSION } from '../data/core'
import { needsKneeCheck } from '../data/exercises'
import type { AppState, CoreLog, DayPlan, DayType } from './types'
import { explainSubstitution, kneeSessions, kneeSummary, resolveSlot, substitutes, type ResolvedSlot, type KneeSummary } from './knee'
import { computeTarget, describeLast, type Target } from './progression'
import { cycleGuidance, cycleStatus, readiness, type CycleGuidance, type CycleStatus } from './cycle'
import { weekday } from './dates'
import { applyCycle, averageTargets, dayTargets, mealPlan, type Macros, type Meal } from './nutrition'

export interface PlannedExercise extends ResolvedSlot {
  target: Target
  lastText: string
  kneeCheck: boolean
}

export interface CorePlanItem {
  moveId: string
  level: number
  levelName: string
  prescription: string
  cue: string
  note?: string
}

export interface TodayPlan {
  date: string
  day: DayPlan
  exercises: PlannedExercise[]
  core: CorePlanItem[]
  knee: KneeSummary
  cycle: CycleStatus
  cycleGuide: CycleGuidance
  macros: Macros | null
  meals: Meal[]
}

export function dayTypeFor(state: AppState, date: string): DayType {
  return state.profile.schedule[weekday(date)]
}

/**
 * Deep-core progression is gated on quality: advance after two consecutive sessions with
 * control ≥ 4, breathing ≥ 4 and a neutral low back; regress one level if position or breathing breaks down.
 */
export function coreLevelAdvice(state: AppState, moveId: string): { level: number; note?: string } {
  const level = state.coreLevels[moveId] ?? 0
  const logs: CoreLog[] = [...state.sessions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((s) => s.core.filter((c) => c.moveId === moveId && c.completed && c.level === level))
  const last2 = logs.slice(-2)
  const max = CORE_BY_ID[moveId].levels.length - 1
  if (last2.length === 2 && last2.every((c) => c.control >= 4 && c.breathing >= 4 && c.lumbarNeutral) && level < max) {
    return { level, note: 'Ready to progress: two quality sessions in a row. Tap "Level up" when you start.' }
  }
  const last = logs[logs.length - 1]
  if (last && (!last.lumbarNeutral || last.breathing < 3)) {
    return { level, note: 'Last time the low back lifted or breathing broke down — stay here (or step back a level) until it feels controlled.' }
  }
  return { level }
}

export function coreSessionFor(state: AppState, date: string): CorePlanItem[] {
  const idx = Math.floor(Date.parse(date) / 86_400_000) % CORE_SESSION.length
  return CORE_SESSION[idx].map((id) => {
    const adv = coreLevelAdvice(state, id)
    const lvl = CORE_BY_ID[id].levels[adv.level]
    return { moveId: id, level: adv.level, levelName: lvl.name, prescription: lvl.prescription, cue: lvl.cue, note: adv.note }
  })
}

export function buildToday(state: AppState, date: string, dayOverride?: DayType): TodayPlan {
  const type = dayOverride ?? dayTypeFor(state, date)
  const day = DAY_PLANS[type]
  const knee = kneeSummary(state.kneeCheckins, state.sessions, date)
  const cycle = cycleStatus(state.cycle, date)
  const cycleGuide = cycleGuidance(cycle, readiness(state.cycle.enabled ? state.cycle.symptoms[date] : undefined))

  const kSessions = kneeSessions(state)
  const exercises: PlannedExercise[] = day.slots.map((slot) => {
    let resolved = resolveSlot(slot, state.substitutions, kSessions, state.preferences)
    // Knee flare-up today → swap knee-dominant movements for low-knee-demand ones that keep the stimulus.
    if (knee.status === 'modify' && resolved.exercise.kneeDemand !== 'low') {
      const alt = substitutes(slot, resolved.exercise.id, kSessions, state.preferences).find((e) => e.kneeDemand === 'low')
      if (alt) {
        resolved = {
          slot,
          exercise: alt,
          substitution: explainSubstitution(slot, resolved.exercise.id, alt.id, 'Your knee check-in today says modify — knee-dominant work is swapped for today only.'),
        }
      }
    }
    const holdKnee = knee.status === 'mild' && resolved.exercise.kneeDemand !== 'low'
    const target = computeTarget(slot, resolved.exercise, state.sessions, date, {
      holdProgression: cycleGuide.holdProgression || holdKnee,
      holdReason: holdKnee ? 'Mild knee symptoms today — same load and reps as last time.' : 'Symptoms today — repeat last session rather than adding load.',
      extraRir: cycleGuide.extraRir,
    })
    return { ...resolved, target, lastText: describeLast(target.last), kneeCheck: needsKneeCheck(resolved.exercise) }
  })

  const avg = averageTargets(state.profile)
  const macros = avg ? applyCycle(dayTargets(avg, state.profile.schedule, type), cycleGuide.kcalDelta, cycleGuide.carbDeltaG) : null

  return {
    date,
    day,
    exercises,
    core: day.deepCore ? coreSessionFor(state, date) : [],
    knee,
    cycle,
    cycleGuide,
    macros,
    meals: mealPlan(type, state.profile.trainingTime),
  }
}
