import type { Exercise, ExerciseLog, Slot, WorkoutSession } from './types'

export type ProgressAction = 'start' | 'addReps' | 'addLoad' | 'hold' | 'reduce'

export interface Target {
  action: ProgressAction
  weight: number | null
  reps: number[]
  rir: [number, number]
  note: string
  last: { date: string; log: ExerciseLog } | null
}

export interface ProgressionContext {
  /** Cycle symptoms, fatigue, or knee status say: don't add load today. */
  holdProgression?: boolean
  holdReason?: string
  extraRir?: number
}

export function lastLog(sessions: WorkoutSession[], exerciseId: string, before?: string): { date: string; log: ExerciseLog } | null {
  const sorted = [...sessions].filter((s) => !before || s.date < before).sort((a, b) => b.date.localeCompare(a.date))
  for (const s of sorted) {
    const log = s.exercises.find((e) => e.exerciseId === exerciseId && e.sets.length > 0)
    if (log) return { date: s.date, log }
  }
  return null
}

const fmtSets = (log: ExerciseLog) => {
  const w = log.sets[0]?.weight ?? 0
  const sameWeight = log.sets.every((s) => s.weight === w)
  return sameWeight
    ? `${w ? `${w} × ` : ''}${log.sets.map((s) => s.reps).join(' / ')}`
    : log.sets.map((s) => `${s.weight}×${s.reps}`).join(', ')
}

export function describeLast(last: Target['last']): string {
  return last ? fmtSets(last.log) : 'No previous session'
}

/**
 * Double progression: add reps within the range until every set reaches the top,
 * then add a small amount of load and restart at the bottom of the range.
 * Knee response, form, recovery and cycle symptoms can all hold progression.
 * Upper-body movements progress conservatively — maintenance is success.
 */
export function computeTarget(
  slot: Slot,
  ex: Exercise,
  sessions: WorkoutSession[],
  today: string,
  ctx: ProgressionContext = {},
): Target {
  const [lo, hi] = slot.repRange
  const extra = ctx.extraRir ?? 0
  const rir: [number, number] = [slot.rir[0] + extra, slot.rir[1] + extra]
  const last = lastLog(sessions, ex.id, today)
  const isUpper = slot.target === 'upper'

  if (!last) {
    return {
      action: 'start', weight: null, reps: Array(slot.sets).fill(lo), rir, last,
      note: `First time: pick a load you can lift for ${lo}–${hi} clean reps with ${rir[0]}–${rir[1]} reps in reserve (RIR = reps you could still do).`,
    }
  }

  const sets = last.log.sets
  const weight = sets[0].weight
  const reps = sets.map((s) => s.reps)
  const padded = Array.from({ length: slot.sets }, (_, i) => reps[i] ?? reps[reps.length - 1] ?? lo)
  const minRir = Math.min(...sets.map((s) => s.rir))
  const knee = last.log.knee ?? 0

  if (knee >= 4) {
    return {
      action: 'reduce', weight: ex.increment ? Math.max(0, Math.round((weight * 0.8) / 5) * 5) : weight, reps: padded.map(() => lo), rir: [rir[0] + 1, rir[1] + 1], last,
      note: `Last time your knee was ${knee}/5. A knee-friendlier substitute is recommended. If you do this movement, use ~80% load, a shorter range, and stop if it hurts.`,
    }
  }
  if (knee === 3) {
    return {
      action: 'hold', weight, reps: padded, rir, last,
      note: 'Knee was 3/5 last time — no progression. Try a shorter range, a different foot position, or swap it.',
    }
  }
  if (knee === 2) {
    return {
      action: 'hold', weight, reps: padded, rir, last,
      note: 'Knee was 2/5 last time — same load and reps. Progress only once it\'s back to 0–1.',
    }
  }
  if (!last.log.formOk) {
    return { action: 'hold', weight, reps: padded, rir, last, note: 'Form wasn\'t solid last time — repeat and own the reps before progressing.' }
  }
  if (ctx.holdProgression) {
    return { action: 'hold', weight, reps: padded, rir, last, note: ctx.holdReason ?? 'Recovery signals say hold today — repeat last session.' }
  }

  const tooHeavy = reps.filter((r) => r < lo).length >= 2
  if (tooHeavy && ex.increment > 0) {
    return {
      action: 'reduce', weight: Math.max(0, weight - ex.increment), reps: padded.map(() => lo), rir, last,
      note: `Most sets fell below ${lo} reps — drop ${ex.increment} lb and rebuild.`,
    }
  }

  const allTop = padded.every((r) => r >= hi)
  // Upper body only moves up when it's clearly easy; glutes/legs move up once the reps are there with honest effort.
  const effortOk = isUpper ? minRir >= 2 : minRir >= Math.max(0, slot.rir[0] - 1)

  if (allTop && effortOk) {
    if (ex.increment === 0) {
      return {
        action: 'addLoad', weight, reps: padded.map(() => lo), rir, last,
        note: 'Top of the range reached — make it harder: slower 3 s lowering, pause, or add a band, then restart at the bottom of the range.',
      }
    }
    const inc = isUpper ? ex.increment / 2 : ex.increment
    return {
      action: 'addLoad', weight: weight + inc, reps: padded.map(() => lo), rir, last,
      note: isUpper
        ? `All sets at ${hi}. Optional small bump (+${inc} lb) — for upper body, staying here is also success.`
        : `All sets hit ${hi} — add ${inc} lb and restart at ${lo} reps.`,
    }
  }

  if (allTop && !effortOk) {
    return { action: 'hold', weight, reps: padded, rir, last, note: 'Reps are there but it was a grind — repeat and aim for the same reps with a bit more in reserve.' }
  }

  if (isUpper) {
    return { action: 'hold', weight, reps: padded, rir, last, note: 'Maintenance: repeat last session. Add a rep only if it feels easy.' }
  }

  const goal = [...padded]
  const i = goal.findIndex((r) => r < hi)
  goal[i] = Math.min(hi, goal[i] + 1)
  return {
    action: 'addReps', weight, reps: goal.map((r) => Math.max(r, lo)), rir, last,
    note: 'Same load — beat last session by at least one rep.',
  }
}

/** Epley estimated 1RM for tracking lower-body strength trends. */
export function e1rm(weight: number, reps: number): number {
  return weight * (1 + reps / 30)
}

export function strengthTrend(sessions: WorkoutSession[], exerciseIds: string[]): { date: string; e1rm: number }[] {
  return [...sessions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((s) => {
      const logs = s.exercises.filter((e) => exerciseIds.includes(e.exerciseId) && e.sets.length)
      if (!logs.length) return []
      const best = Math.max(...logs.flatMap((l) => l.sets.map((st) => e1rm(st.weight, st.reps))))
      return [{ date: s.date, e1rm: Math.round(best) }]
    })
}
