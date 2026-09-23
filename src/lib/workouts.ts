import { db } from './db'
import { ensureDay } from './repo'
import { findPRs, historyFor, suggestNext, volume, type PR } from './progression'
import type { Exercise, ISODate, PlannedExercise, SessionExercise, WorkoutSession, WorkoutTemplate } from './types'
import { uid } from './utils'

export function buildSessionExercise(ex: Exercise, plan: PlannedExercise, sessions: WorkoutSession[], excludeId?: string): SessionExercise {
  const sug = suggestNext(ex, plan, historyFor(ex.id, sessions, excludeId))
  const sets = Array.from({ length: plan.sets }, (_, i) => ({
    weight: sug.weight,
    reps: ex.kind === 'cardio' ? 0 : (sug.reps[i] ?? plan.repMin),
    rir: null,
    done: false,
    minutes: ex.kind === 'cardio' ? plan.repMin : undefined,
  }))
  return { exerciseId: ex.id, plan, sets }
}

export async function startSession(template: WorkoutTemplate, date: ISODate): Promise<WorkoutSession> {
  const active = await db.sessions.where('status').equals('active').first()
  if (active) return active
  await ensureDay(date)
  const [exercises, sessions] = await Promise.all([db.exercises.toArray(), db.sessions.toArray()])
  const exMap = new Map(exercises.map((e) => [e.id, e]))
  const session: WorkoutSession = {
    id: uid(),
    date,
    templateId: template.id,
    dayType: template.dayType,
    name: template.name,
    startedAt: Date.now(),
    status: 'active',
    exercises: template.exercises
      .filter((p) => exMap.has(p.exerciseId))
      .map((p) => buildSessionExercise(exMap.get(p.exerciseId)!, p, sessions)),
    extras: template.dayType === 'glute' ? { dance: false } : undefined,
  }
  await db.sessions.put(session)
  return session
}

/** Swap an exercise within a session (keeps the plan), optionally making it permanent in the template. */
export async function swapExercise(session: WorkoutSession, index: number, newId: string, permanent: boolean) {
  const [exercises, sessions] = await Promise.all([db.exercises.toArray(), db.sessions.toArray()])
  const ex = exercises.find((e) => e.id === newId)
  if (!ex) return
  const old = session.exercises[index]
  const next = { ...buildSessionExercise(ex, old.plan, sessions, session.id), swappedFrom: old.exerciseId }
  next.plan = { ...old.plan, exerciseId: newId }
  const exs = [...session.exercises]
  exs[index] = next
  await db.sessions.put({ ...session, exercises: exs })
  if (permanent) {
    const t = await db.templates.get(session.templateId)
    if (t) {
      await db.templates.put({
        ...t,
        exercises: t.exercises.map((p) => (p.exerciseId === old.exerciseId ? { ...p, exerciseId: newId } : p)),
      })
    }
  }
}

export interface SessionSummary {
  durationMs: number
  exercisesDone: number
  totalSets: number
  volume: number
  prs: PR[]
  next: { name: string; text: string }[]
}

export function summarizeSession(session: WorkoutSession, allSessions: WorkoutSession[], exercises: Exercise[]): SessionSummary {
  const names = new Map(exercises.map((e) => [e.id, e.name]))
  const exMap = new Map(exercises.map((e) => [e.id, e]))
  const others = allSessions.filter((s) => s.id !== session.id)
  const withThis = [...others, session]
  const done = session.exercises.filter((e) => e.sets.some((s) => s.done))
  return {
    durationMs: (session.endedAt ?? Date.now()) - session.startedAt,
    exercisesDone: done.length,
    totalSets: done.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0),
    volume: done.reduce((a, e) => a + volume(e.sets), 0),
    prs: findPRs(session, others, names),
    next: done
      .filter((e) => exMap.has(e.exerciseId))
      .map((e) => ({
        name: names.get(e.exerciseId)!,
        text: suggestNext(exMap.get(e.exerciseId)!, e.plan, historyFor(e.exerciseId, withThis)).text,
      })),
  }
}

export async function finishSession(session: WorkoutSession) {
  await db.sessions.put({ ...session, status: 'done', endedAt: session.endedAt ?? Date.now() })
}
