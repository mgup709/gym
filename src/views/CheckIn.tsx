import { useLiveQuery } from 'dexie-react-hooks'
import { Check, ChevronLeft, Minus, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { PhotoCapture } from '@/components/photos/PhotoCapture'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, Pill, Section } from '@/components/ui/card'
import { Chip } from '@/components/ui/controls'
import { Input, NumInput } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { cycleInfo, periodStarts } from '@/lib/cycle'
import { addDays, DAY_NAMES, fmtDate } from '@/lib/dates'
import { db } from '@/lib/db'
import { navigate, useSettings, useToday } from '@/lib/hooks'
import { MEASURE_LABEL, NOISE, ratios, sorted } from '@/lib/measurements'
import { compareToLast, historyFor } from '@/lib/progression'
import { BINGE_LABEL, REC_LABEL, recoverySignals, type RecKey } from '@/lib/recovery'
import { saveSettings } from '@/lib/repo'
import { OUTCOME_TONE, weeklyReview } from '@/lib/review'
import { dailyRows, summarize } from '@/lib/trends'
import type { MeasureKey, Measurement, Settings, WeeklyReview } from '@/lib/types'
import { OPTIONAL_MEASURES, REQUIRED_MEASURES, WIDTHS } from '@/lib/types'
import { readL, showL } from '@/lib/units'
import { cn, fmtNum, round, uid } from '@/lib/utils'
import { isPhotoDue } from '@/lib/checkin'

const STEPS = ['Measurements', 'Photos', 'Recovery', 'Training', 'Nutrition', 'Recommendation'] as const

function MeasureInput({ k, value, last, onChange, units }: { k: MeasureKey; value: number | undefined; last?: number; onChange: (v: number | undefined) => void; units: Settings['units'] }) {
  const step = units.length === 'cm' ? 0.5 : 0.25
  const shown = value != null ? showL(value, units) : null
  const bump = (d: number) => {
    const base = value ?? last
    if (base == null) return
    onChange(readL(round(showL(base, units) + d, 2), units))
  }
  const delta = value != null && last != null ? value - last : null
  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{MEASURE_LABEL[k]}</div>
        <div className="text-xs text-ink-3">
          {last != null ? `Last: ${showL(last, units)} ${units.length}` : 'No previous value'}
          {delta != null && Math.abs(delta) >= 0.01 && ` · ${delta > 0 ? '+' : '−'}${Math.abs(round(showL(Math.abs(delta), units), 2))}`}
        </div>
      </div>
      <button className="grid size-9 place-items-center rounded-full bg-surface-2 text-ink-2" onClick={() => bump(-step)} aria-label="Decrease">
        <Minus className="size-4" />
      </button>
      <NumInput className="h-10 w-20 px-2 text-center" value={shown} placeholder={last != null ? String(showL(last, units)) : ''} onChange={(v) => onChange(v == null ? undefined : readL(v, units))} />
      <button className="grid size-9 place-items-center rounded-full bg-surface-2 text-ink-2" onClick={() => bump(step)} aria-label="Increase">
        <Plus className="size-4" />
      </button>
    </div>
  )
}

export function CheckInView() {
  const settings = useSettings()
  const today = useToday()
  const [step, setStep] = useState(0)
  const [date, setDate] = useState(today)
  const measurements = useLiveQuery(() => db.measurements.toArray(), [])
  const cycleDays = useLiveQuery(() => db.cycle.toArray(), [])
  const recovery = useLiveQuery(() => db.recovery.toArray(), [])
  const sessions = useLiveQuery(() => db.sessions.toArray(), [])
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
  const reviews = useLiveQuery(() => db.reviews.toArray(), [])
  const lastPhoto = useLiveQuery(async () => (await db.photos.orderBy('date').last())?.date, [])
  const nutrition = useLiveQuery(async () => {
    const from = addDays(date, -20)
    const [days, entries] = await Promise.all([db.days.where('date').between(from, date, true, true).toArray(), db.entries.where('date').between(from, date, true, true).toArray()])
    return dailyRows(from, date, days, entries)
  }, [date])

  const existing = measurements?.find((m) => m.date === date && !m.baseline)
  const [draft, setDraft] = useState<Measurement | null>(null)
  useEffect(() => {
    if (measurements && (!draft || draft.date !== date)) setDraft(existing ? structuredClone(existing) : { id: uid(), date, values: {} })
  }, [measurements, date]) // eslint-disable-line react-hooks/exhaustive-deps

  const cyc = useMemo(() => (settings && cycleDays ? cycleInfo(date, periodStarts(cycleDays, settings), settings) : null), [settings, cycleDays, date])

  const prev = useMemo(() => {
    if (!measurements) return undefined
    return (k: MeasureKey) => {
      const list = sorted(measurements).filter((m) => m.date < date || (m.date === date && m.baseline))
      for (let i = list.length - 1; i >= 0; i--) if (list[i].values[k] != null) return list[i].values[k]
      return undefined
    }
  }, [measurements, date])

  const allMs = useMemo(() => {
    if (!measurements || !draft) return []
    const others = measurements.filter((m) => m.id !== draft.id)
    return Object.keys(draft.values).length ? [...others, { ...draft, cycleDay: cyc?.day ?? null }] : others
  }, [measurements, draft, cyc])

  const result = useMemo(() => {
    if (!settings || !nutrition || !recovery || !sessions || !reviews || !cycleDays) return null
    const cur = draft && Object.keys(draft.values).length ? { ...draft, cycleDay: cyc?.day ?? null } : undefined
    return weeklyReview({
      today: date,
      measurements: allMs,
      current: cur,
      retentionWindow: !!cyc?.retention,
      cycleDays,
      recovery,
      sessions,
      rows21: nutrition,
      rows7: nutrition.slice(-7),
      priorReviews: reviews.filter((r) => r.kind !== 'checkpoint' && r.date < date),
      currentKcalMax: settings.steadyIntake ? settings.targets.default.kcal.max : settings.targets.default.kcal.max,
    })
  }, [settings, nutrition, recovery, sessions, reviews, cycleDays, draft, cyc, allMs, date])

  if (!settings || !draft || !prev || !nutrition || !recovery || !sessions || !exercises) return null
  const u = settings.units
  const setVal = (k: MeasureKey, v: number | undefined) => {
    const values = { ...draft.values }
    if (v == null) delete values[k]
    else values[k] = v
    setDraft({ ...draft, values })
  }
  const requiredDone = REQUIRED_MEASURES.every((k) => draft.values[k] != null)

  const saveMeasurements = async () => {
    if (Object.keys(draft.values).length) await db.measurements.put({ ...draft, cycleDay: cyc?.day ?? null })
  }

  const next = async () => {
    if (step === 0) await saveMeasurements()
    setStep(Math.min(STEPS.length - 1, step + 1))
    window.scrollTo({ top: 0 })
  }

  const finish = async (applyDelta?: number) => {
    if (!result) return
    await saveMeasurements()
    const review: WeeklyReview = {
      id: reviews?.find((r) => r.date === date && r.kind !== 'checkpoint')?.id ?? uid(),
      kind: 'weekly',
      date,
      outcome: result.outcome,
      headline: result.headline,
      message: result.message,
      reasons: result.reasons,
      snapshot: result.snapshot,
      applied: applyDelta != null,
      createdAt: Date.now(),
    }
    await db.reviews.put(review)
    if (applyDelta) {
      const s = structuredClone(settings)
      for (const k of Object.keys(s.targets) as (keyof Settings['targets'])[]) {
        const t = s.targets[k]
        t.kcal = { min: t.kcal.min + applyDelta, max: t.kcal.max + applyDelta }
        if (t.carbs) t.carbs = { min: Math.max(0, t.carbs.min + applyDelta / 4), max: Math.max(0, t.carbs.max + applyDelta / 4) }
      }
      await saveSettings(s)
      toast(`Targets ${applyDelta > 0 ? 'increased' : 'reduced'} by ${Math.abs(applyDelta)} kcal from today on. Past days keep their targets.`)
    } else toast('Check-in saved')
    navigate('progress')
  }

  const photoDue = isPhotoDue(settings, lastPhoto, date)
  const n7 = summarize(nutrition.slice(-7))
  const rec = recoverySignals(recovery, date)
  const weekSessions = sessions.filter((s) => s.status === 'done' && s.date > addDays(date, -7) && s.date <= date)
  const exName = new Map(exercises.map((e) => [e.id, e.name]))
  const r = ratios({ ...Object.fromEntries((Object.keys(MEASURE_LABEL) as MeasureKey[]).map((k) => [k, draft.values[k] ?? prev(k)])) })

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2 pt-2">
        <button onClick={() => (step === 0 ? navigate('progress') : setStep(step - 1))} className="-ml-2 rounded-full p-2 text-ink-3" aria-label="Back">
          <ChevronLeft className="size-5" />
        </button>
        <div className="min-w-0">
          <p className="text-sm text-ink-3">
            Weekly check-in · step {step + 1} of {STEPS.length}
          </p>
          <h1 className="font-display text-3xl leading-tight">{STEPS[step]}</h1>
        </div>
      </header>
      <div className="flex gap-1">
        {STEPS.map((s, i) => (
          <button key={s} onClick={() => setStep(i)} className={cn('h-1.5 flex-1 rounded-full', i <= step ? 'bg-accent' : 'bg-surface-2')} aria-label={s} />
        ))}
      </div>

      {step === 0 && (
        <>
          <Card className="space-y-1">
            <div className="flex items-center justify-between gap-2 pb-2">
              <Input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-9 w-40" />
              {cyc && (
                <Pill tone={cyc.retention ? 'amber' : 'neutral'}>
                  Cycle day {cyc.day} · {cyc.label}
                </Pill>
              )}
            </div>
            <p className="text-xs text-ink-3">Same morning each week, before eating, relaxed stomach, tape level and snug but not tight.</p>
            <div className="divide-y divide-border">
              {REQUIRED_MEASURES.map((k) => (
                <MeasureInput key={k} k={k} units={u} value={draft.values[k]} last={prev(k)} onChange={(v) => setVal(k, v)} />
              ))}
            </div>
          </Card>
          <Section title="Front-view widths" subtitle="Optional — from a straight-on photo or calipers">
            <div className="divide-y divide-border">
              {WIDTHS.map((k) => (
                <MeasureInput key={k} k={k} units={u} value={draft.values[k]} last={prev(k)} onChange={(v) => setVal(k, v)} />
              ))}
            </div>
          </Section>
          <Section title="Optional circumferences">
            <div className="divide-y divide-border">
              {OPTIONAL_MEASURES.filter((k) => k !== 'underbust' && k !== 'calf').map((k) => (
                <MeasureInput key={k} k={k} units={u} value={draft.values[k]} last={prev(k)} onChange={(v) => setVal(k, v)} />
              ))}
            </div>
          </Section>
          <Card className="space-y-3">
            <div>
              <div className="mb-1.5 text-sm font-medium">Midsection looks…</div>
              <div className="flex flex-wrap gap-1.5">
                {(['tighter', 'same', 'softer', 'unsure'] as const).map((v) => (
                  <Chip key={v} active={draft.visualWaist === v} onClick={() => setDraft({ ...draft, visualWaist: draft.visualWaist === v ? undefined : v })}>
                    {v === 'unsure' ? 'Not sure' : v[0].toUpperCase() + v.slice(1)}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-sm font-medium">Glutes / hips look…</div>
              <div className="flex flex-wrap gap-1.5">
                {(['fuller', 'same', 'smaller', 'unsure'] as const).map((v) => (
                  <Chip key={v} active={draft.visualGlutes === v} onClick={() => setDraft({ ...draft, visualGlutes: draft.visualGlutes === v ? undefined : v })}>
                    {v === 'unsure' ? 'Not sure' : v[0].toUpperCase() + v.slice(1)}
                  </Chip>
                ))}
              </div>
            </div>
            {r.whr != null && (
              <p className="text-xs text-ink-3 tabular-nums">
                Waist-to-hip {fmtNum(r.whr, 3)} · belly-to-hip {fmtNum(r.bhr, 3)} · hip − waist {fmtNum(r.diff != null ? showL(r.diff, u) : null, 2)} {u.length}
                {r.widthDiff != null && ` · front-width difference ${fmtNum(showL(r.widthDiff, u), 2)} ${u.length}`}
              </p>
            )}
          </Card>
          {!requiredDone && <p className="text-center text-xs text-ink-3">Waist, belly button and hips are the three that matter most.</p>}
        </>
      )}

      {step === 1 && (
        <Card className="space-y-3">
          {photoDue ? (
            <p className="text-sm text-ink-2">
              Photos are due ({settings.photoFrequency === 'weekly' ? 'weekly' : 'every 4 weeks'}). Same light, distance, clothing, posture and time of day as last time. The faint
              image is your last photo to help match the pose.
            </p>
          ) : (
            <p className="text-sm text-ink-2">
              Photos aren't due this week (you take them {settings.photoFrequency === 'weekly' ? 'weekly' : 'every 4 weeks'}; last on {lastPhoto && fmtDate(lastPhoto)}). Skip ahead, or add
              some anyway.
            </p>
          )}
          <PhotoCapture date={date} cycleDay={cyc?.day} />
          <p className="text-xs text-ink-3">Photos stay on this device. No scoring or ratings — they're only for your own comparison.</p>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader title="Last 7–14 days" subtitle={`${rec.days} days of recovery logged in the last 2 weeks`} />
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(REC_LABEL) as RecKey[]).map((k) => (
              <div key={k} className="rounded-2xl bg-surface-2 p-3">
                <div className="text-xs text-ink-3">{REC_LABEL[k]}</div>
                <div className="font-display text-xl tabular-nums">{rec.recent[k] != null ? fmtNum(rec.recent[k], 1) : '—'}<span className="text-sm text-ink-3"> / 5</span></div>
              </div>
            ))}
            <div className="rounded-2xl bg-surface-2 p-3">
              <div className="text-xs text-ink-3">{BINGE_LABEL.strong} / episodes</div>
              <div className="font-display text-xl tabular-nums">
                {rec.bingeStrong} / {rec.bingeEpisodes}
              </div>
            </div>
          </div>
          {rec.signals.length > 0 && (
            <ul className="mt-3 list-disc space-y-0.5 pl-5 text-sm text-ink-2">
              {rec.signals.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader title="This week's training" subtitle={`${weekSessions.length} of ${settings.schedule.filter((s) => s !== 'rest').length} planned sessions completed`} />
          <ul className="space-y-2 text-sm">
            {['hip-thrust', 'rdl', 'leg-press', 'bss', 'abduction'].map((id) => {
              const h = historyFor(id, sessions).filter((x) => x.session.date <= date)
              if (!h.length || h[0].session.date <= addDays(date, -7)) return null
              const c = compareToLast(h[0].sets, h[1])
              return (
                <li key={id} className="flex justify-between gap-2">
                  <span>{exName.get(id)}</span>
                  <span className="text-ink-2">{c ?? 'first session'}</span>
                </li>
              )
            })}
          </ul>
          {weekSessions.some((s) => s.exercises.some((e) => e.pain)) && <p className="mt-3 text-sm text-amber">Knee discomfort was noted this week — see the Workout tab for alternatives.</p>}
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader title="Last 7 days" subtitle={`${n7.logged} days logged`} />
          <div className="grid grid-cols-3 gap-2">
            {[
              ['Calories', n7.kcal, ''],
              ['Protein', n7.protein, 'g'],
              ['Carbs', n7.carbs, 'g'],
              ['Fat', n7.fat, 'g'],
              ['Fiber', n7.fiber, 'g'],
              ['Protein ≥ target', n7.proteinHit != null ? n7.proteinHit * 100 : null, '% days'],
            ].map(([k, v, unit]) => (
              <div key={k as string} className="rounded-2xl bg-surface-2 p-3">
                <div className="text-xs text-ink-3">{k}</div>
                <div className="font-display text-xl tabular-nums">
                  {fmtNum(v as number | null)}
                  <span className="text-xs text-ink-3"> {unit}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-3">Averages use logged days only. Single days don't change the plan.</p>
        </Card>
      )}

      {step === 5 && result && (
        <>
          <Card>
            <CardHeader title="This week" />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              {result.week.map((w) => (
                <div key={w.label} className="flex justify-between gap-2">
                  <dt className="text-ink-3">{w.label}</dt>
                  <dd className="font-medium tabular-nums">{w.value}</dd>
                </div>
              ))}
            </dl>
            {cyc && <p className="mt-2 text-xs text-ink-3">Measured on cycle day {cyc.day} ({cyc.label.toLowerCase()}).</p>}
          </Card>
          <Card className={cn(result.outcome === 'increase' && 'border-amber/40', result.outcome === 'keep' && 'border-sage/40')}>
            <Pill tone={result.outcome === 'keep' ? 'sage' : result.outcome === 'hold' ? 'neutral' : 'amber'}>{OUTCOME_TONE[result.outcome]}</Pill>
            <h2 className="mt-2 font-display text-2xl leading-snug">{result.headline}</h2>
            <p className="mt-1 text-[15px] text-ink-2">{result.message}</p>
            {result.reasons.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-ink-2">
                {result.reasons.map((x) => (
                  <li key={x} className="flex gap-2">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-ink-3" /> {x}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-ink-3">Changes under {NOISE} in are treated as measurement noise. Nothing changes unless you choose to apply it.</p>
          </Card>
          <div className="space-y-2">
            {result.outcome === 'reduce' && (
              <Button variant="outline" className="w-full" onClick={() => finish(-100)}>
                Apply −100 kcal/day to my targets
              </Button>
            )}
            {result.outcome === 'increase' && (
              <Button variant="outline" className="w-full" onClick={() => finish(100)}>
                Apply +100 kcal/day to my targets
              </Button>
            )}
            <Button className="w-full" size="lg" onClick={() => finish()}>
              {result.outcome === 'keep' || result.outcome === 'hold' ? 'Save check-in' : 'Save without changing targets'}
            </Button>
          </div>
        </>
      )}

      {step < 5 && (
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setStep(step + 1)} className="text-ink-3">
            Skip
          </Button>
          <Button className="flex-1" size="lg" onClick={next}>
            Continue
          </Button>
        </div>
      )}
      <p className="text-center text-xs text-ink-3">Measurement day: {DAY_NAMES[settings.measurementDay]}. Weekly, not daily — trends matter, single weeks don't.</p>
    </div>
  )
}
