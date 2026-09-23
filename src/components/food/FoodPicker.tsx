import { useLiveQuery } from 'dexie-react-hooks'
import { MoreHorizontal, Plus, Search, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/controls'
import { Input } from '@/components/ui/input'
import { Sheet } from '@/components/ui/sheet'
import { toast } from '@/components/ui/toast'
import { addDays, toMin, nowHM } from '@/lib/dates'
import { db } from '@/lib/db'
import { deleteEntry, logFood, toggleFavorite } from '@/lib/repo'
import { frequentFoods, recentFoods } from '@/lib/trends'
import type { FoodItem, ISODate, MealSlot } from '@/lib/types'
import { cn, fmtNum } from '@/lib/utils'
import { LogSheet } from './LogSheet'
import { FoodEditor, QuickMacrosSheet } from './FoodEditor'

type Tab = 'frequent' | 'recent' | 'favorites' | 'meals' | 'recipes' | 'all'

const TABS: { value: Tab; label: string }[] = [
  { value: 'frequent', label: 'Frequent' },
  { value: 'recent', label: 'Recent' },
  { value: 'favorites', label: 'Favorites' },
  { value: 'meals', label: 'Saved meals' },
  { value: 'recipes', label: 'Recipes' },
  { value: 'all', label: 'All foods' },
]

export function FoodPicker({ open, onClose, date, title = 'Add food', filter, initialTab = 'frequent', meal }: { open: boolean; onClose: () => void; date: ISODate; title?: string; filter?: (f: FoodItem) => boolean; initialTab?: Tab; meal?: MealSlot }) {
  const foods = useLiveQuery(() => db.foods.toArray(), [])
  const history = useLiveQuery(() => db.entries.where('date').aboveOrEqual(addDays(date, -60)).toArray(), [date])
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<Tab>(initialTab)
  const [custom, setCustom] = useState<FoodItem | null>(null)
  const [editor, setEditor] = useState<{ open: boolean; kind?: FoodItem['kind'] }>({ open: false })
  const [quickMacros, setQuickMacros] = useState(false)

  const list = useMemo(() => {
    if (!foods || !history) return []
    const live = foods.filter((f) => !f.archived)
    const map = new Map(live.map((f) => [f.id, f]))
    let base: FoodItem[]
    if (filter) base = live.filter(filter)
    else if (q.trim()) {
      const words = q.toLowerCase().split(/\s+/).filter(Boolean)
      base = live.filter((f) => words.every((w) => `${f.name} ${f.brand ?? ''} ${f.tags?.join(' ') ?? ''}`.toLowerCase().includes(w)))
      const freq = new Map(frequentFoods(history, date, toMin(nowHM())).map((x) => [x.foodId, x.score]))
      base.sort((a, b) => (freq.get(b.id) ?? 0) - (freq.get(a.id) ?? 0) || (a.category === 'ingredient' ? 1 : 0) - (b.category === 'ingredient' ? 1 : 0))
    } else if (tab === 'frequent') {
      base = frequentFoods(history, date, toMin(nowHM())).map((x) => map.get(x.foodId)).filter((f): f is FoodItem => !!f)
    } else if (tab === 'recent') base = recentFoods(history, 30).map((x) => map.get(x.foodId)).filter((f): f is FoodItem => !!f)
    else if (tab === 'favorites') base = live.filter((f) => f.favorite)
    else if (tab === 'meals') base = live.filter((f) => f.kind === 'meal')
    else if (tab === 'recipes') base = live.filter((f) => f.kind === 'recipe')
    else base = [...live].sort((a, b) => a.name.localeCompare(b.name))
    return base.slice(0, 200)
  }, [foods, history, q, tab, filter, date])

  const quick = async (f: FoodItem) => {
    const e = await logFood(date, f, { source: 'search', meal })
    toast(`Logged ${f.name}`, () => deleteEntry(e.id).then(() => undefined))
    if (filter) onClose()
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} title={title}>
        {!filter && (
          <div className="sticky top-0 z-10 -mx-5 space-y-3 bg-surface px-5 pb-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-ink-3" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your foods" className="pl-10" autoFocus={false} />
            </div>
            {!q && (
              <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1">
                {TABS.map((t) => (
                  <Chip key={t.value} active={tab === t.value} onClick={() => setTab(t.value)}>
                    {t.label}
                  </Chip>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="divide-y divide-border">
          {list.length === 0 && (
            <p className="py-6 text-center text-sm text-ink-3">
              {tab === 'frequent' || tab === 'recent' ? 'Nothing logged yet — foods you log will show up here.' : 'No matches.'}
            </p>
          )}
          {list.map((f) => (
            <div key={f.id} className="flex items-center gap-1 py-1">
              <button className="min-w-0 flex-1 rounded-xl py-2 text-left" onClick={() => quick(f)}>
                <div className="truncate text-[15px]">
                  {f.name}
                  {f.brand && <span className="text-ink-3"> · {f.brand}</span>}
                </div>
                <div className="text-xs text-ink-3 tabular-nums">
                  {f.serving} · {fmtNum(f.nutrients.kcal)} kcal · {fmtNum(f.nutrients.protein)} g P
                  {f.kind !== 'food' && <span> · {f.kind}</span>}
                </div>
              </button>
              <button onClick={() => toggleFavorite(f.id)} className="rounded-full p-2" aria-label="Favorite">
                <Star className={cn('size-4', f.favorite ? 'fill-accent text-accent' : 'text-ink-3')} />
              </button>
              <button onClick={() => setCustom(f)} className="rounded-full p-2 text-ink-3" aria-label="Portions">
                <MoreHorizontal className="size-4" />
              </button>
            </div>
          ))}
        </div>
        {!filter && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={() => setQuickMacros(true)}>
              <Plus className="size-4" /> Quick add macros
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditor({ open: true, kind: 'food' })}>
              <Plus className="size-4" /> Custom food
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditor({ open: true, kind: 'recipe' })}>
              <Plus className="size-4" /> New recipe
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditor({ open: true, kind: 'meal' })}>
              <Plus className="size-4" /> New saved meal
            </Button>
          </div>
        )}
        <p className="mt-3 text-xs text-ink-3">Tap a food to log your usual portion. ⋯ changes portions, sauces and meal.</p>
      </Sheet>
      <LogSheet open={!!custom} onClose={() => setCustom(null)} food={custom ?? undefined} date={date} meal={meal} onLogged={filter ? onClose : undefined} />
      <FoodEditor open={editor.open} kind={editor.kind} onClose={() => setEditor({ open: false })} />
      <QuickMacrosSheet open={quickMacros} onClose={() => setQuickMacros(false)} date={date} />
    </>
  )
}
