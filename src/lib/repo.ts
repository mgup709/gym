// Data operations. Everything that writes goes through here so history rules stay in one place:
// - a day's targets are snapshotted into its DayLog and never rewritten when settings change later
// - food entries snapshot their nutrition, so editing a food never silently rewrites past days
import { db } from './db'
import { addDays, nowHM, toMin, todayISO, weekday } from './dates'
import { applyModifier, recomputeLibrary, resolveFood, targetsFor } from './nutrition'
import type {
  Component,
  DayLog,
  DayType,
  EntryAddon,
  FoodEntry,
  FoodItem,
  ISODate,
  MealSlot,
  Settings,
  WorkoutTemplate,
} from './types'
import { uid } from './utils'

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get('profile')
  if (!s) throw new Error('Settings missing')
  return s
}

export function scheduledTemplateId(settings: Settings, date: ISODate): string {
  return settings.schedule[weekday(date)] ?? 'rest'
}

export function dayTypeFromSchedule(settings: Settings, templates: WorkoutTemplate[], date: ISODate): DayType {
  const id = scheduledTemplateId(settings, date)
  if (id === 'rest') return 'rest'
  return templates.find((t) => t.id === id)?.dayType ?? 'rest'
}

/** Returns the DayLog for a date, creating it (with a targets snapshot) if needed. */
export async function ensureDay(date: ISODate): Promise<DayLog> {
  const existing = await db.days.get(date)
  if (existing) return existing
  const settings = await getSettings()
  const templates = await db.templates.toArray()
  const dayType = dayTypeFromSchedule(settings, templates, date)
  const day: DayLog = { date, dayType, targets: targetsFor(settings, dayType) }
  await db.days.put(day)
  return day
}

/** Change a day's type (e.g. swapped training days). Re-snapshots that day's targets from current settings. */
export async function setDayType(date: ISODate, dayType: DayType) {
  const settings = await getSettings()
  const day = await ensureDay(date)
  await db.days.put({ ...day, dayType, targets: targetsFor(settings, dayType) })
}

/**
 * Save settings. When targets change, only today's snapshot (and any already-created future days)
 * are refreshed — past days keep the targets they were planned with.
 */
export async function saveSettings(next: Settings) {
  await db.settings.put(next)
  const today = todayISO()
  const days = await db.days.where('date').aboveOrEqual(today).toArray()
  await db.days.bulkPut(days.map((d) => ({ ...d, targets: targetsFor(next, d.dayType) })))
}

// ── Food library ─────────────────────────────────────────

export async function library(): Promise<Map<string, FoodItem>> {
  const foods = await db.foods.toArray()
  return new Map(foods.map((f) => [f.id, f]))
}

/** Save a food and refresh cached nutrition of every recipe/meal (so dependents update). */
export async function saveFood(item: FoodItem) {
  const foods = await db.foods.toArray()
  const next = foods.filter((f) => f.id !== item.id)
  next.push({ ...item, updatedAt: Date.now() })
  const recomputed = recomputeLibrary(next)
  await db.foods.bulkPut(recomputed)
  return recomputed.find((f) => f.id === item.id)!
}

export async function toggleFavorite(id: string) {
  const f = await db.foods.get(id)
  if (f) await db.foods.update(id, { favorite: !f.favorite })
}

// ── Logging ──────────────────────────────────────────────

/** Picks a meal slot from the time of day, the food's category, and what's already logged. */
export function autoSlot(time: string, food: Pick<FoodItem, 'category'> | null, todays: FoodEntry[]): MealSlot {
  const t = toMin(time)
  const cat = food?.category
  const hasBreakfast = todays.some((e) => e.meal === 'breakfast')
  const snacky = cat === 'snack' || cat === 'fruit' || cat === 'condiment' || cat === 'side'
  if (cat === 'condiment' || cat === 'side') {
    const recent = [...todays].sort((a, b) => toMin(b.time) - toMin(a.time))[0]
    if (recent && Math.abs(toMin(recent.time) - t) <= 45) return recent.meal
  }
  if (cat === 'breakfast' && t < 14 * 60) return 'breakfast'
  if (t < 10 * 60 + 30) return hasBreakfast && snacky ? 'snack' : 'breakfast'
  if (t < 14 * 60 + 30) return snacky ? 'snack' : 'lunch'
  if (t < 17 * 60 + 15) return cat === 'meal' || cat === 'pasta' ? (t < 16 * 60 ? 'lunch' : 'dinner') : 'snack'
  if (t < 21 * 60) return snacky && todays.some((e) => e.meal === 'dinner') ? 'evening' : snacky ? 'snack' : 'dinner'
  return 'evening'
}

export interface LogOptions {
  qty?: number
  components?: Component[]
  modifiers?: string[]
  addons?: { foodId: string; qty: number }[]
  meal?: MealSlot
  time?: string
  source?: FoodEntry['source']
  note?: string
}

export async function buildEntry(date: ISODate, food: FoodItem, o: LogOptions = {}): Promise<FoodEntry> {
  const lib = await library()
  let components = o.components
  if (!components && o.modifiers?.length && food.components) {
    components = food.components
    for (const mid of o.modifiers) {
      const m = food.modifiers?.find((x) => x.id === mid)
      if (m) components = applyModifier(components, m.set)
    }
  }
  const { nutrients, servings } = resolveFood(food, lib, components)
  const addons: EntryAddon[] = []
  for (const a of o.addons ?? []) {
    const f = lib.get(a.foodId)
    if (!f || a.qty <= 0) continue
    const r = resolveFood(f, lib)
    addons.push({ foodId: f.id, name: f.name, qty: a.qty, per: r.nutrients, servings: r.servings })
  }
  const time = o.time ?? (date === todayISO() ? nowHM() : '12:00')
  const todays = await db.entries.where('date').equals(date).toArray()
  return {
    id: uid(),
    date,
    time,
    meal: o.meal ?? autoSlot(time, food, todays),
    foodId: food.id,
    name: food.name,
    qty: o.qty ?? food.defaultQty ?? 1,
    serving: food.serving,
    per: nutrients,
    servings,
    components: components && food.kind === 'meal' ? components.filter((c) => c.qty > 0) : undefined,
    addons: addons.length ? addons : undefined,
    note: o.note,
    source: o.source ?? 'manual',
    createdAt: Date.now(),
  }
}

export async function logFood(date: ISODate, food: FoodItem, o: LogOptions = {}): Promise<FoodEntry> {
  await ensureDay(date)
  const entry = await buildEntry(date, food, o)
  await db.entries.put(entry)
  return entry
}

/** Quick-add of calories/macros without a library food (e.g. an unplanned restaurant meal). */
export async function logQuickMacros(
  date: ISODate,
  name: string,
  per: FoodEntry['per'],
  meal: MealSlot,
  time = date === todayISO() ? nowHM() : '12:00',
) {
  await ensureDay(date)
  const e: FoodEntry = {
    id: uid(),
    date,
    time,
    meal,
    name: name || 'Quick add',
    qty: 1,
    serving: '1 entry',
    per,
    source: 'manual',
    createdAt: Date.now(),
  }
  await db.entries.put(e)
  return e
}

export async function deleteEntry(id: string): Promise<FoodEntry | undefined> {
  const e = await db.entries.get(id)
  if (e) await db.entries.delete(id)
  return e
}

export async function restoreEntries(entries: FoodEntry[]) {
  await db.entries.bulkPut(entries)
}

/** Copies entries to another date (duplicate yesterday / duplicate meal). */
export async function copyEntries(entries: FoodEntry[], toDate: ISODate, meal?: MealSlot): Promise<FoodEntry[]> {
  await ensureDay(toDate)
  const copies = entries.map((e) => ({
    ...structuredClone(e),
    id: uid(),
    date: toDate,
    meal: meal ?? e.meal,
    source: 'copy' as const,
    createdAt: Date.now(),
  }))
  await db.entries.bulkPut(copies)
  return copies
}

/** Saves a combination of logged entries as a reusable meal ("My usual breakfast"). */
export async function saveMealFromEntries(name: string, entries: FoodEntry[], category: FoodItem['category'] = 'meal') {
  const now = Date.now()
  const components: Component[] = []
  for (const e of entries) {
    let foodId = e.foodId
    const food = foodId ? await db.foods.get(foodId) : undefined
    if (!food || e.components) {
      // Snapshot foods without a library item (quick adds, adjusted meals) as a custom food.
      foodId = uid()
      await db.foods.put({
        id: foodId,
        name: e.name,
        kind: 'food',
        category: 'ingredient',
        serving: e.serving,
        nutrients: e.per,
        servings: e.servings,
        createdAt: now,
        updatedAt: now,
      })
    }
    components.push({ foodId: foodId!, qty: e.qty })
    for (const a of e.addons ?? []) components.push({ foodId: a.foodId, qty: a.qty })
  }
  return saveFood({
    id: uid(),
    name,
    kind: 'meal',
    category,
    serving: '1 serving',
    nutrients: { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    components,
    favorite: true,
    createdAt: now,
    updatedAt: now,
  })
}

export async function entriesFor(date: ISODate) {
  return db.entries.where('date').equals(date).sortBy('time')
}

export async function yesterdayEntries(date: ISODate) {
  return entriesFor(addDays(date, -1))
}
