import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, ArrowLeftRight, Check, ChevronLeft, ChevronRight, Info, Minus, Plus, Timer, Trophy } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { StrengthChart } from '@/components/charts/StrengthChart'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, Empty, Pill, Section } from '@/components/ui/card'
import { Chip } from '@/components/ui/controls'
import { NumInput, Select, Textarea } from '@/components/ui/input'
import { Sheet } from '@/components/ui/sheet'
import { toast } from '@/components/ui/toast'
import { DAY_NAMES, fmtDate, fmtDuration, weekday } from '@/lib/dates'
import { db } from '@/lib/db'
import { navigate, useRoute, useSettings, useToday } from '@/lib/hooks'
import { bestE1RM, compareToLast, fmtSets, historyFor, kneeFlag, suggestNext } from '@/lib/progression'
import { readW, showW } from '@/lib/units'
import type { Exercise, SessionExercise, Settings, WorkoutSession, WorkoutTemplate } from '@/lib/types'
import { cn, fmtNum } from '@/lib/utils'
import { finishSession, startSession, summarizeSession, swapExercise } from '@/lib/workouts'

export function WorkoutView() {
  const route = useRoute()
  if (route.path[1] === 'session') return <SessionView id={route.path[2]} />
  if (route.path[1] === 'summary') return <SummaryView id={route.path[2]} />
  if (route.path[1] === 'exercise') return <ExerciseHistoryView id={route.path[2]} />
  return <WorkoutHome />
}

const fmtRest = (p: { restMin: number; restMax: number }) => {
  if (!p.restMin) return null
  const f = (s: number) => (s % 60 === 0 ? `${s / 60}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`)
  return p.restMin === p.restMax ? `rest ~${f(p.restMin)} min` : `rest ${f(p.restMin)}–${f(p.restMax)} min`
}
const fmtRIR = (p: { rirMin: number; rirMax: number }) => (p.rirMin === p.rirMax ? `~${p.rirMin} RIR` : `${p.rirMin}–${p.rirMax} RIR`)

function WorkoutHome() {
  const settings = useSettings()
  const today = useToday()
  const templates = useLiveQuery(() => db.templates.toArray(), [])
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
  const sessions = useLiveQuery(() => db.sessions.orderBy('date').reverse().toArray(), [])
  const day = useLiveQuery(() => db.days.get(today), [today])
  const [preview, setPreview] = useState<WorkoutTemplate | null>(null)
  const [exId, setExId] = useState('hip-thrust')

  if (!settings || !templates || !exercises || !sessions) return null
  const exMap = new Map(exercises.map((e) => [e.id, e]))
  const scheduledId = settings.schedule[weekday(today)]
  const todayT = day?.dayType
    ? day.dayType === 'rest'
      ? null
      : (templates.find((t) => t.id === scheduledId && t.dayType === day.dayType) ?? templates.find((t) => t.dayType === day.dayType))
    : templates.find((t) => t.id === scheduledId)
  const active = sessions.find((s) => s.status === 'active')
  const done = sessions.filter((s) => s.status === 'done')
  const recentPRs = done.slice(0, 12).flatMap((s) => summarizeSession(s, sessions, exercises).prs.map((p) => ({ ...p, date: s.date })))

  const start = async (t: WorkoutTemplate) => {
    await startSession(t, today)
    navigate('workout/session')
  }

  return (
    <div className="space-y-4">
      <header className="pt-2">
        <p className="text-sm text-ink-3">{DAY_NAMES[weekday(today)]}</p>
        <h1 className="font-display text-4xl leading-tight">Workout</h1>
      </header>

      {active && (
        <Card className="border-accent/40 bg-accent-soft/40">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">In progress</div>
              <div className="text-sm text-ink-2">{active.name}</div>
            </div>
            <Button onClick={() => navigate('workout/session')}>Continue</Button>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Today's plan" />
        {todayT ? (
          <div className="space-y-3">
            <div>
              <div className="font-display text-xl">{todayT.name}</div>
              <div className="text-sm text-ink-3">{todayT.goal}</div>
            </div>
            <ul className="divide-y divide-border">
              {todayT.exercises.map((p, i) => {
                const ex = exMap.get(p.exerciseId)
                if (!ex) return null
                const sug = suggestNext(ex, p, historyFor(ex.id, sessions))
                return (
                  <li key={i} className="py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium">
                        {ex.name}
                        {p.optional && <span className="font-normal text-ink-3"> · optional</span>}
                      </span>
                      <span className="shrink-0 text-xs text-ink-3">
                        {p.sets} × {p.repMin}–{p.repMax}
                        {ex.perLeg ? '/leg' : ''}
                      </span>
                    </div>
                    <div className="text-xs text-ink-2">{sug.text}</div>
                  </li>
                )
              })}
            </ul>
            {todayT.finisher && <p className="text-sm text-sage">{todayT.finisher}</p>}
            {!active && (
              <Button className="w-full" size="lg" onClick={() => start(todayT)}>
                Start workout
              </Button>
            )}
          </div>
        ) : (
          <p className="text-sm text-ink-2">Rest day. You can still start any session below if your week shifted.</p>
        )}
      </Card>

      <Section title="Weekly program" subtitle="Monday–Friday · tap to preview or start">
        <ul className="divide-y divide-border">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => {
            const t = templates.find((x) => x.id === settings.schedule[d])
            return (
              <li key={d}>
                <button className="flex w-full items-center justify-between gap-2 py-2.5 text-left" onClick={() => t && setPreview(t)} disabled={!t}>
                  <span className="w-12 text-sm text-ink-3">{DAY_NAMES[d].slice(0, 3)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{t ? t.name : 'Rest'}</span>
                  {t && <ChevronRight className="size-4 text-ink-3" />}
                </button>
              </li>
            )
          })}
        </ul>
        <p className="text-xs text-ink-3">Edit the program (exercises, sets, rep ranges) in Settings → Training program.</p>
      </Section>

      <Section title="Strength" subtitle="Estimated strength from your best set each session" defaultOpen>
        <Select value={exId} onChange={(e) => setExId(e.target.value)}>
          {exercises
            .filter((e) => e.kind === 'weighted')
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
        </Select>
        <StrengthChart exerciseId={exId} sessions={sessions} />
        <Button variant="outline" size="sm" className="w-full" onClick={() => navigate(`workout/exercise/${exId}`)}>
          Full set history <ChevronRight className="size-4" />
        </Button>
      </Section>

      <Section title="Personal records" subtitle="Load PRs and rep PRs from recent sessions">
        {recentPRs.length === 0 ? (
          <Empty>PRs show up here once you have a couple of sessions logged.</Empty>
        ) : (
          <ul className="space-y-1.5">
            {recentPRs.map((p, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <Trophy className="size-4 text-amber" />
                <span className="flex-1">{p.text}</span>
                <span className="text-xs text-ink-3">{fmtDate(p.date)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Workout history" subtitle={`${done.length} sessions`}>
        {done.length === 0 ? (
          <Empty>Completed workouts appear here.</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {done.slice(0, 60).map((s) => {
              const sets = s.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0)
              return (
                <li key={s.id}>
                  <button className="flex w-full items-center justify-between gap-2 py-2.5 text-left" onClick={() => navigate(`workout/summary/${s.id}`)}>
                    <div className="min-w-0">
                      <div className="truncate text-sm">{s.name}</div>
                      <div className="text-xs text-ink-3">
                        {fmtDate(s.date, { weekday: 'short', month: 'short', day: 'numeric' })} · {sets} sets
                        {s.endedAt ? ` · ${fmtDuration(s.endedAt - s.startedAt)}` : ''}
                      </div>
                    </div>
                    <ChevronRight className="size-4 text-ink-3" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Section>

      <Section title="Exercise history">
        <ul className="divide-y divide-border">
          {exercises
            .filter((e) => historyFor(e.id, sessions).length > 0)
            .map((e) => (
              <li key={e.id}>
                <button className="flex w-full items-center justify-between py-2.5 text-left text-sm" onClick={() => navigate(`workout/exercise/${e.id}`)}>
                  {e.name}
                  <span className="flex items-center gap-1 text-xs text-ink-3">
                    {historyFor(e.id, sessions).length} sessions <ChevronRight className="size-4" />
                  </span>
                </button>
              </li>
            ))}
        </ul>
        {!exercises.some((e) => historyFor(e.id, sessions).length > 0) && <Empty>Your set history builds as you log workouts.</Empty>}
      </Section>

      <Sheet
        open={!!preview}
        onClose={() => setPreview(null)}
        title={preview?.name}
        footer={
          !active && preview ? (
            <Button className="w-full" onClick={() => start(preview)}>
              Start this workout today
            </Button>
          ) : undefined
        }
      >
        {preview && (
          <div className="space-y-3">
            <p className="text-sm text-ink-3">{preview.goal}</p>
            {preview.exercises.map((p, i) => {
              const ex = exMap.get(p.exerciseId)
              return (
                <div key={i} className="rounded-2xl bg-surface-2/60 p-3">
                  <div className="text-sm font-medium">
                    {i + 1}. {ex?.name}
                    {p.optional && <span className="font-normal text-ink-3"> · optional</span>}
                  </div>
                  <div className="text-xs text-ink-2">
                    {p.sets} sets × {p.repMin}–{p.repMax}
                    {ex?.perLeg ? ' per leg' : ''} · {fmtRIR(p)} {fmtRest(p) && `· ${fmtRest(p)}`}
                  </div>
                  {p.note && <div className="text-xs text-ink-3">{p.note}</div>}
                </div>
              )
            })}
            {preview.finisher && <p className="text-sm text-sage">{preview.finisher}</p>}
          </div>
        )}
      </Sheet>
    </div>
  )
}

// ── Session logging ──────────────────────────────────────

function useRestTimer() {
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!endsAt) return
    const id = setInterval(() => {
      const n = Date.now()
      setNow(n)
      if (n >= endsAt) {
        try {
          navigator.vibrate?.([200, 100, 200])
        } catch {
          /* ignore */
        }
        setEndsAt(null)
      }
    }, 500)
    return () => clearInterval(id)
  }, [endsAt])
  return {
    left: endsAt ? Math.max(0, Math.round((endsAt - now) / 1000)) : null,
    start: (sec: number) => {
      setNow(Date.now())
      setEndsAt(Date.now() + sec * 1000)
    },
    add: (sec: number) => setEndsAt((e) => (e ? e + sec * 1000 : e)),
    stop: () => setEndsAt(null),
  }
}

function SessionView({ id }: { id?: string }) {
  const settings = useSettings()
  const session = useLiveQuery(() => (id ? db.sessions.get(id) : db.sessions.where('status').equals('active').first()), [id])
  const all = useLiveQuery(() => db.sessions.toArray(), [])
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
  const rest = useRestTimer()
  const [elapsed, setElapsed] = useState(0)
  const [swap, setSwap] = useState<number | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setElapsed(Date.now()), 15000)
    return () => clearInterval(t)
  }, [])

  const exMap = useMemo(() => new Map((exercises ?? []).map((e) => [e.id, e])), [exercises])
  if (session === undefined || !all || !exercises || !settings) return null
  if (!session)
    return (
      <div className="space-y-4 pt-6">
        <Empty>No workout in progress.</Empty>
        <Button variant="outline" onClick={() => navigate('workout')}>
          Back to Workout
        </Button>
      </div>
    )

  const editingDone = session.status === 'done'
  const put = (s: WorkoutSession) => db.sessions.put(s)
  const updateEx = (i: number, patch: Partial<SessionExercise>) => put({ ...session, exercises: session.exercises.map((e, j) => (j === i ? { ...e, ...patch } : e)) })
  const minutes = Math.round(((editingDone ? session.endedAt! : elapsed || Date.now()) - session.startedAt) / 60000)

  const finish = async () => {
    if (editingDone) {
      navigate(`workout/summary/${session.id}`, true)
      return
    }
    await finishSession(session)
    navigate(`workout/summary/${session.id}`, true)
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-30 -mx-4 border-b border-border bg-bg/90 px-4 pt-3 pb-3 backdrop-blur-lg">
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => navigate('workout')} className="-ml-2 rounded-full p-2 text-ink-3" aria-label="Back">
            <ChevronLeft className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{session.name}</div>
            <div className="text-xs text-ink-3">{editingDone ? `Editing · ${fmtDate(session.date)}` : `${minutes} min`}</div>
          </div>
          <Button size="sm" onClick={finish}>
            {editingDone ? 'Done' : 'Finish'}
          </Button>
        </div>
        {rest.left != null && (
          <div className="mt-2 flex items-center justify-between rounded-2xl bg-sage-soft px-3 py-2 text-sage">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Timer className="size-4" /> Rest {Math.floor(rest.left / 60)}:{String(rest.left % 60).padStart(2, '0')}
            </span>
            <span className="flex gap-1">
              <Button size="xs" variant="ghost" onClick={() => rest.add(30)}>
                +30s
              </Button>
              <Button size="xs" variant="ghost" onClick={rest.stop}>
                Skip
              </Button>
            </span>
          </div>
        )}
      </div>

      {session.exercises.map((se, i) => {
        const ex = exMap.get(se.exerciseId)
        if (!ex) return null
        return (
          <ExerciseCard
            key={`${se.exerciseId}-${i}`}
            se={se}
            ex={ex}
            session={session}
            all={all}
            settings={settings}
            onChange={(patch) => updateEx(i, patch)}
            onSetDone={() => se.plan.restMin && rest.start(se.plan.restMin)}
            onSwap={() => setSwap(i)}
            exMap={exMap}
          />
        )
      })}

      {session.dayType === 'glute' && (
        <Card>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={!!session.extras?.dance} onChange={(e) => put({ ...session, extras: { ...session.extras, dance: e.target.checked } })} />
            Salsa / bachata tonight (logged as activity only — no calorie estimate)
          </label>
        </Card>
      )}

      <Card>
        <div className="mb-1.5 text-sm font-medium">Session notes</div>
        <Textarea key={session.id} defaultValue={session.note ?? ''} onBlur={(e) => put({ ...session, note: e.target.value || undefined })} placeholder="How did it feel?" />
      </Card>

      <div className="flex gap-2">
        {!editingDone && (
          <Button variant="ghost" className="text-ink-3" onClick={() => setConfirmDiscard(true)}>
            Discard
          </Button>
        )}
        <Button className="flex-1" size="lg" onClick={finish}>
          {editingDone ? 'Save changes' : 'Finish workout'}
        </Button>
      </div>

      <SwapSheet
        open={swap != null}
        onClose={() => setSwap(null)}
        current={swap != null ? exMap.get(session.exercises[swap].exerciseId) : undefined}
        exercises={exercises}
        onPick={async (newId, permanent) => {
          await swapExercise(session, swap!, newId, permanent)
          toast(permanent ? 'Swapped here and in your program' : 'Swapped for this session')
          setSwap(null)
        }}
      />
      <Sheet
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title="Discard this workout?"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmDiscard(false)}>
              Keep
            </Button>
            <Button
              className="flex-1"
              onClick={async () => {
                const copy = session
                await db.sessions.delete(session.id)
                navigate('workout', true)
                toast('Workout discarded', () => db.sessions.put(copy).then(() => undefined))
              }}
            >
              Discard
            </Button>
          </div>
        }
      >
        <p className="text-sm text-ink-2">Logged sets from this session will be removed.</p>
      </Sheet>
    </div>
  )
}

function ExerciseCard({ se, ex, session, all, settings, onChange, onSetDone, onSwap, exMap }: { se: SessionExercise; ex: Exercise; session: WorkoutSession; all: WorkoutSession[]; settings: Settings; onChange: (p: Partial<SessionExercise>) => void; onSetDone: () => void; onSwap: () => void; exMap: Map<string, Exercise> }) {
  const u = settings.units
  const hist = historyFor(ex.id, all, session.id).filter((h) => h.session.startedAt < session.startedAt)
  const last = hist[0]
  const sug = suggestNext(ex, se.plan, hist)
  const flag = ex.knee ? kneeFlag(ex.id, all.filter((s) => s.id !== session.id)) : { flagged: false, count: 0 }
  const allDone = se.sets.length > 0 && se.sets.every((s) => s.done)
  const cmp = allDone ? compareToLast(se.sets, last) : null
  const [info, setInfo] = useState(false)
  const setSet = (k: number, patch: Partial<SessionExercise['sets'][number]>) => onChange({ sets: se.sets.map((s, j) => (j === k ? { ...s, ...patch } : s)) })
  const cardio = ex.kind === 'cardio'

  return (
    <Card className={cn(se.skipped && 'opacity-60', allDone && 'border-sage/50')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-lg leading-snug">{ex.name}</h3>
            {allDone && <Check className="size-4 text-sage" strokeWidth={3} />}
          </div>
          <div className="text-xs text-ink-2">
            {se.plan.sets} × {se.plan.repMin}–{se.plan.repMax}
            {cardio ? ' min' : ex.perLeg ? ' per leg' : ''} · {cardio ? 'easy, conversational' : fmtRIR(se.plan)}
            {fmtRest(se.plan) && ` · ${fmtRest(se.plan)}`}
          </div>
          {se.swappedFrom && <div className="text-xs text-ink-3">Swapped from {exMap.get(se.swappedFrom)?.name}</div>}
        </div>
        <div className="flex shrink-0">
          {(ex.cues || se.plan.note) && (
            <button className="rounded-full p-2 text-ink-3" onClick={() => setInfo(!info)} aria-label="Notes">
              <Info className="size-4" />
            </button>
          )}
          {ex.alternatives.length > 0 && (
            <button className="rounded-full p-2 text-ink-3" onClick={onSwap} aria-label="Swap exercise">
              <ArrowLeftRight className="size-4" />
            </button>
          )}
        </div>
      </div>
      {info && (
        <div className="mt-2 space-y-1 rounded-2xl bg-surface-2 p-3 text-xs text-ink-2">
          {se.plan.note && <p>{se.plan.note}</p>}
          {ex.cues && <p>{ex.cues}</p>}
        </div>
      )}

      {flag.flagged && (
        <div className="mt-3 flex gap-2 rounded-2xl bg-amber-soft p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber" />
          <div>
            <p className="text-ink">Knee discomfort in {flag.count} of your last 3 sessions of this exercise.</p>
            <p className="text-ink-2">Don't push through recurring joint pain — consider a swap:</p>
            <button className="mt-1 font-medium text-accent" onClick={onSwap}>
              See alternatives →
            </button>
          </div>
        </div>
      )}

      {!cardio && (
        <div className="mt-3 space-y-0.5 text-xs">
          {last && (
            <p className="text-ink-3">
              Last time ({fmtDate(last.session.date)}): {fmtSets(last.sets.map((s) => ({ ...s, weight: showW(s.weight, u) })))}
            </p>
          )}
          <p className="text-ink-2">{sug.text}</p>
        </div>
      )}

      {!se.skipped && (
        <div className="mt-3">
          <div className="grid grid-cols-[1.5rem_1fr_1fr_1.1fr_2.5rem] items-center gap-2 px-0.5 pb-1 text-[11px] font-medium text-ink-3 uppercase">
            <span>#</span>
            <span>{cardio ? 'Min' : ex.kind === 'bodyweight' ? `+${u.weight}` : u.weight}</span>
            <span>{cardio ? '' : ex.perLeg ? 'Reps/leg' : 'Reps'}</span>
            <span>{cardio ? '' : 'RIR'}</span>
            <span className="text-center">Done</span>
          </div>
          <div className="space-y-1.5">
            {se.sets.map((s, k) => (
              <div key={k} className={cn('grid grid-cols-[1.5rem_1fr_1fr_1.1fr_2.5rem] items-center gap-2 rounded-2xl', s.done && 'bg-sage-soft/60')}>
                <span className="text-center text-sm text-ink-3">{k + 1}</span>
                {cardio ? (
                  <NumInput className="h-10 px-2 text-center" value={s.minutes ?? null} onChange={(v) => setSet(k, { minutes: v ?? 0 })} />
                ) : (
                  <NumInput className="h-10 px-2 text-center" value={showW(s.weight, u)} onChange={(v) => setSet(k, { weight: readW(v ?? 0, u) })} />
                )}
                {cardio ? <span /> : <NumInput className="h-10 px-2 text-center" step="1" value={s.reps} onChange={(v) => setSet(k, { reps: Math.round(v ?? 0) })} />}
                {cardio ? (
                  <span />
                ) : (
                  <select
                    value={s.rir ?? ''}
                    onChange={(e) => setSet(k, { rir: e.target.value === '' ? null : Number(e.target.value) })}
                    className="h-10 rounded-2xl border border-border bg-surface px-2 text-center text-sm"
                    aria-label="Reps in reserve"
                  >
                    <option value="">–</option>
                    {[0, 1, 2, 3, 4, 5].map((r) => (
                      <option key={r} value={r}>
                        {r === 5 ? '5+' : r}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  onClick={() => {
                    const done = !s.done
                    setSet(k, { done })
                    if (done && !cardio) onSetDone()
                  }}
                  className={cn('mx-auto grid size-9 place-items-center rounded-xl border-2 transition-colors', s.done ? 'border-sage bg-sage text-white' : 'border-border')}
                  aria-label={`Set ${k + 1} complete`}
                  aria-pressed={s.done}
                >
                  {s.done && <Check className="size-5" strokeWidth={3} />}
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Button
              size="xs"
              variant="ghost"
              onClick={() => {
                const prev = se.sets[se.sets.length - 1] ?? { weight: sug.weight, reps: se.plan.repMin, rir: null, done: false }
                onChange({ sets: [...se.sets, { ...prev, done: false }] })
              }}
            >
              <Plus className="size-3.5" /> Set
            </Button>
            {se.sets.length > 1 && (
              <Button size="xs" variant="ghost" onClick={() => onChange({ sets: se.sets.slice(0, -1) })}>
                <Minus className="size-3.5" /> Set
              </Button>
            )}
            {ex.knee && (
              <Chip active={!!se.pain} onClick={() => onChange({ pain: !se.pain })} className="ml-auto h-7 text-xs">
                <AlertTriangle className="size-3.5" /> Pain / discomfort
              </Chip>
            )}
          </div>
          {se.pain && <p className="mt-2 text-xs text-ink-2">Noted. Stop any set that hurts — progression will hold, and a swap is suggested if it keeps happening.</p>}
        </div>
      )}
      {(se.plan.optional || se.skipped) && (
        <Button size="xs" variant="ghost" className="mt-2" onClick={() => onChange({ skipped: !se.skipped })}>
          {se.skipped ? 'Include this exercise' : 'Skip today'}
        </Button>
      )}
      {cmp && <p className="mt-2 text-sm font-medium text-sage">{cmp}</p>}
    </Card>
  )
}

function SwapSheet({ open, onClose, current, exercises, onPick }: { open: boolean; onClose: () => void; current?: Exercise; exercises: Exercise[]; onPick: (id: string, permanent: boolean) => void }) {
  const [permanent, setPermanent] = useState(false)
  if (!current) return null
  const alts = current.alternatives.map((id) => exercises.find((e) => e.id === id)).filter((e): e is Exercise => !!e)
  return (
    <Sheet open={open} onClose={onClose} title={`Swap ${current.name}`}>
      <div className="space-y-3">
        <p className="text-sm text-ink-3">Alternatives that train a similar pattern. Keeps today's sets and rep range.</p>
        {alts.map((a) => (
          <button key={a.id} className="flex w-full items-center justify-between rounded-2xl border border-border p-3 text-left" onClick={() => onPick(a.id, permanent)}>
            <span className="text-sm font-medium">{a.name}</span>
            <ChevronRight className="size-4 text-ink-3" />
          </button>
        ))}
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" checked={permanent} onChange={(e) => setPermanent(e.target.checked)} className="size-4 accent-[var(--accent)]" />
          Also replace it in my program going forward
        </label>
      </div>
    </Sheet>
  )
}

// ── Summary ──────────────────────────────────────────────

function SummaryView({ id }: { id?: string }) {
  const settings = useSettings()
  const session = useLiveQuery(() => (id ? db.sessions.get(id) : undefined), [id])
  const all = useLiveQuery(() => db.sessions.toArray(), [])
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
  if (!session || !all || !exercises || !settings) return null
  const sum = summarizeSession(session, all, exercises)
  const exMap = new Map(exercises.map((e) => [e.id, e]))
  const u = settings.units
  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2 pt-2">
        <button onClick={() => navigate('workout')} className="-ml-2 rounded-full p-2 text-ink-3" aria-label="Back">
          <ChevronLeft className="size-5" />
        </button>
        <div>
          <p className="text-sm text-ink-3">{fmtDate(session.date, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h1 className="font-display text-3xl leading-tight">Workout summary</h1>
        </div>
      </header>
      <Card>
        <div className="font-display text-xl">{session.name}</div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Duration', fmtDuration(sum.durationMs)],
            ['Exercises', String(sum.exercisesDone)],
            ['Sets', String(sum.totalSets)],
            ['Volume', `${fmtNum(showW(sum.volume, u))} ${u.weight}`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-surface-2 p-3">
              <div className="text-xs text-ink-3">{k}</div>
              <div className="font-display text-xl tabular-nums">{v}</div>
            </div>
          ))}
        </div>
        {session.extras?.dance && <p className="mt-3 text-sm text-sage">+ Salsa / bachata tonight</p>}
      </Card>
      <Card>
        <CardHeader title="PRs" />
        {sum.prs.length === 0 ? (
          <p className="text-sm text-ink-3">No new PRs this time — steady work counts too.</p>
        ) : (
          <ul className="space-y-1.5">
            {sum.prs.map((p, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <Trophy className="size-4 text-amber" /> {p.text}
                <Pill tone={p.type === 'load' ? 'accent' : 'sage'}>{p.type === 'load' ? 'Load PR' : 'Rep PR'}</Pill>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <CardHeader title="Next time" />
        <ul className="space-y-2.5">
          {sum.next.map((n) => (
            <li key={n.name} className="text-sm">
              <div className="font-medium">{n.name}</div>
              <div className="text-ink-2">{n.text}</div>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader title="Sets" />
        <div className="space-y-2">
          {session.exercises
            .filter((e) => e.sets.some((s) => s.done))
            .map((e, i) => (
              <div key={i} className="text-sm">
                <span className="font-medium">{exMap.get(e.exerciseId)?.name}</span>
                {e.pain && <Pill tone="amber" className="ml-2">discomfort</Pill>}
                <div className="text-ink-2 tabular-nums">
                  {e.sets
                    .filter((s) => s.done)
                    .map((s) => (s.minutes ? `${s.minutes} min` : `${showW(s.weight, u)} × ${s.reps}${s.rir != null ? ` @${s.rir}` : ''}`))
                    .join(' · ')}
                </div>
              </div>
            ))}
        </div>
      </Card>
      {session.note && <Card className="text-sm text-ink-2">{session.note}</Card>}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => navigate(`workout/session/${session.id}`)}>
          Edit sets
        </Button>
        <Button className="flex-1" onClick={() => navigate('today')}>
          Done
        </Button>
      </div>
    </div>
  )
}

function ExerciseHistoryView({ id }: { id?: string }) {
  const settings = useSettings()
  const ex = useLiveQuery(() => (id ? db.exercises.get(id) : undefined), [id])
  const sessions = useLiveQuery(() => db.sessions.toArray(), [])
  if (!ex || !sessions || !settings) return null
  const u = settings.units
  const hist = historyFor(ex.id, sessions)
  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2 pt-2">
        <button onClick={() => history.back()} className="-ml-2 rounded-full p-2 text-ink-3" aria-label="Back">
          <ChevronLeft className="size-5" />
        </button>
        <h1 className="font-display text-3xl leading-tight">{ex.name}</h1>
      </header>
      {ex.kind === 'weighted' && (
        <Card>
          <StrengthChart exerciseId={ex.id} sessions={sessions} />
        </Card>
      )}
      <Card>
        <CardHeader title="Set history" subtitle={ex.baseline ? `Baseline: ${showW(ex.baseline.weight, u)} ${u.weight} × ${ex.baseline.reps}` : undefined} />
        {hist.length === 0 ? (
          <Empty>No sets logged yet.</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {hist.map((h) => (
              <li key={h.session.id} className="py-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-ink-3">{fmtDate(h.session.date, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  <span className="text-xs text-ink-3">
                    e1RM ≈ {fmtNum(showW(bestE1RM(h.sets), u))} {h.ex.pain && '· discomfort'}
                  </span>
                </div>
                <div className="tabular-nums">{h.sets.map((s) => `${showW(s.weight, u)} × ${s.reps}${s.rir != null ? ` @${s.rir}` : ''}`).join(' · ')}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="px-1 text-xs text-ink-3">
        e1RM is an estimate for comparing sessions, not a max to test.
      </p>
    </div>
  )
}
