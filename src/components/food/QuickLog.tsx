import { useLiveQuery } from 'dexie-react-hooks'
import { Check, ChevronRight, MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import { Stepper } from '@/components/ui/controls'
import { toast } from '@/components/ui/toast'
import { db } from '@/lib/db'
import { deleteEntry, logFood, restoreEntries } from '@/lib/repo'
import type { FoodEntry, FoodItem, ISODate, QuickGroup } from '@/lib/types'
import { cn, fmtNum } from '@/lib/utils'
import { LogSheet } from './LogSheet'
import { FoodPicker } from './FoodPicker'

const GROUPS: { key: QuickGroup; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'snacks', label: 'Snacks' },
  { key: 'meals', label: 'Meals' },
  { key: 'sides', label: 'Sides' },
]

interface PickerDef {
  id: string
  label: string
  group: QuickGroup
  match: (f: FoodItem) => boolean
}

// Quick-log rows that open a short list instead of logging directly.
const PICKERS: PickerDef[] = [
  { id: 'pasta', label: 'Pasta meal', group: 'meals', match: (f) => f.category === 'pasta' && !f.archived },
  { id: 'ricebowl', label: 'Tuna / salmon rice bowl', group: 'meals', match: (f) => !!f.tags?.includes('ricebowl') && !f.archived },
]

function Check_({ on }: { on: boolean }) {
  return (
    <span className={cn('grid size-6 shrink-0 place-items-center rounded-lg border-2 transition-colors', on ? 'border-accent bg-accent text-accent-ink' : 'border-border bg-surface')}>
      {on && <Check className="size-4" strokeWidth={3} />}
    </span>
  )
}

/**
 * One-tap logging for regular foods. Checking creates a real entry; unchecking removes the most recent
 * one (with Undo). Once checked, the stepper changes the quantity instead of creating duplicates.
 */
export function QuickLog({ date, entries, groups = GROUPS.map((g) => g.key) }: { date: ISODate; entries: FoodEntry[]; groups?: QuickGroup[] }) {
  const foods = useLiveQuery(() => db.foods.where('quickLog').anyOf(['breakfast', 'snacks', 'meals', 'sides', 'fruit', 'extras']).toArray(), [])
  const allFoods = useLiveQuery(() => db.foods.toArray(), [])
  const [custom, setCustom] = useState<FoodItem | null>(null)
  const [picker, setPicker] = useState<PickerDef | null>(null)
  if (!foods || !allFoods) return null

  const byFood = (id: string) => entries.filter((e) => e.foodId === id).sort((a, b) => a.createdAt - b.createdAt)

  const check = async (f: FoodItem) => {
    const e = await logFood(date, f, { source: 'quick' })
    toast(`Logged ${f.name}`, () => deleteEntry(e.id).then(() => undefined))
  }
  const uncheck = async (list: FoodEntry[]) => {
    const last = list[list.length - 1]
    if (!last) return
    await deleteEntry(last.id)
    toast(`Removed ${last.name}`, () => restoreEntries([last]))
  }
  const setQty = async (list: FoodEntry[], total: number) => {
    const last = list[list.length - 1]
    const others = list.slice(0, -1).reduce((a, e) => a + e.qty, 0)
    const q = total - others
    if (q <= 0) return uncheck(list)
    await db.entries.update(last.id, { qty: q })
  }

  const sorted = (g: QuickGroup) =>
    foods.filter((f) => f.quickLog === g && !f.archived).sort((a, b) => (a.quickOrder ?? 50) - (b.quickOrder ?? 50) || a.name.localeCompare(b.name))

  const row = (f: FoodItem) => {
    const list = byFood(f.id)
    const on = list.length > 0
    const total = list.reduce((a, e) => a + e.qty, 0)
    const q = f.defaultQty ?? 1
    return (
      <div key={f.id} className="flex items-center gap-2 py-1">
        <button className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1.5 text-left" onClick={() => (on ? uncheck(list) : check(f))} aria-pressed={on}>
          <Check_ on={on} />
          <span className="min-w-0">
            <span className="line-clamp-2 block text-[15px] leading-snug">{f.name}</span>
            <span className="block text-xs text-ink-3 tabular-nums">
              {fmtNum(f.nutrients.protein * q)} g protein · {fmtNum(f.nutrients.kcal * q)} kcal
            </span>
          </span>
        </button>
        {on && <Stepper value={total} onChange={(v) => setQty(list, v)} step={1} min={0} />}
        <button className="rounded-full p-2 text-ink-3 hover:bg-surface-2" onClick={() => setCustom(f)} aria-label={`Customize ${f.name}`}>
          <MoreHorizontal className="size-4" />
        </button>
      </div>
    )
  }

  const pickerRow = (p: PickerDef) => {
    const ids = new Set(allFoods.filter(p.match).map((f) => f.id))
    const list = entries.filter((e) => e.foodId && ids.has(e.foodId)).sort((a, b) => a.createdAt - b.createdAt)
    const on = list.length > 0
    return (
      <div key={p.id} className="flex items-center gap-2 py-1">
        <button className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1.5 text-left" onClick={() => (on ? uncheck(list) : setPicker(p))} aria-pressed={on}>
          <Check_ on={on} />
          <span className="min-w-0">
            <span className="block truncate text-[15px] leading-snug">{p.label}</span>
            <span className="block truncate text-xs text-ink-3">{on ? list.map((e) => e.name).join(', ') : 'Choose which one'}</span>
          </span>
        </button>
        <button className="rounded-full p-2 text-ink-3 hover:bg-surface-2" onClick={() => setPicker(p)} aria-label={`Choose ${p.label}`}>
          <ChevronRight className="size-4" />
        </button>
      </div>
    )
  }

  const chipGroup = (g: QuickGroup, label: string) => {
    const items = sorted(g)
    if (!items.length) return null
    return (
      <div>
        <div className="mb-1.5 text-xs font-semibold tracking-wide text-ink-3 uppercase">{label}</div>
        <div className="flex flex-wrap gap-1.5">
          {items.map((f) => {
            const list = byFood(f.id)
            const total = list.reduce((a, e) => a + e.qty, 0)
            const on = list.length > 0
            return (
              <button
                key={f.id}
                onClick={() => (on ? uncheck(list) : check(f))}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setCustom(f)
                }}
                aria-pressed={on}
                className={cn(
                  'inline-flex h-8 items-center gap-1 rounded-full border px-3 text-sm transition-colors',
                  on ? 'border-accent bg-accent-soft text-accent' : 'border-border bg-surface text-ink-2 hover:bg-surface-2',
                )}
              >
                {on && <Check className="size-3.5" strokeWidth={3} />}
                {f.name.replace('Cotton candy grapes', 'Grapes')}
                {total > 1 && <span className="text-xs">×{total}</span>}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {GROUPS.filter((g) => groups.includes(g.key)).map((g) => {
        const items = sorted(g.key)
        const pickers = PICKERS.filter((p) => p.group === g.key)
        if (!items.length && !pickers.length) return null
        return (
          <div key={g.key}>
            <div className="mb-0.5 text-xs font-semibold tracking-wide text-ink-3 uppercase">{g.label}</div>
            <div className="divide-y divide-border/70">
              {items.map(row)}
              {pickers.map(pickerRow)}
            </div>
          </div>
        )
      })}
      {groups.includes('fruit') && chipGroup('fruit', 'Fruit')}
      {groups.includes('extras') && chipGroup('extras', 'Sauces, oils & extras')}
      <p className="text-xs text-ink-3">Tap to log · tap again to remove · ⋯ to change portions or add sauces</p>

      <LogSheet open={!!custom} onClose={() => setCustom(null)} food={custom ?? undefined} date={date} />
      <FoodPicker
        open={!!picker}
        onClose={() => setPicker(null)}
        date={date}
        title={picker?.label}
        filter={picker?.match}
      />
    </div>
  )
}
