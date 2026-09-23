import { useLiveQuery } from 'dexie-react-hooks'
import { Activity, ChevronRight, Clock, Dumbbell, HeartPulse, Plus, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { DayMeals } from '@/components/food/DayMeals'
import { FoodPicker } from '@/components/food/FoodPicker'
import { MealRhythm } from '@/components/food/MealRhythm'
import { NutritionSummary } from '@/components/food/NutritionSummary'
import { QuickLog } from '@/components/food/QuickLog'
import { SuggestSheet } from '@/components/food/SuggestSheet'
import { useDay } from '@/components/food/useDay'
import { patchRecovery, RecoverySheet } from '@/components/recovery/RecoverySheet'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, Pill } from '@/components/ui/card'
import { Rating } from '@/components/ui/controls'
import { Field, Input, Select } from '@/components/ui/input'
import { Sheet } from '@/components/ui/sheet'
import { db } from '@/lib/db'
import { fmtDate, fmtTime, weekday } from '@/lib/dates'
import { navigate, useCycle, useNow, useSettings, useToday } from '@/lib/hooks'
import { dayRhythm } from '@/lib/mealtiming'
import { DAY_TYPE_LABEL } from '@/lib/nutrition'
import { recoverySignals, RECOVERY_MESSAGE } from '@/lib/recovery'
import { ensureDay, setDayType } from '@/lib/repo'
import type { DayType, ISODate, Settings } from '@/lib/types'
import { startSession } from '@/lib/workouts'

export function trainingTimeFor(settings: Settings, date: ISODate, override?: string | null, dayType?: DayType): string | null {
  if (override === '') return null
  if (override) return override
  if (dayType === 'rest') return null
  return settings.trainingTimes[weekday(date)] ?? null
}

export function danceTimeFor(settings: Settings, date: ISODate): string | null {
  return settings.dance.enabled && weekday(date) === settings.dance.weekday ? settings.dance.time : null
}

export function TodayView() {
  const settings = useSettings()
  const today = useToday()
  const now = useNow()
  const data = useDay(today, settings)
  const cycle = useCycle(today, settings)
  const templates = useLiveQuery(() => db.templates.toArray(), [])
  const sessions = useLiveQuery(() => db.sessions.where('date').equals(today).toArray(), [today])
  const active = useLiveQuery(() => db.sessions.where('status').equals('active').first(), [])
  const rec = useLiveQuery(() => db.recovery.get(today), [today])
  const recent = useLiveQuery(() => db.recovery.toArray(), [])
  const [addOpen, setAddOpen] = useState(false)
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [recOpen, setRecOpen] = useState(false)
  const [dayOpen, setDayOpen] = useState(false)

  useEffect(() => {
    if (settings?.setupDone) ensureDay(today)
  }, [today, settings?.setupDone])

  const signals = useMemo(() => (recent ? recoverySignals(recent, today) : null), [recent, today])

  if (!settings || !data || !templates) return null
  const day = data.day
  const template = day.dayType === 'rest' ? null : (templates.find((t) => t.id === settings.schedule[weekday(today)] && t.dayType === day.dayType) ?? templates.find((t) => t.dayType === day.dayType))
  const training = trainingTimeFor(settings, today, day.workoutTime, day.dayType)
  const dance = danceTimeFor(settings, today)
  const rhythm = dayRhythm({ wake: settings.wakeTime, training, dance })
  const logged = new Set(data.entries.map((e) => e.meal))
  const doneToday = sessions?.find((s) => s.status === 'done')

  const start = async () => {
    if (active) return navigate('workout/session')
    if (!template) return navigate('workout')
    await startSession(template, today)
    navigate('workout/session')
  }

  return (
    <div className="space-y-4">
      <header className="pt-2">
        <p className="text-sm text-ink-3">{fmtDate(today, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        <h1 className="font-display text-4xl leading-tight">Today</h1>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button onClick={() => setDayOpen(true)}>
            <Pill tone="accent">{DAY_TYPE_LABEL[day.dayType]}</Pill>
          </button>
          <button onClick={() => setDayOpen(true)}>
            <Pill>
              <Clock className="size-3" /> {training ? `Training ${fmtTime(training)}` : 'No training time'}
            </Pill>
          </button>
          {dance && <Pill tone="sage">Dance {fmtTime(dance)}</Pill>}
          {cycle && (
            <Pill>
              Cycle day {cycle.day}
              {cycle.estimated ? ' (est.)' : ''} · {cycle.label}
            </Pill>
          )}
        </div>
      </header>

      {signals?.concern && (
        <Card className="border-amber/30 bg-amber-soft/60">
          <div className="flex gap-3">
            <HeartPulse className="mt-0.5 size-5 shrink-0 text-amber" />
            <div className="space-y-1 text-sm">
              <p className="font-medium">A gentle check on recovery</p>
              <p className="text-ink-2">{RECOVERY_MESSAGE}</p>
              <ul className="list-disc pl-4 text-xs text-ink-3">
                {signals.signals.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Workout" action={<Dumbbell className="size-4 text-ink-3" />} />
        {template ? (
          <div className="space-y-3">
            <div>
              <div className="font-display text-xl leading-snug">{template.name}</div>
              <div className="text-sm text-ink-3">
                {template.goal} · {template.exercises.length} exercises
              </div>
              {template.finisher && <div className="mt-1 text-sm text-sage">{template.finisher}</div>}
            </div>
            {doneToday && !active ? (
              <button onClick={() => navigate(`workout/summary/${doneToday.id}`)} className="flex w-full items-center justify-between rounded-2xl bg-sage-soft px-4 py-3 text-left text-sm text-sage">
                <span className="font-medium">Workout completed ✓</span>
                <ChevronRight className="size-4" />
              </button>
            ) : (
              <Button className="w-full" size="lg" onClick={start}>
                <Activity className="size-4" /> {active ? 'Continue workout' : 'Start workout'}
              </Button>
            )}
          </div>
        ) : (
          <p className="text-sm text-ink-2">Rest day. Recovery is part of the plan — an easy walk is optional.</p>
        )}
      </Card>

      <Card>
        <CardHeader title="Nutrition" subtitle={settings.steadyIntake ? 'Steady intake' : `${DAY_TYPE_LABEL[day.dayType]} targets`} />
        <NutritionSummary data={data} />
        <Button variant="soft" className="mt-4 w-full" onClick={() => setSuggestOpen(true)}>
          <Sparkles className="size-4" /> What should I eat next?
        </Button>
      </Card>

      <Card>
        <CardHeader title="Quick log" subtitle="Your regular foods — one tap" />
        <QuickLog date={today} entries={data.entries} groups={['breakfast', 'snacks', 'meals', 'sides', 'fruit', 'extras']} />
      </Card>

      <Card>
        <CardHeader
          title="Meals"
          action={
            <Button size="xs" variant="secondary" onClick={() => setAddOpen(true)}>
              <Plus className="size-3.5" /> Add food
            </Button>
          }
        />
        <DayMeals date={today} entries={data.entries} />
      </Card>

      <Card>
        <CardHeader title="Meal timing" subtitle={training ? `Built around training at ${fmtTime(training)}` : dance ? 'Built around dancing tonight' : 'No training today'} />
        <MealRhythm items={rhythm} logged={logged} now={now} isToday />
      </Card>

      <Card>
        <CardHeader
          title="Recovery"
          action={
            <Button size="xs" variant="ghost" onClick={() => setRecOpen(true)}>
              More <ChevronRight className="size-3.5" />
            </Button>
          }
        />
        <div className="space-y-3">
          <Rating label="Hunger" low="low" high="very hungry" value={rec?.hunger} onChange={(v) => patchRecovery(today, { hunger: v })} />
          <Rating label="Energy" low="drained" high="great" value={rec?.energy} onChange={(v) => patchRecovery(today, { energy: v })} />
          <Rating label="Soreness" low="none" high="very sore" value={rec?.soreness} onChange={(v) => patchRecovery(today, { soreness: v })} />
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <Button variant="outline" className="h-auto flex-col gap-1 rounded-2xl py-3" onClick={() => setAddOpen(true)}>
          <Plus className="size-5" />
          <span className="text-xs">Add food</span>
        </Button>
        <Button variant="outline" className="h-auto flex-col gap-1 rounded-2xl py-3" onClick={start}>
          <Dumbbell className="size-5" />
          <span className="text-xs">{active ? 'Continue' : 'Start workout'}</span>
        </Button>
        <Button variant="outline" className="h-auto flex-col gap-1 rounded-2xl py-3" onClick={() => setRecOpen(true)}>
          <HeartPulse className="size-5" />
          <span className="text-xs">Log recovery</span>
        </Button>
      </div>

      <FoodPicker open={addOpen} onClose={() => setAddOpen(false)} date={today} />
      <SuggestSheet open={suggestOpen} onClose={() => setSuggestOpen(false)} date={today} day={day} entries={data.entries} settings={settings} training={training} dance={dance} />
      <RecoverySheet open={recOpen} onClose={() => setRecOpen(false)} date={today} />
      <DaySheet open={dayOpen} onClose={() => setDayOpen(false)} date={today} dayType={day.dayType} training={training} />
    </div>
  )
}

function DaySheet({ open, onClose, date, dayType, training }: { open: boolean; onClose: () => void; date: ISODate; dayType: DayType; training: string | null }) {
  const [time, setTime] = useState(training ?? '')
  useEffect(() => setTime(training ?? ''), [training, open])
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Today’s plan"
      footer={
        <Button
          className="w-full"
          onClick={async () => {
            const d = await ensureDay(date)
            await db.days.put({ ...d, workoutTime: time })
            onClose()
          }}
        >
          Save
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Day type" hint="Swapped days? Changing this updates today's targets and workout.">
          <Select value={dayType} onChange={(e) => setDayType(date, e.target.value as DayType)}>
            {(Object.keys(DAY_TYPE_LABEL) as DayType[]).map((t) => (
              <option key={t} value={t}>
                {DAY_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Training time today" hint="Meal timing adapts to this. Clear it for no training.">
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  )
}
