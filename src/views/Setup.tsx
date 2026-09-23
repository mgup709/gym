import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Segmented } from '@/components/ui/controls'
import { Field, Input, NumInput } from '@/components/ui/input'
import { DAY_NAMES } from '@/lib/dates'
import { saveSettings } from '@/lib/repo'
import type { Settings } from '@/lib/types'

/** First-run setup. Everything is prefilled from your profile, so this is mostly a confirmation. */
export function SetupView({ settings }: { settings: Settings }) {
  const [s, setS] = useState<Settings>(settings)
  const [step, setStep] = useState(0)
  const finish = async () => saveSettings({ ...s, setupDone: true })

  return (
    <div className="mx-auto max-w-md px-4 pt-10 pb-16">
      <p className="text-sm text-ink-3">Welcome to</p>
      <h1 className="font-display text-5xl">Taper</h1>
      <p className="mt-3 text-[15px] text-ink-2">
        A calm place to track food, training, recovery and long-term trends toward a narrower waist, a stronger, fuller lower body, and
        staying properly nourished.
      </p>

      {step === 0 && (
        <Card className="mt-8 space-y-4">
          <h2 className="font-display text-xl">Your profile</h2>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Age">
              <NumInput value={s.age} onChange={(v) => setS({ ...s, age: v ?? s.age })} />
            </Field>
            <Field label="Height (in)">
              <NumInput value={s.heightIn} onChange={(v) => setS({ ...s, heightIn: v ?? s.heightIn })} />
            </Field>
            <Field label="Weight (lb)" hint="Optional">
              <NumInput value={s.baselineWeight} onChange={(v) => setS({ ...s, baselineWeight: v ?? 0 })} />
            </Field>
          </div>
          <Field label="Units">
            <Segmented
              value={`${s.units.weight}-${s.units.length}`}
              onChange={(v) => {
                const [weight, length] = v.split('-') as ['lb' | 'kg', 'in' | 'cm']
                setS({ ...s, units: { weight, length } })
              }}
              options={[
                { value: 'lb-in', label: 'lb · in' },
                { value: 'kg-cm', label: 'kg · cm' },
              ]}
            />
          </Field>
          <p className="text-sm text-ink-3">
            Your starting measurements (28 in waist, 31 in belly button, 37 in hips, plus front-view widths) and strength benchmarks are already loaded.
            Body weight is optional — it isn't the main progress measure here.
          </p>
          <Button className="w-full" onClick={() => setStep(1)}>
            Continue
          </Button>
        </Card>
      )}

      {step === 1 && (
        <Card className="mt-8 space-y-4">
          <h2 className="font-display text-xl">Your usual day</h2>
          <Field label="Usual wake time">
            <Input type="time" value={s.wakeTime} onChange={(e) => setS({ ...s, wakeTime: e.target.value })} />
          </Field>
          <div className="space-y-2">
            <div className="text-sm font-medium text-ink-2">Usual training time</div>
            {[1, 2, 3, 4, 5].map((d) => (
              <div key={d} className="flex items-center justify-between gap-3">
                <span className="text-sm">{DAY_NAMES[d]}</span>
                <Input
                  type="time"
                  className="h-9 w-32"
                  value={s.trainingTimes[d] ?? ''}
                  onChange={(e) => {
                    const tt = [...s.trainingTimes]
                    tt[d] = e.target.value || null
                    setS({ ...s, trainingTimes: tt })
                  }}
                />
              </div>
            ))}
            <p className="text-xs text-ink-3">Meal timing adapts to this. You can change it any day from the Today screen.</p>
          </div>
          <Field label="Friday salsa / bachata starts">
            <Input type="time" value={s.dance.time} onChange={(e) => setS({ ...s, dance: { ...s.dance, time: e.target.value } })} />
          </Field>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button className="flex-1" onClick={() => setStep(2)}>
              Continue
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="mt-8 space-y-4">
          <h2 className="font-display text-xl">Cycle context (optional)</h2>
          <p className="text-sm text-ink-3">
            Used only to add context to measurements, so period or premenstrual water retention is never mistaken for fat gain.
          </p>
          <Field label="First day of your last period">
            <Input type="date" value={s.cycle.lastStart ?? ''} onChange={(e) => setS({ ...s, cycle: { ...s.cycle, lastStart: e.target.value || null } })} />
          </Field>
          <Field label="Typical cycle length (days)">
            <NumInput value={s.cycle.length} onChange={(v) => setS({ ...s, cycle: { ...s.cycle, length: v ?? 28 } })} />
          </Field>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button className="flex-1" onClick={finish}>
              Start using Taper
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
