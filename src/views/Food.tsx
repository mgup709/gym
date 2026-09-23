import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Copy, Plus, Search, Sparkles, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DayMeals } from '@/components/food/DayMeals'
import { FoodEditor } from '@/components/food/FoodEditor'
import { FoodPicker } from '@/components/food/FoodPicker'
import { NutritionSummary } from '@/components/food/NutritionSummary'
import { QuickLog } from '@/components/food/QuickLog'
import { SuggestSheet } from '@/components/food/SuggestSheet'
import { useDay } from '@/components/food/useDay'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, Empty, Pill, Section } from '@/components/ui/card'
import { Chip, Switch } from '@/components/ui/controls'
import { toast } from '@/components/ui/toast'
import { addDays, fmtDate, nowHM, toMin } from '@/lib/dates'
import { db } from '@/lib/db'
import { navigate, useRoute, useSettings, useToday } from '@/lib/hooks'
import { DAY_TYPE_LABEL, MICRO_INFO } from '@/lib/nutrition'
import { copyEntries, ensureDay, entriesFor } from '@/lib/repo'
import { frequentFoods, recentFoods } from '@/lib/trends'
import type { FoodItem } from '@/lib/types'
import { MICROS } from '@/lib/types'
import { cn, fmtNum, mean } from '@/lib/utils'
import { danceTimeFor, trainingTimeFor } from './Today'

type LibTab = 'frequent' | 'favorites' | 'meals' | 'recipes' | 'recent' | 'all'

export function FoodView() {
  const settings = useSettings()
  const today = useToday()
  const route = useRoute()
  const date = route.query.get('date') ?? today
  const setDate = (d: string) => navigate(d === today ? 'food' : `food?date=${d}`, true)
  const data = useDay(date, settings)
  const [addOpen, setAddOpen] = useState(false)
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [editor, setEditor] = useState<{ open: boolean; food?: FoodItem; kind?: FoodItem['kind'] }>({ open: false })
  const [tab, setTab] = useState<LibTab>('frequent')
  const [searchOpen, setSearchOpen] = useState(false)
  const foods = useLiveQuery(() => db.foods.toArray(), [])
  const history = useLiveQuery(() => db.entries.where('date').aboveOrEqual(addDays(today, -60)).toArray(), [today])
  const week = useLiveQuery(async () => {
    const es = await db.entries.where('date').between(addDays(date, -6), date, true, true).toArray()
    return es
  }, [date])

  const libList = useMemo(() => {
    if (!foods || !history) return []
    const live = foods.filter((f) => !f.archived)
    const map = new Map(live.map((f) => [f.id, f]))
    switch (tab) {
      case 'frequent':
        return frequentFoods(history, today, toMin(nowHM())).slice(0, 15).map((x) => map.get(x.foodId)).filter((f): f is FoodItem => !!f)
      case 'recent':
        return recentFoods(history, 20).map((x) => map.get(x.foodId)).filter((f): f is FoodItem => !!f)
      case 'favorites':
        return live.filter((f) => f.favorite)
      case 'meals':
        return live.filter((f) => f.kind === 'meal')
      case 'recipes':
        return live.filter((f) => f.kind === 'recipe')
      default:
        return [...foods].sort((a, b) => a.name.localeCompare(b.name))
    }
  }, [foods, history, tab, today])

  if (!settings || !data) return null
  const isToday = date === today
  const t = data.totals

  const dupYesterday = async () => {
    const y = await entriesFor(addDays(date, -1))
    if (!y.length) return toast('Nothing logged the day before')
    const copies = await copyEntries(y, date)
    toast(`Copied ${copies.length} entries from the day before`, () => db.entries.bulkDelete(copies.map((c) => c.id)))
  }

  // Weekly micronutrient averages over logged days
  const weekByDate = new Map<string, number>()
  for (const e of week ?? []) weekByDate.set(e.date, 1)
  const weekDays = weekByDate.size

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between pt-2">
        <div>
          <p className="text-sm text-ink-3">{isToday ? 'Today' : fmtDate(date, { weekday: 'long' })}</p>
          <h1 className="font-display text-4xl leading-tight">Food</h1>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon-sm" variant="ghost" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
            <ChevronLeft className="size-5" />
          </Button>
          <label className="relative">
            <span className="rounded-full bg-surface-2 px-3 py-1.5 text-sm font-medium">{fmtDate(date)}</span>
            <input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} className="absolute inset-0 opacity-0" aria-label="Pick date" />
          </label>
          <Button size="icon-sm" variant="ghost" onClick={() => setDate(addDays(date, 1))} disabled={isToday} aria-label="Next day">
            <ChevronRight className="size-5" />
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader
          title={`${DAY_TYPE_LABEL[data.day.dayType]} · daily totals`}
          subtitle={!isToday ? 'Targets shown are the ones saved for this date' : undefined}
          action={!isToday ? <Button size="xs" variant="secondary" onClick={() => setDate(today)}>Today</Button> : undefined}
        />
        <NutritionSummary data={data} />
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
          <Pill tone={t.fruit >= settings.wholeFood.fruit ? 'sage' : 'neutral'}>Fruit {fmtNum(t.fruit, 1)}/{settings.wholeFood.fruit}</Pill>
          <Pill tone={t.veg >= settings.wholeFood.veg ? 'sage' : 'neutral'}>Veg {fmtNum(t.veg, 1)}/{settings.wholeFood.veg}</Pill>
          <Pill tone={t.calciumServ >= settings.wholeFood.calcium ? 'sage' : 'neutral'}>Calcium-rich {fmtNum(t.calciumServ, 1)}/{settings.wholeFood.calcium}</Pill>
        </div>
        {isToday && (
          <Button variant="soft" className="mt-4 w-full" onClick={() => setSuggestOpen(true)}>
            <Sparkles className="size-4" /> What should I eat next?
          </Button>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Meals"
          action={
            <div className="flex gap-1.5">
              <Button size="xs" variant="ghost" onClick={dupYesterday}>
                <Copy className="size-3.5" /> Day before
              </Button>
              <Button size="xs" variant="secondary" onClick={() => setAddOpen(true)}>
                <Plus className="size-3.5" /> Add
              </Button>
            </div>
          }
        />
        <DayMeals date={date} entries={data.entries} />
      </Card>

      <Section title="Quick log" subtitle="One tap for your regular foods" defaultOpen>
        <QuickLog date={date} entries={data.entries} groups={['breakfast', 'snacks', 'meals', 'sides', 'fruit', 'extras']} />
      </Section>

      <Section title="Micronutrients" subtitle={`Today, and the ${weekDays}-day average — weekly patterns matter more than any single day`}>
        <MicroTable date={date} todayMicros={t.micros ?? {}} weekEntries={week ?? []} weekDays={weekDays} targets={settings.microTargets} />
        <p className="text-xs text-ink-3">Only foods with stored micronutrient data count, so totals can read low. Add values to custom foods to improve coverage.</p>
      </Section>

      <Section title="Your foods" subtitle="Favorites, saved meals, recipes and custom foods">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => setSearchOpen(true)}>
            <Search className="size-4" /> Search &amp; log
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditor({ open: true, kind: 'food' })}>
            <Plus className="size-4" /> Food
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditor({ open: true, kind: 'recipe' })}>
            <Plus className="size-4" /> Recipe
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditor({ open: true, kind: 'meal' })}>
            <Plus className="size-4" /> Meal
          </Button>
        </div>
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
          {(['frequent', 'favorites', 'meals', 'recipes', 'recent', 'all'] as LibTab[]).map((x) => (
            <Chip key={x} active={tab === x} onClick={() => setTab(x)}>
              {{ frequent: 'Frequently eaten', favorites: 'Favorites', meals: 'Saved meals', recipes: 'Recipes', recent: 'Recent', all: 'All foods' }[x]}
            </Chip>
          ))}
        </div>
        {libList.length === 0 ? (
          <Empty>{tab === 'frequent' || tab === 'recent' ? 'This fills in from what you actually log.' : 'Nothing here yet.'}</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {libList.map((f) => (
              <li key={f.id}>
                <button className={cn('flex w-full items-center gap-2 py-2 text-left', f.archived && 'opacity-50')} onClick={() => setEditor({ open: true, food: f })}>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">
                      {f.favorite && <Star className="mr-1 inline size-3.5 fill-accent text-accent" />}
                      {f.name}
                    </div>
                    <div className="text-xs text-ink-3 tabular-nums">
                      {f.serving} · {fmtNum(f.nutrients.kcal)} kcal · {fmtNum(f.nutrients.protein)} P · {fmtNum(f.nutrients.carbs)} C · {fmtNum(f.nutrients.fat)} F
                      {f.kind !== 'food' && ` · ${f.kind}`}
                      {f.archived && ' · hidden'}
                    </div>
                  </div>
                  <ChevronRight className="size-4 text-ink-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-ink-3">Editing a food updates recipes and meals that use it. Days you already logged keep their original values.</p>
      </Section>

      <Section title="This day">
        <Switch
          checked={!!data.day.excluded}
          onChange={async (v) => {
            const d = await ensureDay(date)
            await db.days.put({ ...d, excluded: v })
          }}
          label="Incomplete log — leave out of averages"
          hint="Use this for days you didn't fully log so trends stay accurate."
        />
      </Section>

      <FoodPicker open={addOpen} onClose={() => setAddOpen(false)} date={date} />
      <FoodPicker open={searchOpen} onClose={() => setSearchOpen(false)} date={date} initialTab="all" />
      <FoodEditor open={editor.open} food={editor.food} kind={editor.kind} onClose={() => setEditor({ open: false })} />
      {isToday && (
        <SuggestSheet
          open={suggestOpen}
          onClose={() => setSuggestOpen(false)}
          date={date}
          day={data.day}
          entries={data.entries}
          settings={settings}
          training={trainingTimeFor(settings, date, data.day.workoutTime, data.day.dayType)}
          dance={danceTimeFor(settings, date)}
        />
      )}
    </div>
  )
}

function MicroTable({ todayMicros, weekEntries, weekDays, targets }: { date: string; todayMicros: Partial<Record<string, number>>; weekEntries: import('@/lib/types').FoodEntry[]; weekDays: number; targets: Record<string, number> }) {
  const byDay = new Map<string, Record<string, number>>()
  for (const e of weekEntries) {
    const d = byDay.get(e.date) ?? {}
    for (const m of MICROS) {
      const v = (e.per.micros?.[m] ?? 0) * e.qty + (e.addons ?? []).reduce((a, x) => a + (x.per.micros?.[m] ?? 0) * x.qty, 0)
      d[m] = (d[m] ?? 0) + v
    }
    byDay.set(e.date, d)
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-xs text-ink-3">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Nutrient</th>
            <th className="px-2 py-2 text-right font-medium">Today</th>
            <th className="px-2 py-2 text-right font-medium">{weekDays}-day avg</th>
            <th className="px-3 py-2 text-right font-medium">Target</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {MICROS.map((m) => {
            const avg = mean([...byDay.values()].map((d) => d[m] ?? 0))
            const low = avg != null && avg < targets[m] * 0.7
            return (
              <tr key={m}>
                <td className="px-3 py-1.5">{MICRO_INFO[m].label}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{fmtNum(todayMicros[m] ?? 0, m === 'b12' || m === 'vitaminD' || m === 'iron' ? 1 : 0)}</td>
                <td className={cn('px-2 py-1.5 text-right tabular-nums', low && 'text-amber')}>{fmtNum(avg, m === 'b12' || m === 'vitaminD' || m === 'iron' ? 1 : 0)}</td>
                <td className="px-3 py-1.5 text-right text-ink-3 tabular-nums">
                  {fmtNum(targets[m], 1)} {MICRO_INFO[m].unit}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
