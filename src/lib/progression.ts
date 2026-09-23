// Double progression: hold the load and add reps until every working set reaches the top of the
// rep range at the planned effort, then add load. Knee discomfort always holds progression.
import type { Exercise, PlannedExercise, SessionExercise, SetLog, WorkoutSession } from './types'
import { round, sum } from './utils'

export interface ExerciseHistoryItem {
  session: WorkoutSession
  ex: SessionExercise
  sets: SetLog[] // completed sets only
}

/** Completed history for an exercise, newest first. */
export function historyFor(exerciseId: string, sessions: WorkoutSession[], excludeSessionId?: string): ExerciseHistoryItem[] {
  const out: ExerciseHistoryItem[] = []
  for (const s of sessions) {
    if (s.id === excludeSessionId) continue
    for (const ex of s.exercises) {
      if (ex.exerciseId !== exerciseId || ex.skipped) continue
      const sets = ex.sets.filter((x) => x.done && x.reps > 0)
      if (sets.length) out.push({ session: s, ex, sets })
    }
  }
  return out.sort((a, b) => b.session.startedAt - a.session.startedAt)
}

export type SuggestionKind = 'start' | 'add-reps' | 'add-load' | 'repeat-effort' | 'hold-pain' | 'reduce' | 'deload-pain'

export interface Suggestion {
  kind: SuggestionKind
  weight: number
  reps: number[] // suggested reps target per set (for auto-fill)
  text: string
}

export const e1rm = (w: number, reps: number) => (reps <= 0 ? 0 : w * (1 + reps / 30))

/** Suggestion for the next session given completed history (newest first). */
export function suggestNext(exercise: Exercise, plan: PlannedExercise, history: ExerciseHistoryItem[]): Suggestion {
  const last = history[0]
  const fill = (_w: number, reps: number) => Array.from({ length: plan.sets }, () => reps)
  if (!last) {
    const b = exercise.baseline
    if (b) {
      const top = b.reps >= plan.repMax
      const w = top ? b.weight + exercise.increment : b.weight
      return {
        kind: top ? 'add-load' : 'add-reps',
        weight: w,
        reps: fill(w, top ? plan.repMin : Math.min(plan.repMax, b.reps)),
        text: top
          ? `Baseline ${b.weight} × ${b.reps} is at the top of the range — try ${w} next.`
          : `Baseline ${b.weight} × ${b.reps}. Keep ${b.weight} and work toward ${plan.repMax} reps on every set.`,
      }
    }
    if (exercise.kind !== 'weighted')
      return { kind: 'start', weight: 0, reps: fill(0, plan.repMin), text: `Aim for ${plan.repMin}–${plan.repMax} controlled reps with about ${plan.rirMin}–${plan.rirMax} in reserve. Add load only if it gets easy.` }
    return {
      kind: 'start',
      weight: 0,
      reps: fill(0, plan.repMin),
      text: `First time: choose a load you can do for ${plan.repMin}–${plan.repMax} reps with about ${plan.rirMin}–${plan.rirMax} reps in reserve.`,
    }
  }

  const sets = last.sets
  const weights = sets.map((s) => s.weight)
  const workW = Math.max(...weights)
  const atWork = sets.filter((s) => s.weight === workW)
  const repsAtWork = atWork.map((s) => s.reps)
  const recentPain = history.slice(0, 3).filter((h) => h.ex.pain).length

  if (exercise.knee && last.ex.pain) {
    if (recentPain >= 2) {
      return {
        kind: 'deload-pain',
        weight: workW,
        reps: fill(workW, plan.repMin),
        text: 'Knee discomfort in recent sessions. Swap to an alternative rather than pushing through it.',
      }
    }
    return {
      kind: 'hold-pain',
      weight: workW,
      reps: repsAtWork.concat(fill(0, plan.repMin)).slice(0, plan.sets),
      text: `You noted knee discomfort last time. Keep ${workW} (or lighter), don't chase reps, and stop the set if it hurts.`,
    }
  }

  const allSetsDone = atWork.length >= plan.sets
  const allTop = allSetsDone && repsAtWork.slice(0, plan.sets).every((r) => r >= plan.repMax)
  const rirs = atWork.map((s) => s.rir).filter((r): r is number => r != null)
  const grinding = rirs.length > 0 && Math.min(...rirs) < plan.rirMin - (plan.rirMin > 0 ? 0 : 1)
  const belowMin = repsAtWork.filter((r) => r < plan.repMin).length

  if (exercise.kind === 'bodyweight' || exercise.increment === 0) {
    return {
      kind: 'add-reps',
      weight: workW,
      reps: fill(workW, Math.min(plan.repMax, Math.max(...repsAtWork) + 1)),
      text: allTop
        ? 'All sets at the top of the range. Add a pause, slower tempo, a harder band, or a little load.'
        : 'Try to add a rep or two, keeping the same clean technique.',
    }
  }

  if (allTop && grinding) {
    return {
      kind: 'repeat-effort',
      weight: workW,
      reps: fill(workW, plan.repMax),
      text: `You reached the top of the range, but closer to failure than planned. Repeat ${workW} at about ${plan.rirMin}–${plan.rirMax} RIR, then increase.`,
    }
  }
  if (allTop) {
    const next = round(workW + exercise.increment, 1)
    return {
      kind: 'add-load',
      weight: next,
      reps: fill(next, plan.repMin),
      text: `Increase the load next session: ${next} (+${exercise.increment}). Reps may drop toward ${plan.repMin} — that's expected.`,
    }
  }

  // Two sessions in a row with most sets under the range → suggest a small reduction.
  const prev = history[1]
  const prevBelow = prev ? prev.sets.filter((s) => s.weight === workW && s.reps < plan.repMin).length : 0
  if (belowMin >= Math.ceil(plan.sets / 2) && prevBelow >= Math.ceil(plan.sets / 2)) {
    const next = Math.max(0, round(workW * 0.92, 0))
    return {
      kind: 'reduce',
      weight: next,
      reps: fill(next, plan.repMin + 1),
      text: `Reps stayed under ${plan.repMin} for two sessions. Try about ${next} and build back up.`,
    }
  }

  const target = repsAtWork.map((r) => Math.min(plan.repMax, r + 1))
  while (target.length < plan.sets) target.push(target[target.length - 1] ?? plan.repMin)
  return {
    kind: 'add-reps',
    weight: workW,
    reps: target.slice(0, plan.sets),
    text: `Keep ${workW} next time and try to add reps (goal: ${plan.sets} × ${plan.repMax}).`,
  }
}

export const volume = (sets: SetLog[]) => sum(sets.filter((s) => s.done).map((s) => s.weight * s.reps))
export const totalReps = (sets: SetLog[]) => sum(sets.filter((s) => s.done).map((s) => s.reps))

/** Human comparison against the previous session, e.g. '+2 total reps vs last session'. */
export function compareToLast(current: SetLog[], last: ExerciseHistoryItem | undefined): string | null {
  const done = current.filter((s) => s.done && s.reps > 0)
  if (!last || !done.length) return null
  const curW = Math.max(...done.map((s) => s.weight))
  const lastW = Math.max(...last.sets.map((s) => s.weight))
  if (curW === lastW) {
    const d = totalReps(done) - totalReps(last.sets)
    if (d === 0) return 'Same total reps as last session'
    return `${d > 0 ? '+' : '−'}${Math.abs(d)} total reps vs last session`
  }
  const dw = round(curW - lastW, 1)
  return `${dw > 0 ? '+' : '−'}${Math.abs(dw)} load vs last session`
}

export interface PR {
  exerciseId: string
  type: 'load' | 'rep'
  weight: number
  reps: number
  text: string
}

/** Load PRs (heaviest completed set ever) and rep PRs (most reps ever at a given load). */
export function findPRs(session: WorkoutSession, allSessions: WorkoutSession[], names: Map<string, string>): PR[] {
  const prs: PR[] = []
  for (const ex of session.exercises) {
    const done = ex.sets.filter((s) => s.done && s.reps > 0)
    if (!done.length) continue
    const hist = historyFor(ex.exerciseId, allSessions, session.id).filter((h) => h.session.startedAt < session.startedAt)
    if (!hist.length) continue
    const prevSets = hist.flatMap((h) => h.sets)
    const name = names.get(ex.exerciseId) ?? ex.exerciseId
    const maxW = Math.max(...done.map((s) => s.weight))
    const prevMaxW = Math.max(...prevSets.map((s) => s.weight))
    if (maxW > prevMaxW && maxW > 0) {
      const reps = Math.max(...done.filter((s) => s.weight === maxW).map((s) => s.reps))
      prs.push({ exerciseId: ex.exerciseId, type: 'load', weight: maxW, reps, text: `${name}: load PR ${maxW} × ${reps}` })
      continue
    }
    const byW = new Map<number, number>()
    for (const s of done) byW.set(s.weight, Math.max(byW.get(s.weight) ?? 0, s.reps))
    for (const [w, reps] of byW) {
      const prevAtW = prevSets.filter((s) => s.weight >= w).map((s) => s.reps)
      if (prevAtW.length && reps > Math.max(...prevAtW)) {
        prs.push({ exerciseId: ex.exerciseId, type: 'rep', weight: w, reps, text: `${name}: rep PR ${reps} reps at ${w}` })
        break
      }
    }
  }
  return prs
}

/** Pain flagged in at least 2 of the last 3 sessions of an exercise. */
export function kneeFlag(exerciseId: string, sessions: WorkoutSession[]): { flagged: boolean; count: number } {
  const recent: SessionExercise[] = []
  const sorted = [...sessions].sort((a, b) => b.startedAt - a.startedAt)
  for (const s of sorted) {
    const ex = s.exercises.find((e) => e.exerciseId === exerciseId && !e.skipped && e.sets.some((x) => x.done))
    if (ex) recent.push(ex)
    if (recent.length === 3) break
  }
  const count = recent.filter((e) => e.pain).length
  return { flagged: count >= 2, count }
}

export function bestE1RM(sets: SetLog[]): number {
  const done = sets.filter((s) => s.done && s.reps > 0 && s.weight > 0)
  return done.length ? Math.max(...done.map((s) => e1rm(s.weight, Math.min(s.reps, 15)))) : 0
}

export function fmtSets(sets: SetLog[]): string {
  return sets.map((s) => `${s.weight} × ${s.reps}`).join(', ')
}
