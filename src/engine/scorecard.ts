import { getExercise } from '../data/exercises'
import { WEEKLY_TARGETS } from '../data/program'
import type { LowerMuscle, Muscle, WorkoutSession, KneeCheckin } from './types'
import { addDays, weekStart } from './dates'

export type Coverage = 'below' | 'on' | 'above'

export interface Scorecard {
  weekOf: string
  sets: Record<Muscle, number>
  coverage: Record<LowerMuscle, Coverage>
  deepCoreSessions: number
  shoulder: { directSets: number; overhead: boolean; status: 'maintenance only' | 'review' }
  knee: 'Good' | 'Monitor' | 'Needs modification' | 'No data'
  lowerWidthNote: string
}

/** A set counts as "effective" when taken reasonably close to failure (≤ 4 reps in reserve). */
export const isEffective = (rir: number) => rir <= 4

const empty = (): Record<Muscle, number> => ({
  gluteMax: 0, upperGlute: 0, hamstrings: 0, quads: 0, adductors: 0, deltoids: 0, traps: 0, back: 0, chest: 0, arms: 0,
})

export function weeklyScorecard(sessions: WorkoutSession[], checkins: KneeCheckin[], anyDay: string): Scorecard {
  const start = weekStart(anyDay)
  const end = addDays(start, 6)
  const week = sessions.filter((s) => s.date >= start && s.date <= end)
  const sets = empty()
  let overhead = false
  let deepCoreSessions = 0
  const kneeScores: number[] = []

  for (const s of week) {
    if (s.core.some((c) => c.completed)) deepCoreSessions++
    for (const log of s.exercises) {
      const ex = getExercise(log.exerciseId)
      if (ex.id === 'overheadPress') overhead = true
      const effective = log.sets.filter((st) => isEffective(st.rir)).length
      for (const [m, credit] of Object.entries(ex.muscles)) sets[m as Muscle] += effective * (credit ?? 0)
      if (typeof log.knee === 'number') kneeScores.push(log.knee)
    }
  }
  for (const c of checkins) if (c.date >= start && c.date <= end) kneeScores.push(c.score)

  const coverage = {} as Record<LowerMuscle, Coverage>
  for (const [m, [lo, hi]] of Object.entries(WEEKLY_TARGETS)) {
    const v = sets[m as LowerMuscle]
    coverage[m as LowerMuscle] = v < lo ? 'below' : v > hi ? 'above' : 'on'
  }

  const knee: Scorecard['knee'] = !kneeScores.length
    ? 'No data'
    : kneeScores.some((k) => k >= 3)
      ? 'Needs modification'
      : kneeScores.some((k) => k >= 2) || kneeScores.filter((k) => k >= 1).length >= 3
        ? 'Monitor'
        : 'Good'

  const directDelt = Math.round(sets.deltoids * 10) / 10
  const shoulderReview = directDelt > 3 || overhead || sets.traps > 0

  const widthMuscles: LowerMuscle[] = ['upperGlute', 'gluteMax', 'quads', 'adductors']
  const low = widthMuscles.filter((m) => coverage[m] === 'below')
  const lowerWidthNote = !week.length
    ? 'No sessions logged this week yet.'
    : low.length
      ? `So far this week, ${low.map((m) => WIDTH_LABEL[m]).join(', ')} ${low.length > 1 ? 'are' : 'is'} below target — the remaining sessions cover it if completed.`
      : 'All muscles that add visual lower-body width are covered this week.'

  return {
    weekOf: start,
    sets,
    coverage,
    deepCoreSessions,
    shoulder: { directSets: directDelt, overhead, status: shoulderReview ? 'review' : 'maintenance only' },
    knee,
    lowerWidthNote,
  }
}

const WIDTH_LABEL: Record<LowerMuscle, string> = {
  gluteMax: 'glute max',
  upperGlute: 'upper/side glutes',
  hamstrings: 'hamstrings',
  quads: 'quads',
  adductors: 'adductors',
}

/** Planned (not logged) weekly volume, used by the Lower-Body Width Engine to audit the program itself. */
export function plannedVolume(slots: { exerciseId: string; sets: number }[]): Record<Muscle, number> {
  const sets = empty()
  for (const s of slots) {
    const ex = getExercise(s.exerciseId)
    for (const [m, credit] of Object.entries(ex.muscles)) sets[m as Muscle] += s.sets * (credit ?? 0)
  }
  return sets
}
