import { Copy, Plus, Save, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { Sheet } from '@/components/ui/sheet'
import { toast } from '@/components/ui/toast'
import { addDays, fmtTime } from '@/lib/dates'
import { dayTotals, entryTotal } from '@/lib/nutrition'
import { copyEntries, deleteEntry, entriesFor, restoreEntries, saveMealFromEntries } from '@/lib/repo'
import { db } from '@/lib/db'
import type { FoodEntry, ISODate, MealSlot } from '@/lib/types'
import { fmtNum } from '@/lib/utils'
import { LogSheet, MEAL_LABEL, MEALS } from './LogSheet'
import { FoodPicker } from './FoodPicker'

export function DayMeals({ date, entries, showEmpty = true, actions = true }: { date: ISODate; entries: FoodEntry[]; showEmpty?: boolean; actions?: boolean }) {
  const [edit, setEdit] = useState<FoodEntry | null>(null)
  const [pickFor, setPickFor] = useState<MealSlot | null>(null)
  const [saveMeal, setSaveMeal] = useState<{ meal: MealSlot; name: string } | null>(null)

  const remove = async (e: FoodEntry) => {
    await deleteEntry(e.id)
    toast(`Removed ${e.name}`, () => restoreEntries([e]))
  }
  const copyYesterday = async (meal: MealSlot) => {
    const y = (await entriesFor(addDays(date, -1))).filter((e) => e.meal === meal)
    if (!y.length) return toast(`No ${MEAL_LABEL[meal].toLowerCase()} logged yesterday`)
    const copies = await copyEntries(y, date, meal)
    toast(`Copied yesterday's ${MEAL_LABEL[meal].toLowerCase()}`, () => db.entries.bulkDelete(copies.map((c) => c.id)))
  }

  const slots = MEALS.filter((m) => m !== 'evening' || entries.some((e) => e.meal === 'evening'))
  return (
    <div className="space-y-3">
      {slots.map((meal) => {
        const list = entries.filter((e) => e.meal === meal)
        if (!showEmpty && !list.length) return null
        const t = dayTotals(list)
        return (
          <div key={meal} className="rounded-2xl bg-surface-2/60 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold">{MEAL_LABEL[meal]}</span>
                {list.length > 0 && (
                  <span className="text-xs text-ink-3 tabular-nums">
                    {fmtNum(t.kcal)} kcal · {fmtNum(t.protein)} g P
                  </span>
                )}
              </div>
              {actions && (
                <div className="flex items-center">
                  {list.length > 0 ? (
                    <button className="rounded-full p-1.5 text-ink-3 hover:bg-surface" onClick={() => setSaveMeal({ meal, name: '' })} aria-label="Save as meal">
                      <Save className="size-4" />
                    </button>
                  ) : (
                    <button className="rounded-full p-1.5 text-ink-3 hover:bg-surface" onClick={() => copyYesterday(meal)} aria-label="Copy yesterday's">
                      <Copy className="size-4" />
                    </button>
                  )}
                  <button className="rounded-full p-1.5 text-ink-3 hover:bg-surface" onClick={() => setPickFor(meal)} aria-label={`Add to ${meal}`}>
                    <Plus className="size-4" />
                  </button>
                </div>
              )}
            </div>
            {list.length > 0 && (
              <ul className="mt-1 divide-y divide-border/60">
                {list.map((e) => {
                  const n = entryTotal(e)
                  return (
                    <li key={e.id} className="flex items-center gap-2">
                      <button className="min-w-0 flex-1 py-1.5 text-left" onClick={() => setEdit(e)}>
                        <div className="truncate text-sm">
                          {e.qty !== 1 && <span className="text-ink-3">{fmtNum(e.qty, 2)}× </span>}
                          {e.name}
                          {e.addons?.length ? <span className="text-ink-3"> + {e.addons.map((a) => a.name.toLowerCase()).join(', ')}</span> : null}
                        </div>
                        <div className="text-xs text-ink-3 tabular-nums">
                          {fmtTime(e.time)} · {fmtNum(n.kcal)} kcal · {fmtNum(n.protein)} P · {fmtNum(n.carbs)} C · {fmtNum(n.fat)} F
                        </div>
                      </button>
                      {actions && (
                        <button className="rounded-full p-1.5 text-ink-3 hover:bg-surface" onClick={() => remove(e)} aria-label={`Remove ${e.name}`}>
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}
      <LogSheet open={!!edit} onClose={() => setEdit(null)} entry={edit ?? undefined} date={date} />
      <FoodPicker open={!!pickFor} onClose={() => setPickFor(null)} date={date} meal={pickFor ?? undefined} title={pickFor ? `Add to ${MEAL_LABEL[pickFor].toLowerCase()}` : undefined} />
      <Sheet
        open={!!saveMeal}
        onClose={() => setSaveMeal(null)}
        title="Save as a meal"
        footer={
          <Button
            className="w-full"
            onClick={async () => {
              if (!saveMeal) return
              const list = entries.filter((e) => e.meal === saveMeal.meal)
              const name = saveMeal.name.trim() || `My ${MEAL_LABEL[saveMeal.meal].toLowerCase()}`
              await saveMealFromEntries(name, list, saveMeal.meal === 'breakfast' ? 'breakfast' : saveMeal.meal === 'snack' || saveMeal.meal === 'evening' ? 'snack' : 'meal')
              toast(`Saved “${name}” — find it under Saved meals`)
              setSaveMeal(null)
            }}
          >
            Save meal
          </Button>
        }
      >
        <Field label="Name" hint="Saved with these exact portions. Log it again in one tap from Saved meals or Favorites.">
          <Input value={saveMeal?.name ?? ''} onChange={(e) => setSaveMeal(saveMeal && { ...saveMeal, name: e.target.value })} placeholder="My usual breakfast" autoFocus />
        </Field>
      </Sheet>
    </div>
  )
}
