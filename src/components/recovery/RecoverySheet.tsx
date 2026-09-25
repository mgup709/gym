import { useLiveQuery } from 'dexie-react-hooks'
import { Button } from '@/components/ui/button'
import { Rating, Segmented } from '@/components/ui/controls'
import { Field, NumInput, Textarea } from '@/components/ui/input'
import { Sheet } from '@/components/ui/sheet'
import { db } from '@/lib/db'
import { useSettings } from '@/lib/hooks'
import { BINGE_LABEL } from '@/lib/recovery'
import type { BingeLevel, CycleDay, Flow, ISODate, Recovery } from '@/lib/types'
import { Chip } from '@/components/ui/controls'

export async function patchRecovery(date: ISODate, patch: Partial<Recovery>) {
  const cur = (await db.recovery.get(date)) ?? { date }
  await db.recovery.put({ ...cur, ...patch, date })
}

export async function patchCycle(date: ISODate, patch: Partial<CycleDay>) {
  const cur = (await db.cycle.get(date)) ?? { date }
  await db.cycle.put({ ...cur, ...patch, date })
}

export const REC_FIELDS: { key: keyof Recovery & string; label: string; low: string; high: string }[] = [
  { key: 'hunger', label: 'Hunger', low: 'low', high: 'very hungry' },
  { key: 'energy', label: 'Energy', low: 'drained', high: 'great' },
  { key: 'performance', label: 'Gym performance', low: 'weak', high: 'strong' },
  { key: 'soreness', label: 'Soreness', low: 'none', high: 'very sore' },
  { key: 'stress', label: 'Stress', low: 'calm', high: 'high' },
  { key: 'sleep', label: 'Sleep quality', low: 'poor', high: 'great' },
  { key: 'preoccupation', label: 'Food preoccupation', low: 'rarely', high: 'constant' },
]

const LEVELS = ['none', 'mild', 'medium', 'heavy'] as const

/** Private daily check-in: recovery ratings plus optional cycle notes. */
export function RecoverySheet({ open, onClose, date }: { open: boolean; onClose: () => void; date: ISODate }) {
  const settings = useSettings()
  const rec = useLiveQuery(() => db.recovery.get(date), [date]) ?? { date }
  const cyc = useLiveQuery(() => db.cycle.get(date), [date]) ?? { date }
  const set = (patch: Partial<Recovery>) => patchRecovery(date, patch)
  const setC = (patch: Partial<CycleDay>) => patchCycle(date, patch)
  return (
    <Sheet open={open} onClose={onClose} title="Daily check-in" footer={<Button className="w-full" onClick={onClose}>Done</Button>}>
      <div className="space-y-5">
        <p className="text-sm text-ink-3">Private and just for trends. Saved as you tap.</p>
        {REC_FIELDS.map((f) => (
          <Rating key={f.key} label={f.label} low={f.low} high={f.high} value={rec[f.key as 'hunger']} onChange={(v) => set({ [f.key]: v })} />
        ))}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sleep (hours)" hint="Fills in from Apple Health if set up">
            <NumInput value={rec.sleepHours} onChange={(v) => set({ sleepHours: v ?? undefined })} step="0.25" />
          </Field>
          <Field label="Resting HR (optional)">
            <NumInput value={rec.restingHR} onChange={(v) => set({ restingHR: v ?? undefined })} />
          </Field>
        </div>
        <div>
          <div className="mb-1.5 text-sm font-medium">Binge / loss-of-control eating</div>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.keys(BINGE_LABEL) as BingeLevel[]).map((b) => (
              <Chip key={b} active={rec.binge === b} onClick={() => set({ binge: rec.binge === b ? undefined : b })} className="justify-center">
                {BINGE_LABEL[b]}
              </Chip>
            ))}
          </div>
        </div>
        {settings?.cycle.enabled && (
          <div className="space-y-4 rounded-2xl bg-surface-2/60 p-3">
            <div className="text-sm font-semibold">Cycle (optional)</div>
            <Field label="Period / flow">
              <Segmented
                size="sm"
                value={(cyc.flow ?? 'none') as Flow}
                onChange={(v) => setC({ flow: v })}
                options={[
                  { value: 'none', label: 'None' },
                  { value: 'spotting', label: 'Spot' },
                  { value: 'light', label: 'Light' },
                  { value: 'medium', label: 'Med' },
                  { value: 'heavy', label: 'Heavy' },
                ]}
              />
            </Field>
            {(['cramps', 'bloating', 'cravings'] as const).map((k) => (
              <Field key={k} label={k[0].toUpperCase() + k.slice(1)}>
                <Segmented size="sm" value={String(cyc[k] ?? 0)} onChange={(v) => setC({ [k]: Number(v) })} options={LEVELS.map((l, i) => ({ value: String(i), label: l[0].toUpperCase() + l.slice(1) }))} />
              </Field>
            ))}
          </div>
        )}
        <Field label="Notes">
          <Textarea key={`${date}-${rec.note == null ? 0 : 1}`} defaultValue={rec.note ?? ''} onBlur={(e) => set({ note: e.target.value || undefined })} placeholder="Anything worth remembering" />
        </Field>
      </div>
    </Sheet>
  )
}
