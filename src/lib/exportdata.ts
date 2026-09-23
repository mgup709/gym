// CSV / JSON export and JSON restore. Photos are exported in the JSON backup as data URLs.
import { db } from './db'
import { dailyRows } from './trends'
import { entryTotal } from './nutrition'
import { todayISO } from './dates'
import type { Photo } from './types'
import { MICROS } from './types'
import { zip } from './zip'

function csvCell(v: unknown): string {
  if (v == null) return ''
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCSV(rows: Record<string, unknown>[], columns?: string[]): string {
  const cols = columns ?? [...new Set(rows.flatMap((r) => Object.keys(r)))]
  return [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n')
}

export async function buildCSVs(): Promise<Record<string, string>> {
  const [days, entries, foods, sessions, exercises, measurements, recovery, cycle, reviews] = await Promise.all([
    db.days.toArray(),
    db.entries.toArray(),
    db.foods.toArray(),
    db.sessions.toArray(),
    db.exercises.toArray(),
    db.measurements.toArray(),
    db.recovery.toArray(),
    db.cycle.toArray(),
    db.reviews.toArray(),
  ])
  const names = new Map(exercises.map((e) => [e.id, e.name]))
  const allDates = [...days.map((d) => d.date), ...entries.map((e) => e.date)].sort()
  const nutrition = allDates.length
    ? dailyRows(allDates[0], allDates[allDates.length - 1], days, entries)
        .filter((r) => r.count > 0 || r.targets)
        .map((r) => ({
          date: r.date,
          day_type: r.dayType,
          logged: r.logged,
          kcal: r.kcal,
          protein_g: r.protein,
          carbs_g: r.carbs,
          fat_g: r.fat,
          fiber_g: r.fiber,
          fruit_servings: r.fruit,
          veg_servings: r.veg,
          ...Object.fromEntries(MICROS.map((m) => [m, r.micros?.[m] ?? ''])),
          target_kcal_min: r.targets?.kcal.min,
          target_kcal_max: r.targets?.kcal.max,
          target_protein_min: r.targets?.protein.min,
          target_protein_max: r.targets?.protein.max,
          target_fat_min: r.targets?.fat.min,
          target_fat_max: r.targets?.fat.max,
          target_carbs_min: r.targets?.carbs?.min ?? '',
          target_carbs_max: r.targets?.carbs?.max ?? '',
        }))
    : []
  const foodLog = entries
    .sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1))
    .map((e) => {
      const t = entryTotal(e)
      return {
        date: e.date,
        time: e.time,
        meal: e.meal,
        food: e.name,
        qty: e.qty,
        serving: e.serving,
        kcal: Math.round(t.kcal),
        protein_g: t.protein,
        carbs_g: t.carbs,
        fat_g: t.fat,
        fiber_g: t.fiber,
        addons: e.addons?.map((a) => `${a.name} x${a.qty}`).join('; '),
        note: e.note,
      }
    })
  const foodRows = foods.map((f) => ({
    id: f.id,
    name: f.name,
    brand: f.brand,
    kind: f.kind,
    category: f.category,
    serving: f.serving,
    kcal: f.nutrients.kcal,
    protein_g: f.nutrients.protein,
    carbs_g: f.nutrients.carbs,
    fat_g: f.nutrients.fat,
    fiber_g: f.nutrients.fiber,
    ...Object.fromEntries(MICROS.map((m) => [m, f.nutrients.micros?.[m] ?? ''])),
    favorite: !!f.favorite,
    components: f.components?.map((c) => `${c.foodId} x${c.qty}`).join('; '),
  }))
  const meals = foods.filter((f) => f.kind !== 'food').map((f) => ({ id: f.id, name: f.name, kind: f.kind, yield: f.yield, components: f.components?.map((c) => `${foods.find((x) => x.id === c.foodId)?.name ?? c.foodId} x${c.qty}`).join('; ') }))
  const workouts = sessions.map((s) => ({
    date: s.date,
    workout: s.name,
    day_type: s.dayType,
    status: s.status,
    duration_min: s.endedAt ? Math.round((s.endedAt - s.startedAt) / 60000) : '',
    exercises: s.exercises.filter((e) => e.sets.some((x) => x.done)).length,
    dance: s.extras?.dance ?? '',
    note: s.note,
  }))
  const sets = sessions.flatMap((s) =>
    s.exercises.flatMap((e) =>
      e.sets.map((x, i) => ({
        date: s.date,
        workout: s.name,
        exercise: names.get(e.exerciseId) ?? e.exerciseId,
        set: i + 1,
        weight_lb: x.weight,
        reps: x.reps,
        rir: x.rir ?? '',
        minutes: x.minutes ?? '',
        completed: x.done,
        knee_discomfort: !!e.pain,
      })),
    ),
  )
  const meas = measurements.map((m) => ({ date: m.date, baseline: !!m.baseline, cycle_day: m.cycleDay ?? '', ...m.values, visual_waist: m.visualWaist, visual_glutes: m.visualGlutes, note: m.note }))
  return {
    'nutrition_daily.csv': toCSV(nutrition),
    'food_log.csv': toCSV(foodLog),
    'foods.csv': toCSV(foodRows),
    'meals_recipes.csv': toCSV(meals),
    'workouts.csv': toCSV(workouts),
    'exercise_sets.csv': toCSV(sets),
    'measurements.csv': toCSV(meas),
    'recovery.csv': toCSV(recovery as unknown as Record<string, unknown>[]),
    'cycle.csv': toCSV(cycle as unknown as Record<string, unknown>[]),
    'weekly_reviews.csv': toCSV(reviews.map((r) => ({ date: r.date, outcome: r.outcome, headline: r.headline, message: r.message, reasons: r.reasons.join(' | ') }))),
  }
}

function blobToDataURL(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = rej
    r.readAsDataURL(b)
  })
}

async function dataURLToBlob(u: string): Promise<Blob> {
  return (await fetch(u)).blob()
}

const TABLES = ['settings', 'foods', 'entries', 'days', 'exercises', 'templates', 'sessions', 'recovery', 'cycle', 'measurements', 'reviews'] as const

export async function buildJSON(includePhotos = true): Promise<string> {
  const out: Record<string, unknown> = { app: 'taper', version: 1, exportedAt: new Date().toISOString() }
  for (const t of TABLES) out[t] = await db.table(t).toArray()
  if (includePhotos) {
    const photos = await db.photos.toArray()
    out.photos = await Promise.all(photos.map(async (p) => ({ ...p, blob: await blobToDataURL(p.blob) })))
  }
  return JSON.stringify(out)
}

export async function restoreJSON(text: string) {
  const data = JSON.parse(text)
  if (data.app !== 'taper') throw new Error('This file is not a Taper backup.')
  const photos: Photo[] = await Promise.all(
    ((data.photos ?? []) as (Omit<Photo, 'blob'> & { blob: string })[]).map(async (p) => ({ ...p, blob: await dataURLToBlob(p.blob) })),
  )
  await db.transaction('rw', db.tables, async () => {
    for (const t of [...TABLES, 'photos' as const]) await db.table(t).clear()
    for (const t of TABLES) if (Array.isArray(data[t])) await db.table(t).bulkPut(data[t])
    await db.photos.bulkPut(photos)
  })
}

export function download(name: string, data: Blob | string, type = 'text/plain') {
  const blob = typeof data === 'string' ? new Blob([data], { type }) : data
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export async function exportCSVZip() {
  const files = await buildCSVs()
  const enc = new TextEncoder()
  const blob = zip(Object.entries(files).map(([name, text]) => ({ name, data: enc.encode(text) })))
  download(`taper-csv-${todayISO()}.zip`, blob)
}

export async function exportJSON(includePhotos: boolean) {
  download(`taper-backup-${todayISO()}.json`, await buildJSON(includePhotos), 'application/json')
}
