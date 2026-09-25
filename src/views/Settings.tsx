import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { HealthSettings } from '@/components/health/HealthSettings'
import { Button } from '@/components/ui/button'
import { Card, Section } from '@/components/ui/card'
import { Segmented, Switch } from '@/components/ui/controls'
import { Field, Input, NumInput, Select } from '@/components/ui/input'
import { Sheet } from '@/components/ui/sheet'
import { toast } from '@/components/ui/toast'
import { DAY_NAMES } from '@/lib/dates'
import { db } from '@/lib/db'
import { exportCSVZip, exportJSON, restoreJSON } from '@/lib/exportdata'
import { useSettings } from '@/lib/hooks'
import { carbRange, DAY_TYPE_LABEL, DEFAULT_MICROS, DEFAULT_TARGETS, MICRO_INFO } from '@/lib/nutrition'
import { saveSettings } from '@/lib/repo'
import type { DayTargets, DayType, Exercise, PlannedExercise, QuickGroup, Range, Settings, WorkoutTemplate } from '@/lib/types'
import { MICROS } from '@/lib/types'
import { cn, uid } from '@/lib/utils'

const TARGET_KEYS: (DayType | 'default')[] = ['default', 'lowerA', 'upper', 'lowerB', 'lowerC', 'dance', 'core', 'rest']

function RangeInput({ label, value, onChange, unit }: { label: string; value: Range; onChange: (r: Range) => void; unit: string }) {
  return (
    <div className="grid grid-cols-[1fr_5rem_auto_5rem] items-center gap-2">
      <span className="text-sm">
        {label} <span className="text-xs text-ink-3">({unit})</span>
      </span>
      <NumInput className="h-9 px-2 text-center" value={value.min} onChange={(v) => onChange({ ...value, min: v ?? 0 })} />
      <span className="text-ink-3">–</span>
      <NumInput className="h-9 px-2 text-center" value={value.max} onChange={(v) => onChange({ ...value, max: v ?? 0 })} />
    </div>
  )
}

export function SettingsView() {
  const settings = useSettings()
  const templates = useLiveQuery(() => db.templates.toArray(), [])
  const [editT, setEditT] = useState<WorkoutTemplate | null>(null)
  const [targetKey, setTargetKey] = useState<DayType | 'default'>('default')
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null))
  }, [])
  if (!settings || !templates) return null
  const set = (patch: Partial<Settings>) => saveSettings({ ...settings, ...patch })
  const t = settings.targets[targetKey]
  const setT = (patch: Partial<DayTargets>) => set({ targets: { ...settings.targets, [targetKey]: { ...t, ...patch } } })

  return (
    <div className="space-y-4">
      <header className="pt-2">
        <h1 className="font-display text-4xl leading-tight">Settings</h1>
      </header>

      <Section title="Nutrition targets" subtitle="Ranges, not pass/fail numbers. Changes apply from today — past days keep their targets." defaultOpen>
        <Switch checked={settings.steadyIntake} onChange={(v) => set({ steadyIntake: v })} label="Steady intake every day" hint="Use the default targets every day instead of adjusting by day type." />
        <Select value={targetKey} onChange={(e) => setTargetKey(e.target.value as DayType | 'default')}>
          {TARGET_KEYS.map((k) => (
            <option key={k} value={k}>
              {k === 'default' ? 'Default / steady day' : DAY_TYPE_LABEL[k]}
            </option>
          ))}
        </Select>
        <div className="space-y-2">
          <RangeInput label="Calories" unit="kcal" value={t.kcal} onChange={(kcal) => setT({ kcal })} />
          <RangeInput label="Protein" unit="g" value={t.protein} onChange={(protein) => setT({ protein })} />
          <RangeInput label="Fat" unit="g" value={t.fat} onChange={(fat) => setT({ fat: { min: Math.max(40, fat.min), max: fat.max } })} />
          {t.carbs ? <RangeInput label="Carbs" unit="g" value={t.carbs} onChange={(carbs) => setT({ carbs })} /> : <p className="text-sm text-ink-2">Carbs fill the remaining calories (about {carbRange(t).min}–{carbRange(t).max} g).</p>}
          <Switch checked={!t.carbs} onChange={(v) => setT({ carbs: v ? null : carbRange(t) })} label="Carbs fill remaining calories" />
          <RangeInput label="Fiber" unit="g" value={t.fiber} onChange={(fiber) => setT({ fiber })} />
        </div>
        <p className="text-xs text-ink-3">Fat has a floor of 40 g in this editor — very-low-fat intake isn't supported.</p>
        <Button size="sm" variant="ghost" onClick={() => set({ targets: structuredClone(DEFAULT_TARGETS) })}>
          Reset to the original plan
        </Button>
        <details>
          <summary className="cursor-pointer list-none text-sm font-medium text-accent">Micronutrient & whole-food goals</summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {MICROS.map((m) => (
              <Field key={m} label={`${MICRO_INFO[m].label} (${MICRO_INFO[m].unit})`}>
                <NumInput value={settings.microTargets[m]} onChange={(v) => set({ microTargets: { ...settings.microTargets, [m]: v ?? DEFAULT_MICROS[m] } })} />
              </Field>
            ))}
            <Field label="Fruit servings/day">
              <NumInput value={settings.wholeFood.fruit} onChange={(v) => set({ wholeFood: { ...settings.wholeFood, fruit: v ?? 2 } })} />
            </Field>
            <Field label="Vegetable servings/day">
              <NumInput value={settings.wholeFood.veg} onChange={(v) => set({ wholeFood: { ...settings.wholeFood, veg: v ?? 3 } })} />
            </Field>
            <Field label="Calcium-rich servings/day">
              <NumInput value={settings.wholeFood.calcium} onChange={(v) => set({ wholeFood: { ...settings.wholeFood, calcium: v ?? 2 } })} />
            </Field>
          </div>
        </details>
      </Section>

      <Section title="Training program" subtitle="Weekly schedule, training times and exercises">
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <div key={d} className="grid grid-cols-[3rem_1fr_7rem] items-center gap-2">
              <span className="text-sm text-ink-2">{DAY_NAMES[d].slice(0, 3)}</span>
              <Select
                className="h-9"
                value={settings.schedule[d]}
                onChange={(e) => {
                  const schedule = [...settings.schedule]
                  schedule[d] = e.target.value
                  set({ schedule })
                }}
              >
                <option value="rest">Rest</option>
                <option value="dance">Dance night (no lifting)</option>
                {templates.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </Select>
              <Input
                type="time"
                className="h-9"
                value={settings.trainingTimes[d] ?? ''}
                onChange={(e) => {
                  const trainingTimes = [...settings.trainingTimes]
                  trainingTimes[d] = e.target.value || null
                  set({ trainingTimes })
                }}
                aria-label={`${DAY_NAMES[d]} training time`}
              />
            </div>
          ))}
        </div>
        <Field label="Usual wake time" hint="Used for breakfast timing.">
          <Input type="time" value={settings.wakeTime} onChange={(e) => set({ wakeTime: e.target.value })} className="w-36" />
        </Field>
        <Switch checked={settings.dance.enabled} onChange={(v) => set({ dance: { ...settings.dance, enabled: v } })} label="Salsa / bachata night" hint="Adjusts that day's meal timing. No calorie estimates, nothing to 'eat back'." />
        {settings.dance.enabled && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Day">
              <Select value={settings.dance.weekday} onChange={(e) => set({ dance: { ...settings.dance, weekday: Number(e.target.value) } })}>
                {DAY_NAMES.map((n, i) => (
                  <option key={i} value={i}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Starts">
              <Input type="time" value={settings.dance.time} onChange={(e) => set({ dance: { ...settings.dance, time: e.target.value } })} />
            </Field>
          </div>
        )}
        <div className="space-y-2">
          <div className="text-sm font-medium">Workouts</div>
          {templates.map((x) => (
            <button key={x.id} className="flex w-full items-center justify-between rounded-2xl border border-border px-3 py-2.5 text-left" onClick={() => setEditT(structuredClone(x))}>
              <span className="text-sm">{x.name}</span>
              <span className="text-xs text-ink-3">{x.exercises.length} exercises · edit</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Apple Watch & Health" subtitle="Bring in watch workouts, sleep and resting heart rate">
        <HealthSettings />
      </Section>

      <Section title="Quick Log & favorites" subtitle="What appears as one-tap checkboxes">
        <QuickLogEditor />
      </Section>

      <Section title="Check-ins & notifications">
        <Field label="Measurement day">
          <Select value={settings.measurementDay} onChange={(e) => set({ measurementDay: Number(e.target.value) })}>
            {DAY_NAMES.map((n, i) => (
              <option key={i} value={i}>
                {n}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Progress photos">
          <Segmented value={settings.photoFrequency} onChange={(v) => set({ photoFrequency: v })} options={[{ value: 'weekly', label: 'Weekly' }, { value: '4weeks', label: 'Every 4 weeks' }]} />
        </Field>
        <Switch checked={settings.notifications.weeklyCheckIn} onChange={(v) => set({ notifications: { ...settings.notifications, weeklyCheckIn: v } })} label="Weekly check-in reminder" hint="A small dot on Progress when it's due — never on the Today screen." />
        <Switch
          checked={settings.notifications.browser}
          onChange={async (v) => {
            if (v && 'Notification' in window) {
              const p = await Notification.requestPermission()
              if (p !== 'granted') return toast('Notifications were not allowed by the browser')
            }
            set({ notifications: { ...settings.notifications, browser: v } })
          }}
          label="Device notification on check-in day"
          hint="Shown when you open the app on measurement day."
        />
      </Section>

      {
        <Section title="Menstrual cycle" subtitle="Optional context for measurements">
          <Switch checked={settings.cycle.enabled} onChange={(v) => set({ cycle: { ...settings.cycle, enabled: v } })} label="Track cycle context" />
          {settings.cycle.enabled && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Last period started">
                <Input type="date" value={settings.cycle.lastStart ?? ''} onChange={(e) => set({ cycle: { ...settings.cycle, lastStart: e.target.value || null } })} />
              </Field>
              <Field label="Typical length (days)">
                <NumInput value={settings.cycle.length} onChange={(v) => set({ cycle: { ...settings.cycle, length: v ?? 28 } })} />
              </Field>
              <Field label="Period length (days)">
                <NumInput value={settings.cycle.periodLength} onChange={(v) => set({ cycle: { ...settings.cycle, periodLength: v ?? 5 } })} />
              </Field>
              <Field label="Note" className="col-span-2">
                <Input value={settings.cycle.note} onChange={(e) => set({ cycle: { ...settings.cycle, note: e.target.value } })} />
              </Field>
            </div>
          )}
          <p className="text-xs text-ink-3">Log period days, cramps and bloating in the daily check-in. Logged starts refine the cycle-day estimate automatically.</p>
        </Section>
      }

      <Section title="Profile & appearance">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Age">
            <NumInput value={settings.age} onChange={(v) => set({ age: v ?? settings.age })} />
          </Field>
          <Field label="Height (in)">
            <NumInput value={settings.heightIn} onChange={(v) => set({ heightIn: v ?? settings.heightIn })} />
          </Field>
          <Field label="Current weight (lb)" hint="Optional">
            <NumInput value={settings.baselineWeight} onChange={(v) => set({ baselineWeight: v ?? 0 })} />
          </Field>
        </div>
        <Field label="Units">
          <Segmented
            value={`${settings.units.weight}-${settings.units.length}`}
            onChange={(v) => {
              const [weight, length] = v.split('-') as ['lb' | 'kg', 'in' | 'cm']
              set({ units: { weight, length } })
            }}
            options={[
              { value: 'lb-in', label: 'lb · in' },
              { value: 'kg-cm', label: 'kg · cm' },
              { value: 'lb-cm', label: 'lb · cm' },
              { value: 'kg-in', label: 'kg · in' },
            ]}
          />
        </Field>
        <Field label="Theme">
          <Segmented value={settings.theme} onChange={(v) => set({ theme: v })} options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
        </Field>
        <Field label="Plan start date" hint="Used for checkpoints and baseline comparisons.">
          <Input type="date" value={settings.startDate} onChange={(e) => e.target.value && set({ startDate: e.target.value })} className="w-44" />
        </Field>
        <div className="space-y-2">
          <div className="text-sm font-medium">Checkpoints</div>
          {settings.checkpoints.map((c, i) => (
            <div key={i} className="grid grid-cols-[1fr_9.5rem] gap-2">
              <Input className="h-9" value={c.label} onChange={(e) => set({ checkpoints: settings.checkpoints.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
              <Input className="h-9" type="date" value={c.date} onChange={(e) => set({ checkpoints: settings.checkpoints.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)) })} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Your data" subtitle="Stored only on this device. Export regularly." defaultOpen>
        <p className="text-sm text-ink-2">
          {persisted ? 'Storage is protected from automatic clearing by the browser.' : 'Tip: install the app to your home screen so the browser keeps its storage.'}
          {settings.lastBackup ? ` Last backup ${new Date(settings.lastBackup).toLocaleDateString()}.` : ' No backup yet.'}
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            onClick={async () => {
              await exportJSON(true)
              set({ lastBackup: Date.now() })
            }}
          >
            Full backup (JSON, with photos)
          </Button>
          <Button variant="outline" onClick={() => exportJSON(false)}>
            Backup without photos
          </Button>
          <Button variant="outline" onClick={exportCSVZip}>
            Export spreadsheets (CSV zip)
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            Restore from backup
          </Button>
        </div>
        <p className="text-xs text-ink-3">CSV export includes daily nutrition (with that day's targets), food log, foods, meals & recipes, workouts, exercise sets, measurements, recovery, cycle data and weekly reviews.</p>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            if (!confirm('Restoring replaces everything in the app with the backup. Continue?')) return
            try {
              await restoreJSON(await f.text())
              toast('Backup restored')
            } catch (err) {
              toast(String((err as Error).message ?? err))
            }
          }}
        />
        <Button variant="ghost" className="text-ink-3" onClick={() => setConfirmReset(true)}>
          Erase all data…
        </Button>
      </Section>

      <p className="px-1 pb-4 text-center text-xs text-ink-3">Taper · local-first · no accounts, no tracking</p>

      <TemplateEditor template={editT} onClose={() => setEditT(null)} />
      <Sheet
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Erase all data?"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={async () => {
                await db.delete()
                location.reload()
              }}
            >
              Erase everything
            </Button>
          </div>
        }
      >
        <p className="text-sm text-ink-2">This permanently deletes all logs, measurements, photos and settings on this device. Make a backup first if you might want them.</p>
      </Sheet>
    </div>
  )
}

function QuickLogEditor() {
  const foods = useLiveQuery(() => db.foods.toArray(), [])
  const [add, setAdd] = useState('')
  const [group, setGroup] = useState<QuickGroup>('snacks')
  if (!foods) return null
  const groups: QuickGroup[] = ['breakfast', 'snacks', 'meals', 'sides', 'fruit', 'extras']
  const move = async (g: QuickGroup, idx: number, dir: -1 | 1) => {
    const list = foods.filter((f) => f.quickLog === g).sort((a, b) => (a.quickOrder ?? 50) - (b.quickOrder ?? 50) || a.name.localeCompare(b.name))
    const j = idx + dir
    if (j < 0 || j >= list.length) return
    ;[list[idx], list[j]] = [list[j], list[idx]]
    await db.foods.bulkPut(list.map((f, i) => ({ ...f, quickOrder: i })))
  }
  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const list = foods.filter((f) => f.quickLog === g).sort((a, b) => (a.quickOrder ?? 50) - (b.quickOrder ?? 50) || a.name.localeCompare(b.name))
        return (
          <div key={g}>
            <div className="mb-1 text-xs font-semibold tracking-wide text-ink-3 uppercase">{g}</div>
            <ul className="divide-y divide-border">
              {list.map((f, i) => (
                <li key={f.id} className="flex items-center gap-1 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <button className="p-1.5 text-ink-3" onClick={() => move(g, i, -1)} aria-label="Move up">
                    <ArrowUp className="size-4" />
                  </button>
                  <button className="p-1.5 text-ink-3" onClick={() => move(g, i, 1)} aria-label="Move down">
                    <ArrowDown className="size-4" />
                  </button>
                  <button className="p-1.5 text-ink-3" onClick={() => db.foods.update(f.id, { quickLog: undefined })} aria-label="Remove from Quick Log">
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
      <div className="grid grid-cols-[1fr_7rem_auto] gap-2">
        <Select value={add} onChange={(e) => setAdd(e.target.value)} className="h-9">
          <option value="">Add a food…</option>
          {foods
            .filter((f) => !f.quickLog && !f.archived)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
        </Select>
        <Select value={group} onChange={(e) => setGroup(e.target.value as QuickGroup)} className="h-9">
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </Select>
        <Button size="sm" variant="secondary" disabled={!add} onClick={async () => {
          await db.foods.update(add, { quickLog: group, quickOrder: 99 })
          setAdd('')
        }}>
          Add
        </Button>
      </div>
      <p className="text-xs text-ink-3">Mark favorites and edit portions from Food → Your foods. Saved meals remember the portions you set.</p>
    </div>
  )
}

function TemplateEditor({ template, onClose }: { template: WorkoutTemplate | null; onClose: () => void }) {
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
  const [t, setT] = useState<WorkoutTemplate | null>(template)
  const [addId, setAddId] = useState('')
  const [newEx, setNewEx] = useState<{ name: string; knee: boolean; perLeg: boolean } | null>(null)
  useEffect(() => setT(template), [template])
  if (!t || !exercises) return null
  const exMap = new Map(exercises.map((e) => [e.id, e]))
  const setP = (i: number, patch: Partial<PlannedExercise>) => setT({ ...t, exercises: t.exercises.map((p, j) => (j === i ? { ...p, ...patch } : p)) })
  const move = (i: number, d: -1 | 1) => {
    const list = [...t.exercises]
    const j = i + d
    if (j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    setT({ ...t, exercises: list })
  }
  const addExercise = (id: string) => {
    const ex = exMap.get(id)
    const iso = ex?.cls === 'isolation' || ex?.cls === 'core'
    setT({ ...t, exercises: [...t.exercises, { exerciseId: id, sets: 3, repMin: iso ? 12 : 8, repMax: iso ? 20 : 12, rirMin: iso ? 0 : 1, rirMax: 2, restMin: iso ? 60 : 120, restMax: iso ? 90 : 180 }] })
  }
  return (
    <Sheet
      open={!!template}
      onClose={onClose}
      title="Edit workout"
      footer={
        <Button
          className="w-full"
          onClick={async () => {
            await db.templates.put(t)
            toast('Workout saved — past sessions are unchanged')
            onClose()
          }}
        >
          Save workout
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <Input value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} />
        </Field>
        <Field label="Goal">
          <Input value={t.goal} onChange={(e) => setT({ ...t, goal: e.target.value })} />
        </Field>
        {t.exercises.map((p, i) => (
          <Card key={i} className="space-y-2 p-3">
            <div className="flex items-center gap-1">
              <Select value={p.exerciseId} onChange={(e) => setP(i, { exerciseId: e.target.value })} className="h-9 flex-1">
                {exercises.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </Select>
              <button className="p-1.5 text-ink-3" onClick={() => move(i, -1)} aria-label="Move up">
                <ArrowUp className="size-4" />
              </button>
              <button className="p-1.5 text-ink-3" onClick={() => move(i, 1)} aria-label="Move down">
                <ArrowDown className="size-4" />
              </button>
              <button className="p-1.5 text-ink-3" onClick={() => setT({ ...t, exercises: t.exercises.filter((_, j) => j !== i) })} aria-label="Remove">
                <Trash2 className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <Field label="Sets"><NumInput className="h-9 px-2 text-center" value={p.sets} onChange={(v) => setP(i, { sets: v ?? 1 })} /></Field>
              <Field label="Reps min"><NumInput className="h-9 px-2 text-center" value={p.repMin} onChange={(v) => setP(i, { repMin: v ?? 1 })} /></Field>
              <Field label="Reps max"><NumInput className="h-9 px-2 text-center" value={p.repMax} onChange={(v) => setP(i, { repMax: v ?? 1 })} /></Field>
              <Field label="Rest s"><NumInput className="h-9 px-2 text-center" value={p.restMin} onChange={(v) => setP(i, { restMin: v ?? 0, restMax: Math.max(p.restMax, v ?? 0) })} /></Field>
              <Field label="RIR min"><NumInput className="h-9 px-2 text-center" value={p.rirMin} onChange={(v) => setP(i, { rirMin: v ?? 0 })} /></Field>
              <Field label="RIR max"><NumInput className="h-9 px-2 text-center" value={p.rirMax} onChange={(v) => setP(i, { rirMax: v ?? 0 })} /></Field>
              <label className={cn('col-span-2 flex items-end gap-2 pb-2 text-sm')}>
                <input type="checkbox" checked={!!p.optional} onChange={(e) => setP(i, { optional: e.target.checked })} className="size-4 accent-[var(--accent)]" /> Optional
              </label>
            </div>
          </Card>
        ))}
        <div className="flex gap-2">
          <Select value={addId} onChange={(e) => setAddId(e.target.value)} className="flex-1">
            <option value="">Add exercise…</option>
            {exercises.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </Select>
          <Button variant="secondary" disabled={!addId} onClick={() => { addExercise(addId); setAddId('') }}>
            Add
          </Button>
        </div>
        {newEx ? (
          <Card className="space-y-2 p-3">
            <Field label="New exercise name">
              <Input value={newEx.name} onChange={(e) => setNewEx({ ...newEx, name: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={newEx.knee} onChange={(e) => setNewEx({ ...newEx, knee: e.target.checked })} className="size-4 accent-[var(--accent)]" /> Lower body (show Pain / Discomfort)</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={newEx.perLeg} onChange={(e) => setNewEx({ ...newEx, perLeg: e.target.checked })} className="size-4 accent-[var(--accent)]" /> Reps per leg</label>
            <Button
              size="sm"
              disabled={!newEx.name.trim()}
              onClick={async () => {
                const ex: Exercise = { id: `custom-${uid()}`, name: newEx.name.trim(), kind: 'weighted', cls: newEx.perLeg ? 'unilateral' : 'isolation', knee: newEx.knee, perLeg: newEx.perLeg, increment: 5, alternatives: [], custom: true }
                await db.exercises.put(ex)
                addExercise(ex.id)
                setNewEx(null)
              }}
            >
              Create and add
            </Button>
          </Card>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setNewEx({ name: '', knee: true, perLeg: false })}>
            <Plus className="size-4" /> Create a custom exercise
          </Button>
        )}
      </div>
    </Sheet>
  )
}
