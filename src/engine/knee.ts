import { EXERCISES, getExercise, needsKneeCheck } from '../data/exercises'
import type { AppState, Exercise, KneeCheckin, LowerMuscle, Preference, Slot, WorkoutSession } from './types'
import { daysBetween } from './dates'

export const KNEE_SCALE = [
  '0 — no discomfort',
  '1 — mild awareness',
  '2 — mild discomfort',
  '3 — moderate discomfort',
  '4 — significant discomfort',
  '5 — stop exercise',
]

export type Tolerance = 'untested' | 'good' | 'monitor' | 'avoid'

/** Sessions as the knee engine sees them: knee scores logged before a user-requested retest are dropped. */
export function kneeSessions(state: Pick<AppState, 'sessions' | 'kneeResets'>): WorkoutSession[] {
  const resets = state.kneeResets ?? {}
  if (!Object.keys(resets).length) return state.sessions
  return state.sessions.map((s) => ({
    ...s,
    exercises: s.exercises.map((e) => (resets[e.exerciseId] && s.date < resets[e.exerciseId] ? { ...e, knee: undefined } : e)),
  }))
}

export function kneeHistory(sessions: WorkoutSession[], exerciseId: string): { date: string; knee: number }[] {
  const out: { date: string; knee: number }[] = []
  for (const s of [...sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const e of s.exercises) {
      if (e.exerciseId === exerciseId && typeof e.knee === 'number') out.push({ date: s.date, knee: e.knee })
    }
  }
  return out
}

export function tolerance(sessions: WorkoutSession[], exerciseId: string): Tolerance {
  const h = kneeHistory(sessions, exerciseId).slice(-3).map((x) => x.knee)
  if (!h.length) return 'untested'
  const last = h[h.length - 1]
  const meaningful = h.filter((k) => k >= 3).length
  if (h.some((k) => k >= 4) || meaningful >= 2) return 'avoid'
  const avg = h.reduce((a, b) => a + b, 0) / h.length
  if (last >= 2 || avg >= 1.5) return 'monitor'
  return 'good'
}

export interface KneeRecord {
  exercise: Exercise
  gluteStimulus: string
  quadStimulus: string
  avgKnee: number | null
  lastKnee: number | null
  sessions: number
  preference: Preference
  tolerance: Tolerance
}

/** The "knee-tolerance memory" database view. */
export function kneeMemory(sessions: WorkoutSession[], prefs: Record<string, Preference>): KneeRecord[] {
  return EXERCISES.filter(needsKneeCheck).map((ex) => {
    const h = kneeHistory(sessions, ex.id)
    return {
      exercise: ex,
      gluteStimulus: ex.gluteStimulus,
      quadStimulus: ex.quadStimulus,
      avgKnee: h.length ? h.reduce((a, b) => a + b.knee, 0) / h.length : null,
      lastKnee: h.length ? h[h.length - 1].knee : null,
      sessions: h.length,
      preference: prefs[ex.id] ?? 'neutral',
      tolerance: tolerance(sessions, ex.id),
    }
  })
}

const KNEE_POINTS = { low: 2, moderate: 1, high: 0 } as const
const TOL_POINTS: Record<Tolerance, number> = { good: 2, untested: 0, monitor: -1.5, avoid: -100 }
const PREF_POINTS: Record<Preference, number> = { high: 1.5, neutral: 0, low: -1.5 }

export const MUSCLE_LABEL: Record<LowerMuscle | 'upper', string> = {
  gluteMax: 'glute max',
  upperGlute: 'upper/side glutes',
  hamstrings: 'hamstrings',
  quads: 'quads',
  adductors: 'adductors',
  upper: 'upper body',
}

/** Candidates that preserve the slot's intended muscles, ranked by stimulus match, knee tolerance and preference. */
export function substitutes(
  slot: Slot,
  currentId: string,
  sessions: WorkoutSession[],
  prefs: Record<string, Preference>,
): Exercise[] {
  const current = getExercise(currentId)
  const targets = slot.target
  return EXERCISES.filter((ex) => ex.id !== currentId && ex.shoulderStimulus !== 'high')
    .map((ex) => {
      let match: number
      if (targets === 'upper') {
        match = ex.pattern === current.pattern ? 3 : 0
      } else {
        match = targets.reduce((sum, m) => sum + Math.min(ex.muscles[m] ?? 0, 1), 0) / targets.length
        match = match * 4
      }
      const score = match + KNEE_POINTS[ex.kneeDemand] + TOL_POINTS[tolerance(sessions, ex.id)] + PREF_POINTS[prefs[ex.id] ?? 'neutral']
      return { ex, score, match }
    })
    .filter((c) => c.match >= 2 && c.score > -50)
    .sort((a, b) => b.score - a.score)
    .map((c) => c.ex)
}

export interface Substitution {
  slotId: string
  originalId: string
  replacementId: string
  originalPurpose: string
  why: string
  replacement: string
  stillTrains: string
}

export function explainSubstitution(slot: Slot, originalId: string, replacementId: string, why: string): Substitution {
  const orig = getExercise(originalId)
  const rep = getExercise(replacementId)
  const muscles =
    slot.target === 'upper'
      ? rep.purpose
      : slot.target
          .filter((m) => (rep.muscles[m] ?? 0) > 0)
          .map((m) => `${MUSCLE_LABEL[m]} (${(rep.muscles[m] ?? 0) >= 1 ? 'primary' : 'secondary'})`)
          .join(', ')
  return {
    slotId: slot.slotId,
    originalId,
    replacementId,
    originalPurpose: `${orig.name}: ${slot.slotPurpose}`,
    why,
    replacement: rep.name,
    stillTrains: `${muscles}. Knee demand: ${rep.kneeDemand}.`,
  }
}

export interface ResolvedSlot {
  slot: Slot
  exercise: Exercise
  substitution?: Substitution
}

/**
 * Picks the exercise for a slot: the user's manual choice, or the default — unless knee memory
 * says it repeatedly hurts, in which case a stimulus-preserving substitute is used automatically.
 */
export function resolveSlot(
  slot: Slot,
  manual: Record<string, string>,
  sessions: WorkoutSession[],
  prefs: Record<string, Preference>,
): ResolvedSlot {
  const chosen = manual[slot.slotId] ?? slot.exerciseId
  if (tolerance(sessions, chosen) !== 'avoid') {
    const substitution =
      chosen !== slot.exerciseId ? explainSubstitution(slot, slot.exerciseId, chosen, 'You chose this swap.') : undefined
    return { slot, exercise: getExercise(chosen), substitution }
  }
  const alt = substitutes(slot, chosen, sessions, prefs)[0]
  if (!alt) return { slot, exercise: getExercise(chosen) }
  const h = kneeHistory(sessions, chosen).slice(-3).map((x) => x.knee)
  const why = `Your knee response on ${getExercise(chosen).name} was ${h.join(', ')} (0–5) over recent sessions. It won't be prescribed again unless you retest it (Knees → Retest).`
  return { slot, exercise: alt, substitution: explainSubstitution(slot, chosen, alt.id, why) }
}

export type KneeDayStatus = 'good' | 'mild' | 'modify'

export interface KneeSummary {
  status: KneeDayStatus
  message: string
  seeProfessional: string | null
}

export function kneeSummary(checkins: KneeCheckin[], sessions: WorkoutSession[], today: string): KneeSummary {
  const recentCheckins = checkins.filter((c) => daysBetween(c.date, today) >= 0 && daysBetween(c.date, today) <= 14)
  const recentSession = sessions
    .filter((s) => daysBetween(s.date, today) >= 0 && daysBetween(s.date, today) <= 14)
    .flatMap((s) => s.exercises.filter((e) => typeof e.knee === 'number').map((e) => ({ date: s.date, score: e.knee! })))
  const all = [...recentCheckins.map((c) => ({ date: c.date, score: c.score })), ...recentSession].sort((a, b) => a.date.localeCompare(b.date))

  const latestCheckin = [...recentCheckins].sort((a, b) => a.date.localeCompare(b.date)).pop()
  const recent3 = all.filter((x) => daysBetween(x.date, today) <= 3)
  const maxRecent = Math.max(0, ...recent3.map((x) => x.score), latestCheckin && daysBetween(latestCheckin.date, today) <= 2 ? latestCheckin.score : 0)

  let seeProfessional: string | null = null
  const meaningful = all.filter((x) => x.score >= 3)
  const days = new Set(meaningful.map((x) => x.date))
  const last3 = all.slice(-3).map((x) => x.score)
  const worsening = last3.length === 3 && last3[0] < last3[1] && last3[1] < last3[2] && last3[2] >= 3
  if (recentCheckins.some((c) => c.swelling || c.instability)) {
    seeProfessional = 'Swelling or a feeling of instability should be assessed by a physiotherapist or doctor before continuing knee-dominant training.'
  } else if (all.some((x) => x.score >= 4)) {
    seeProfessional = 'Significant knee discomfort (4–5/5) was logged. If it persists beyond a few days or recurs, get a professional assessment rather than training through it.'
  } else if (days.size >= 3) {
    seeProfessional = 'Moderate knee discomfort on 3+ days in two weeks is persistent. A physiotherapist can assess it — the app will keep substituting knee-friendly options meanwhile.'
  } else if (worsening) {
    seeProfessional = 'Knee scores are trending upward. Consider a professional assessment if this continues.'
  }

  if (maxRecent >= 3) return { status: 'modify', message: 'Modify today: knee-dominant work swapped or reduced; glute work continues through hip-dominant movements.', seeProfessional }
  if (maxRecent >= 1) return { status: 'mild', message: 'Mild symptoms: keep knee-dominant ranges comfortable and loads steady (no increases).', seeProfessional }
  return { status: 'good', message: 'Knees good — train as planned.', seeProfessional }
}
