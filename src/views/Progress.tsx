import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarCheck, ChevronRight, Flag } from 'lucide-react'
import { useMemo, useState } from 'react'
import { StrengthChart } from '@/components/charts/StrengthChart'
import { PhotoCapture } from '@/components/photos/PhotoCapture'
import { PhotoCompare } from '@/components/photos/PhotoCompare'
import { Button } from '@/components/ui/button'
import { Card, Pill, Section } from '@/components/ui/card'
import { Chip } from '@/components/ui/controls'
import { Input, Textarea } from '@/components/ui/input'
import { Sheet } from '@/components/ui/sheet'
import { toast } from '@/components/ui/toast'
import { addDays, DAY_NAMES, diffDays, fmtDate, rangeDates, toMin, weekday } from '@/lib/dates'
import { db } from '@/lib/db'
import { navigate, useCycle, useSettings, useToday } from '@/lib/hooks'
import { sorted } from '@/lib/measurements'
import { bestE1RM, historyFor } from '@/lib/progression'
import { recoverySignals } from '@/lib/recovery'
import { OUTCOME_TONE } from '@/lib/review'
import { dailyRows, summarize } from '@/lib/trends'
import type { ISODate, Settings, WeeklyReview } from '@/lib/types'
import { showL } from '@/lib/units'
import { fmtNum, mean, uid } from '@/lib/utils'
import { isCheckInDue } from '@/lib/checkin'
import { BodySection } from './progress/Body'
import { ConsistencyCalendar, DayTypeAnalysis, Insights, MonthlySummary, NutritionTrends, PhysiqueCompare } from './progress/Nutrition'
import { CycleHistory, RecoverySection } from './progress/Recovery'

const LIFTS = [
  { id: 'hip-thrust', label: 'Hip thrust' },
  { id: 'rdl', label: 'Romanian deadlift' },
  { id: 'leg-press', label: 'Lower-body press / squat' },
  { id: 'bss', label: 'Split squat' },
  { id: 'reverse-lunge', label: 'Reverse lunge' },
  { id: 'abduction', label: 'Hip abduction' },
]

export function ProgressView() {
  const settings = useSettings()
  const today = useToday()
  const ms = useLiveQuery(() => db.measurements.toArray(), [])
  const reviews = useLiveQuery(() => db.reviews.orderBy('date').reverse().toArray(), [])
  const sessions = useLiveQuery(() => db.sessions.toArray(), [])
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
  const cycle = useCycle(today, settings)
  const [lift, setLift] = useState('hip-thrust')
  const [photoOpen, setPhotoOpen] = useState(false)
  const [photoDate, setPhotoDate] = useState(today)
  if (!settings || !ms || !reviews || !sessions || !exercises) return null
  const due = isCheckInDue(settings, ms, today)
  const lastWeekly = reviews.find((r) => r.kind !== 'checkpoint')
  const lastM = sorted(ms).pop()
  const nextDay = (() => {
    for (let i = 0; i < 7; i++) if (weekday(addDays(today, i)) === settings.measurementDay) return addDays(today, i)
    return today
  })()

  return (
    <div className="space-y-4">
      <header className="pt-2">
        <p className="text-sm text-ink-3">Long-term trends</p>
        <h1 className="font-display text-4xl leading-tight">Progress</h1>
      </header>

      <Card className={due ? 'border-accent/40' : undefined}>
        <div className="flex items-start gap-3">
          <CalendarCheck className="mt-0.5 size-5 text-accent" />
          <div className="min-w-0 flex-1">
            <div className="font-medium">Weekly check-in</div>
            <div className="text-sm text-ink-2">
              {due
                ? 'Due now — measurements, photos if due, and this week’s recommendation. About 2 minutes.'
                : `Next on ${DAY_NAMES[settings.measurementDay]}, ${fmtDate(nextDay)}. Last measured ${lastM ? fmtDate(lastM.date) : '—'}.`}
            </div>
            {lastWeekly && (
              <div className="mt-2 rounded-2xl bg-surface-2 px-3 py-2 text-sm">
                <Pill tone={lastWeekly.outcome === 'keep' ? 'sage' : lastWeekly.outcome === 'hold' ? 'neutral' : 'amber'}>{OUTCOME_TONE[lastWeekly.outcome]}</Pill>
                <span className="ml-2 text-xs text-ink-3">{fmtDate(lastWeekly.date)}</span>
                <div className="mt-1 font-medium">{lastWeekly.headline}</div>
                <div className="text-ink-2">{lastWeekly.message}</div>
              </div>
            )}
          </div>
        </div>
        <Button className="mt-3 w-full" variant={due ? 'default' : 'outline'} onClick={() => navigate('checkin')}>
          {due ? 'Start weekly check-in' : 'Check in early'}
        </Button>
      </Card>

      <Checkpoints settings={settings} today={today} reviews={reviews} />

      <Section title="Body" subtitle="Waist, belly button, hips, ratios and front-view widths" defaultOpen>
        {cycle && (
          <p className="text-xs text-ink-3">
            Today is cycle day {cycle.day} ({cycle.label.toLowerCase()}). Measurements show their cycle day so water retention isn't mistaken for change.
          </p>
        )}
        <BodySection settings={settings} />
      </Section>

      <Section title="Photos" subtitle="Side-by-side, swipe or overlay — stored privately on this device">
        <PhotoCompare />
        <Button variant="outline" size="sm" className="w-full" onClick={() => setPhotoOpen(true)}>
          Add or replace photos
        </Button>
      </Section>

      <Section title="Strength" subtitle="Hip thrust, RDL, lower-body press, split squat and more">
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
          {LIFTS.map((l) => (
            <Chip key={l.id} active={lift === l.id} onClick={() => setLift(l.id)}>
              {l.label}
            </Chip>
          ))}
        </div>
        <StrengthChart exerciseId={lift} sessions={sessions} />
        <LiftTable sessions={sessions} exercises={exercises} />
      </Section>

      <Section title="Nutrition trends" subtitle="Daily intake, 7-day average and target range">
        <NutritionTrends settings={settings} today={today} />
      </Section>
      <Section title="Monthly summaries" subtitle="Averages, target consistency and month-to-month comparison">
        <MonthlySummary today={today} />
      </Section>
      <Section title="Intake by workout day" subtitle="Lower A, upper, core, Lower B, dance Fridays and rest">
        <DayTypeAnalysis today={today} />
      </Section>
      <Section title="Consistency calendar">
        <ConsistencyCalendar settings={settings} today={today} />
      </Section>
      <Section title="Insights" subtitle="Only what your data directly supports">
        <Insights settings={settings} today={today} />
      </Section>
      <Section title="Nutrition + physique" subtitle="Calories and protein alongside waist, hips and strength">
        <PhysiqueCompare settings={settings} today={today} />
      </Section>
      <Section title="Recovery" subtitle="Hunger, energy, sleep, soreness, stress and urges">
        <RecoverySection today={today} />
      </Section>
      {settings.cycle.enabled && (
        <Section title="Cycle">
          <CycleHistory settings={settings} />
        </Section>
      )}
      <Section title="Past check-ins" subtitle={`${reviews.length} saved`}>
        <ul className="divide-y divide-border">
          {reviews.map((r) => (
            <li key={r.id} className="py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{r.headline}</span>
                <span className="text-xs text-ink-3">{fmtDate(r.date)}</span>
              </div>
              <div className="text-ink-2">{r.message}</div>
              {r.applied && <div className="text-xs text-ink-3">Applied to targets</div>}
            </li>
          ))}
        </ul>
      </Section>

      <Sheet open={photoOpen} onClose={() => setPhotoOpen(false)} title="Progress photos" footer={<Button className="w-full" onClick={() => setPhotoOpen(false)}>Done</Button>}>
        <div className="space-y-3">
          <Input type="date" value={photoDate} max={today} onChange={(e) => e.target.value && setPhotoDate(e.target.value)} className="w-44" />
          <PhotoCapture date={photoDate} cycleDay={photoDate === today ? cycle?.day : null} />
          <p className="text-xs text-ink-3">Tip: same light, distance, clothing, posture and time of day each time.</p>
        </div>
      </Sheet>
    </div>
  )
}

function LiftTable({ sessions, exercises }: { sessions: import('@/lib/types').WorkoutSession[]; exercises: import('@/lib/types').Exercise[] }) {
  const rows = LIFTS.map((l) => {
    const ex = exercises.find((e) => e.id === l.id)
    const h = historyFor(l.id, sessions)
    if (!h.length && !ex?.baseline) return null
    const first = h[h.length - 1]
    const last = h[0]
    const startE = first ? bestE1RM(first.sets) : ex?.baseline ? ex.baseline.weight * (1 + ex.baseline.reps / 30) : 0
    const nowE = last ? bestE1RM(last.sets) : startE
    const top = last ? Math.max(...last.sets.map((s) => s.weight)) : ex?.baseline?.weight
    return { ...l, sessions: h.length, startE, nowE, top }
  }).filter(Boolean)
  if (!rows.length) return null
  return (
    <table className="w-full text-sm">
      <thead className="text-xs text-ink-3">
        <tr>
          <th className="py-1 text-left font-medium">Lift</th>
          <th className="text-right font-medium">Latest top set</th>
          <th className="text-right font-medium">e1RM change</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border tabular-nums">
        {rows.map((r) => (
          <tr key={r!.id}>
            <td className="py-1.5">{r!.label}</td>
            <td className="text-right">{fmtNum(r!.top)}</td>
            <td className="text-right text-ink-2">{r!.sessions ? `${r!.nowE >= r!.startE ? '+' : '−'}${fmtNum(Math.abs(r!.nowE - r!.startE))}` : 'baseline only'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Checkpoints (Oct 31, Dec 25) ─────────────────────────

const SELF: Record<string, string[]> = {
  oct: ['Front-view taper', 'Early glute fullness', 'Early ab definition', 'Meal consistency', 'Random snacking under control'],
  dec: ['Front-view waist narrowing', 'Visible abs', 'Glute size', 'Glute roundness', 'Glute projection', 'Quad development', 'Waist-to-hip contrast', 'Breast fullness as I like it', 'Feels sustainable'],
}
const SCALE = ['Not yet', 'A little', 'Noticeable']

function Checkpoints({ settings, today, reviews }: { settings: Settings; today: ISODate; reviews: WeeklyReview[] }) {
  const upcoming = settings.checkpoints.filter((c) => diffDays(c.date, today) <= 21)
  const [open, setOpen] = useState<{ date: string; label: string } | null>(null)
  if (!settings.checkpoints.length) return null
  return (
    <>
      {upcoming.length === 0 ? (
        <p className="px-1 text-xs text-ink-3">
          <Flag className="mr-1 inline size-3.5" />
          Checkpoints: {settings.checkpoints.map((c) => `${c.label.replace(' checkpoint', '')} (${fmtDate(c.date)})`).join(' · ')}
        </p>
      ) : (
        upcoming.map((c) => {
          const saved = reviews.find((r) => r.kind === 'checkpoint' && r.date === c.date)
          return (
            <Card key={c.date}>
              <button className="flex w-full items-center gap-3 text-left" onClick={() => setOpen(c)}>
                <Flag className="size-5 text-accent" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{c.label}</div>
                  <div className="text-sm text-ink-2">
                    {saved ? 'Reviewed — tap to see it again' : today < c.date ? `${diffDays(c.date, today)} days away — a look at the whole block so far` : 'Ready to review'}
                  </div>
                </div>
                <ChevronRight className="size-4 text-ink-3" />
              </button>
            </Card>
          )
        })
      )}
      {open && <CheckpointSheet cp={open} onClose={() => setOpen(null)} settings={settings} today={today} saved={reviews.find((r) => r.kind === 'checkpoint' && r.date === open.date)} />}
    </>
  )
}

function CheckpointSheet({ cp, onClose, settings, today, saved }: { cp: { date: string; label: string }; onClose: () => void; settings: Settings; today: ISODate; saved?: WeeklyReview }) {
  const end = cp.date < today ? cp.date : today
  const from = settings.startDate
  const data = useLiveQuery(async () => {
    const [days, entries, sessions, recovery, ms] = await Promise.all([db.days.toArray(), db.entries.toArray(), db.sessions.toArray(), db.recovery.toArray(), db.measurements.toArray()])
    return { days, entries, sessions, recovery, ms }
  }, [])
  const isDec = cp.date.endsWith('12-25')
  const items = SELF[isDec ? 'dec' : 'oct']
  const [ratings, setRatings] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(saved?.snapshot ?? {}).filter(([k]) => k.startsWith('self:')).map(([k, v]) => [k.slice(5), String(v)])))
  const [note, setNote] = useState(saved?.message ?? '')
  const stats = useMemo(() => {
    if (!data) return null
    const rows = dailyRows(from, end, data.days, data.entries.filter((e) => e.date >= from && e.date <= end))
    const s = summarize(rows)
    const planned = rangeDates(from, end).filter((d) => settings.schedule[weekday(d)] !== 'rest').length
    const done = data.sessions.filter((x) => x.status === 'done' && x.date >= from && x.date <= end).length
    const list = sorted(data.ms).filter((m) => m.date <= end)
    const base = list[0]
    const last = list[list.length - 1]
    const d = (k: 'waist' | 'belly' | 'hips' | 'wWaist' | 'wHips') => (base?.values[k] != null && last?.values[k] != null ? last.values[k]! - base.values[k]! : null)
    const lifts = ['hip-thrust', 'rdl', 'leg-press'].map((id) => {
      const h = historyFor(id, data.sessions).filter((x) => x.session.date <= end)
      return h.length >= 2 ? { id, change: bestE1RM(h[0].sets) - bestE1RM(h[h.length - 1].sets) } : null
    })
    const snackKcal = mean(
      rows
        .filter((r) => r.logged)
        .map((r) => data.entries.filter((e) => e.date === r.date && (e.meal === 'snack' || e.meal === 'evening' || toMin(e.time) >= 20 * 60)).reduce((a, e) => a + e.per.kcal * e.qty, 0)),
    )
    const rec = recoverySignals(data.recovery, end)
    return { s, planned, done, d, lifts, snackKcal, rec, rowsLogged: rows.filter((r) => r.logged).length, span: rows.length }
  }, [data, from, end, settings.schedule])
  if (!stats) return null
  const u = settings.units
  const fmtD = (x: number | null) => (x == null ? '—' : `${x > 0 ? '+' : x < 0 ? '−' : '±'}${fmtNum(showL(Math.abs(x), u), 2)} ${u.length}`)
  const save = async () => {
    const snapshot: WeeklyReview['snapshot'] = Object.fromEntries(Object.entries(ratings).map(([k, v]) => [`self:${k}`, v]))
    await db.reviews.put({ id: saved?.id ?? uid(), kind: 'checkpoint', date: cp.date, outcome: 'keep', headline: cp.label, message: note, reasons: [], snapshot, createdAt: Date.now() })
    toast('Checkpoint saved')
    onClose()
  }
  const liftName: Record<string, string> = { 'hip-thrust': 'Hip thrust', rdl: 'RDL', 'leg-press': 'Leg press' }
  return (
    <Sheet open onClose={onClose} title={cp.label} footer={<Button className="w-full" onClick={save}>Save checkpoint</Button>}>
      <div className="space-y-4 text-sm">
        <p className="text-ink-3">
          {fmtDate(from)} → {fmtDate(end)}. No target waist number — this is about direction, strength and sustainability.
        </p>
        <dl className="grid grid-cols-1 gap-1.5">
          {[
            ['Training consistency', `${stats.done} of ${stats.planned} planned sessions`],
            ...stats.lifts.filter(Boolean).map((l) => [`${liftName[l!.id]} strength`, `${l!.change >= 0 ? '+' : '−'}${fmtNum(Math.abs(l!.change))} lb est.`]),
            ['Smallest waist', fmtD(stats.d('waist'))],
            ['Lower stomach (belly button)', fmtD(stats.d('belly'))],
            ['Hips / glutes', fmtD(stats.d('hips'))],
            ['Front-view waist width', fmtD(stats.d('wWaist'))],
            ['Front-view hip width', fmtD(stats.d('wHips'))],
            ['Days with food logged', `${stats.rowsLogged} of ${stats.span}`],
            ['Average calories / protein', `${fmtNum(stats.s.kcal)} kcal · ${fmtNum(stats.s.protein)} g`],
            ['Protein target hit', stats.s.proteinHit == null ? '—' : `${Math.round(stats.s.proteinHit * 100)}% of days`],
            ['Snack + evening calories', `${fmtNum(stats.snackKcal)} kcal/day`],
            ['Hunger (last 2 wks)', stats.rec.recent.hunger != null ? `${fmtNum(stats.rec.recent.hunger, 1)} / 5` : '—'],
            ['Recovery flags', stats.rec.signals.length ? stats.rec.signals.join('; ') : 'None'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-border py-1">
              <dt className="text-ink-3">{k}</dt>
              <dd className="text-right">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="space-y-3">
          <div className="font-medium">Your own read (from photos and the mirror)</div>
          {items.map((it) => (
            <div key={it}>
              <div className="mb-1 text-ink-2">{it}</div>
              <div className="flex gap-1.5">
                {SCALE.map((s) => (
                  <Chip key={s} active={ratings[it] === s} onClick={() => setRatings({ ...ratings, [it]: s })}>
                    {s}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notes — what's working, what to keep, what to adjust" />
      </div>
    </Sheet>
  )
}
