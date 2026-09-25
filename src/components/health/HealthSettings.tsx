import { Copy, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input, NumInput } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { todayISO } from '@/lib/dates'
import { db } from '@/lib/db'
import { applyImport, importBaseURL, parseWorkoutCSV } from '@/lib/health'
import { uid } from '@/lib/utils'

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">{n}</span>
      <span>{children}</span>
    </li>
  )
}

export function HealthSettings() {
  const base = importBaseURL()
  const file = useRef<HTMLInputElement>(null)
  const [manual, setManual] = useState({ type: 'Traditional Strength Training', date: todayISO(), minutes: null as number | null, hr: null as number | null })

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast('Copied')
    } catch {
      toast(text)
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <p className="text-ink-2">
        Apple doesn't let websites read Apple Health directly — that takes a native iPhone app. Two ways to get your watch data in anyway:
        an <b>iOS Shortcut</b> that opens an import link, or a <b>CSV file</b> from a Health export app. Calories burned are never imported.
      </p>

      <div className="rounded-2xl bg-surface-2 p-3">
        <div className="mb-1 text-xs font-medium text-ink-3">Your import link</div>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate text-xs">{base}</code>
          <Button size="xs" variant="secondary" onClick={() => copy(base)}>
            <Copy className="size-3.5" /> Copy
          </Button>
        </div>
        <p className="mt-2 text-xs text-ink-3">
          Add values after it: <code>?sleep=7.5&amp;rhr=58</code> or <code>?workout=Strength&amp;start=16:05&amp;min=55&amp;hr=128</code>. Repeat{' '}
          <code>w=Type~start~minutes~avgHR</code> for several workouts. Links from the Shortcut should open this same installed app.
        </p>
      </div>

      <details>
        <summary className="cursor-pointer list-none font-medium text-accent">Shortcut: sleep + resting heart rate every morning</summary>
        <ol className="mt-2 space-y-1.5 text-ink-2">
          <Step n={1}>In the Shortcuts app, create a new shortcut called “Taper morning”.</Step>
          <Step n={2}>Add <b>Find Health Samples</b>: type <i>Sleep Analysis</i>, start date in the last 1 day (keep only the asleep stages if your iOS lists them).</Step>
          <Step n={3}>Add <b>Calculate Statistics</b> → <i>Sum</i> of the samples' <i>Duration</i> (in hours).</Step>
          <Step n={4}>Add <b>Find Health Samples</b>: type <i>Resting Heart Rate</i>, latest first, limit 1.</Step>
          <Step n={5}>
            Add <b>Text</b>: your import link + <code>?sleep=</code>[sum]<code>&amp;rhr=</code>[resting HR], then <b>Open URLs</b>.
          </Step>
          <Step n={6}>Automation tab → Time of Day (e.g. 8:00) → run “Taper morning”. Sleep hours then pre-fill your daily check-in.</Step>
        </ol>
      </details>

      <details>
        <summary className="cursor-pointer list-none font-medium text-accent">Workouts from your Apple Watch</summary>
        <div className="mt-2 space-y-2 text-ink-2">
          <p>
            The built-in Shortcuts app can't read workout details on every iOS version. Options that work:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <b>Health export app</b> (for example Health Auto Export): export <i>Workouts</i> as CSV, then import the file below. Columns like workout type, start,
              duration and average heart rate are recognised automatically, and re-importing never creates duplicates.
            </li>
            <li>
              <b>Shortcut with a workouts action</b> (from Toolbox Pro, or “Find Workouts” if your iOS has it): for each workout today, add
              <code> w=</code>[type]<code>~</code>[start]<code>~</code>[duration in minutes]<code>~</code>[avg heart rate] to the import link and open it. Run it with a
              “When Apple Watch workout ends” or evening automation.
            </li>
          </ul>
          <p className="text-xs text-ink-3">
            Imported workouts appear on Today and in the workout summary. A dance workout (salsa, bachata or “Dance”) marks dance night automatically.
          </p>
        </div>
      </details>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => file.current?.click()}>
          <Upload className="size-4" /> Import workouts CSV
        </Button>
      </div>
      <input
        ref={file}
        type="file"
        accept=".csv,text/csv,text/plain"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          const acts = parseWorkoutCSV(await f.text())
          if (!acts.length) return toast("Couldn't find workout type and duration columns in that file")
          const r = await applyImport({ activities: acts })
          toast(`Imported ${r.added} new workout${r.added === 1 ? '' : 's'}${r.updated ? `, updated ${r.updated}` : ''}`)
        }}
      />

      <details>
        <summary className="cursor-pointer list-none font-medium text-accent">Add a watch workout by hand</summary>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Field label="Type" className="col-span-2">
            <Input value={manual.type} onChange={(e) => setManual({ ...manual, type: e.target.value })} />
          </Field>
          <Field label="Date">
            <Input type="date" value={manual.date} onChange={(e) => setManual({ ...manual, date: e.target.value })} />
          </Field>
          <Field label="Minutes">
            <NumInput value={manual.minutes} onChange={(v) => setManual({ ...manual, minutes: v })} />
          </Field>
          <Field label="Avg heart rate (optional)">
            <NumInput value={manual.hr} onChange={(v) => setManual({ ...manual, hr: v })} />
          </Field>
          <div className="flex items-end">
            <Button
              className="w-full"
              size="sm"
              disabled={!manual.minutes || !manual.type.trim()}
              onClick={async () => {
                await db.activities.put({ id: uid(), date: manual.date, source: 'manual', type: manual.type.trim(), minutes: Math.round(manual.minutes!), avgHR: manual.hr ?? undefined })
                toast('Workout added')
                setManual({ ...manual, minutes: null, hr: null })
              }}
            >
              Add
            </Button>
          </div>
        </div>
      </details>
    </div>
  )
}
