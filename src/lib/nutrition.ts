import type {
  Component,
  DayTargets,
  DayType,
  EntryAddon,
  FoodEntry,
  FoodItem,
  FoodServings,
  Micro,
  Nutrients,
  Range,
  Settings,
} from './types'
import { MICROS } from './types'
import { round } from './utils'

export const zeroN = (): Nutrients => ({ kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, micros: {} })

export function addN(a: Nutrients, b: Nutrients, k = 1): Nutrients {
  const micros: Partial<Record<Micro, number>> = { ...(a.micros ?? {}) }
  for (const m of MICROS) {
    const v = b.micros?.[m]
    if (v != null) micros[m] = (micros[m] ?? 0) + v * k
  }
  return {
    kcal: a.kcal + b.kcal * k,
    protein: a.protein + b.protein * k,
    carbs: a.carbs + b.carbs * k,
    fat: a.fat + b.fat * k,
    fiber: a.fiber + b.fiber * k,
    micros,
  }
}

export const scaleN = (a: Nutrients, k: number) => addN(zeroN(), a, k)

export function roundN(a: Nutrients): Nutrients {
  const micros: Partial<Record<Micro, number>> = {}
  for (const m of MICROS) if (a.micros?.[m] != null) micros[m] = round(a.micros[m]!, 1)
  return {
    kcal: Math.round(a.kcal),
    protein: round(a.protein, 1),
    carbs: round(a.carbs, 1),
    fat: round(a.fat, 1),
    fiber: round(a.fiber, 1),
    micros,
  }
}

export function addS(a: FoodServings, b: FoodServings | undefined, k = 1): FoodServings {
  return {
    fruit: (a.fruit ?? 0) + (b?.fruit ?? 0) * k,
    veg: (a.veg ?? 0) + (b?.veg ?? 0) * k,
    calcium: (a.calcium ?? 0) + (b?.calcium ?? 0) * k,
  }
}

export type Library = Map<string, FoodItem>

/** Nutrition + whole-food servings for ONE serving of a food, resolving recipe/meal components. */
export function resolveFood(
  item: FoodItem,
  lib: Library,
  components?: Component[],
  depth = 0,
): { nutrients: Nutrients; servings: FoodServings } {
  if (item.kind === 'food' || item.manual || !item.components || depth > 4) {
    return { nutrients: item.nutrients, servings: item.servings ?? {} }
  }
  let nut = zeroN()
  let serv: FoodServings = {}
  for (const comp of components ?? item.components) {
    const f = lib.get(comp.foodId)
    if (!f || comp.qty === 0) continue
    const r = resolveFood(f, lib, undefined, depth + 1)
    nut = addN(nut, r.nutrients, comp.qty)
    serv = addS(serv, r.servings, comp.qty)
  }
  const y = item.kind === 'recipe' ? item.yield || 1 : 1
  return { nutrients: roundN(scaleN(nut, 1 / y)), servings: addS({}, serv, 1 / y) }
}

/** Recompute cached nutrients/servings for every recipe and meal in the library. */
export function recomputeLibrary(foods: FoodItem[]): FoodItem[] {
  const lib: Library = new Map(foods.map((f) => [f.id, f]))
  // Two passes so meals containing recipes see the recipes' fresh values.
  for (let pass = 0; pass < 2; pass++) {
    for (const f of foods) {
      if (f.kind === 'food' || f.manual) continue
      const r = resolveFood(f, lib)
      const updated = { ...f, nutrients: r.nutrients, servings: r.servings }
      lib.set(f.id, updated)
    }
  }
  return foods.map((f) => lib.get(f.id)!)
}

export function applyModifier(components: Component[], set: Record<string, number>): Component[] {
  const out = components.map((c) => (c.foodId in set ? { ...c, qty: set[c.foodId] } : c))
  for (const [foodId, qty] of Object.entries(set)) {
    if (!out.some((c) => c.foodId === foodId)) out.push({ foodId, qty })
  }
  return out
}

export function addonTotal(addons: EntryAddon[] | undefined): Nutrients {
  let t = zeroN()
  for (const a of addons ?? []) t = addN(t, a.per, a.qty)
  return t
}

export function entryTotal(e: Pick<FoodEntry, 'per' | 'qty' | 'addons'>): Nutrients {
  return addN(scaleN(e.per, e.qty), addonTotal(e.addons))
}

export function entryServings(e: Pick<FoodEntry, 'servings' | 'qty' | 'addons'>): FoodServings {
  let s = addS({}, e.servings, e.qty)
  for (const a of e.addons ?? []) s = addS(s, a.servings, a.qty)
  return s
}

export interface DayTotals extends Nutrients {
  fruit: number
  veg: number
  calciumServ: number
  count: number
}

export function dayTotals(entries: FoodEntry[]): DayTotals {
  let t = zeroN()
  let s: FoodServings = {}
  for (const e of entries) {
    t = addN(t, entryTotal(e))
    s = addS(s, entryServings(e))
  }
  return { ...roundN(t), fruit: s.fruit ?? 0, veg: s.veg ?? 0, calciumServ: s.calcium ?? 0, count: entries.length }
}

// ── Targets ──────────────────────────────────────────────

const r = (min: number, max: number): Range => ({ min, max })

export const DEFAULT_TARGETS: Record<DayType | 'default', DayTargets> = {
  default: { kcal: r(1900, 1950), protein: r(125, 135), fat: r(55, 65), carbs: r(200, 220), fiber: r(25, 30) },
  lowerA: { kcal: r(1950, 2000), protein: r(125, 135), fat: r(55, 60), carbs: r(225, 235), fiber: r(25, 30) },
  upper: { kcal: r(1900, 1950), protein: r(125, 135), fat: r(60, 65), carbs: r(200, 215), fiber: r(25, 30) },
  core: { kcal: r(1875, 1925), protein: r(125, 135), fat: r(60, 65), carbs: r(195, 210), fiber: r(25, 30) },
  lowerB: { kcal: r(1950, 2000), protein: r(125, 135), fat: r(55, 60), carbs: r(225, 235), fiber: r(25, 30) },
  lowerC: { kcal: r(1950, 2000), protein: r(125, 135), fat: r(55, 60), carbs: r(225, 235), fiber: r(25, 30) },
  dance: { kcal: r(1975, 2025), protein: r(125, 135), fat: r(55, 60), carbs: r(230, 245), fiber: r(25, 30) },
  glute: { kcal: r(1975, 2025), protein: r(125, 135), fat: r(55, 60), carbs: r(230, 245), fiber: r(25, 30) },
  rest: { kcal: r(1850, 1950), protein: r(125, 135), fat: r(55, 65), carbs: null, fiber: r(25, 30) },
}

export const DEFAULT_MICROS: Record<Micro, number> = {
  calcium: 1000,
  iron: 18,
  magnesium: 310,
  potassium: 2600,
  vitaminD: 15,
  folate: 400,
  b12: 2.4,
  iodine: 150,
  vitaminC: 75,
}

export const MICRO_INFO: Record<Micro, { label: string; unit: string }> = {
  calcium: { label: 'Calcium', unit: 'mg' },
  iron: { label: 'Iron', unit: 'mg' },
  magnesium: { label: 'Magnesium', unit: 'mg' },
  potassium: { label: 'Potassium', unit: 'mg' },
  vitaminD: { label: 'Vitamin D', unit: 'mcg' },
  folate: { label: 'Folate', unit: 'mcg DFE' },
  b12: { label: 'Vitamin B12', unit: 'mcg' },
  iodine: { label: 'Iodine', unit: 'mcg' },
  vitaminC: { label: 'Vitamin C', unit: 'mg' },
}

/** Carb range; when unset ("fill remaining calories"), derived from calories minus protein and fat. */
export function carbRange(t: DayTargets): Range {
  if (t.carbs) return t.carbs
  const p = (t.protein.min + t.protein.max) / 2
  const f = (t.fat.min + t.fat.max) / 2
  const lo = Math.max(0, Math.round((t.kcal.min - p * 4 - f * 9) / 4 / 5) * 5)
  const hi = Math.max(lo, Math.round((t.kcal.max - p * 4 - f * 9) / 4 / 5) * 5)
  return { min: lo, max: hi }
}

export function targetsFor(settings: Settings, dayType: DayType): DayTargets {
  return structuredClone(settings.steadyIntake ? settings.targets.default : settings.targets[dayType])
}

export const mid = (r: Range) => (r.min + r.max) / 2

export type Band = 'below' | 'within' | 'above'

export function band(v: number, r: Range): Band {
  if (v < r.min) return 'below'
  if (v > r.max) return 'above'
  return 'within'
}

export const DAY_TYPE_LABEL: Record<DayType, string> = {
  lowerA: 'Lower A',
  upper: 'Upper',
  core: 'Core + recovery',
  lowerB: 'Lower B',
  lowerC: 'Lower C',
  dance: 'Dance night',
  glute: 'Glute + dance (old plan)',
  rest: 'Rest',
}
