import { useLiveQuery } from 'dexie-react-hooks'
import { Sparkles } from 'lucide-react'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { toast } from '@/components/ui/toast'
import { addDays } from '@/lib/dates'
import { db } from '@/lib/db'
import { useNow } from '@/lib/hooks'
import { deleteEntry, logFood } from '@/lib/repo'
import { suggest } from '@/lib/suggest'
import type { FoodEntry, ISODate, Settings, DayLog } from '@/lib/types'

export function SuggestSheet({ open, onClose, date, day, entries, settings, training, dance }: { open: boolean; onClose: () => void; date: ISODate; day: DayLog; entries: FoodEntry[]; settings: Settings; training: string | null; dance: string | null }) {
  const now = useNow()
  const foods = useLiveQuery(() => db.foods.toArray(), [])
  const history = useLiveQuery(() => db.entries.where('date').between(addDays(date, -30), date).toArray(), [date])
  const hunger = useLiveQuery(() => db.recovery.get(date), [date])?.hunger
  const res = useMemo(() => {
    if (!foods || !history || !open) return null
    return suggest({ now, targets: day.targets, training, dance, wake: settings.wakeTime, entries, history, foods, hunger, fruitGoal: settings.wholeFood.fruit, today: date })
  }, [foods, history, open, now, day, training, dance, settings, entries, hunger, date])

  return (
    <Sheet open={open} onClose={onClose} title={<span className="flex items-center gap-2"><Sparkles className="size-5 text-accent" /> What should I eat next?</span>}>
      {res && (
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-[15px]">{res.headline}</p>
            {res.lines.map((l) => (
              <p key={l} className="text-sm text-ink-2">{l}</p>
            ))}
          </div>
          <div className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Good options from your foods</div>
          <ol className="space-y-2">
            {res.items.map((s, i) => (
              <li key={s.food.id} className="flex items-center gap-3 rounded-2xl border border-border p-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] leading-snug">{s.food.name}</div>
                  <div className="text-xs text-ink-3">{s.reason}</div>
                </div>
                <Button
                  size="sm"
                  variant="soft"
                  onClick={async () => {
                    const e = await logFood(date, s.food, { source: 'suggest' })
                    toast(`Logged ${s.food.name}`, () => deleteEntry(e.id).then(() => undefined))
                    onClose()
                  }}
                >
                  Log
                </Button>
              </li>
            ))}
          </ol>
          {res.items.length === 0 && <p className="text-sm text-ink-3">Add a few foods to your library and this will start suggesting from them.</p>}
          <p className="text-xs text-ink-3">Suggestions use only foods in your library and their stored nutrition values.</p>
        </div>
      )}
    </Sheet>
  )
}
