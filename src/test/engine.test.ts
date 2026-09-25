import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { addDays } from '@/lib/dates'
import { dayRhythm } from '@/lib/mealtiming'
import { carbRange, dayTotals, DEFAULT_TARGETS, entryTotal, recomputeLibrary } from '@/lib/nutrition'
import { compareToLast, findPRs, historyFor, kneeFlag, suggestNext } from '@/lib/progression'
import { deleteEntry, ensureDay, getSettings, logFood, saveFood, saveSettings } from '@/lib/repo'
import { weeklyReview } from '@/lib/review'
import { ensureSeeded } from '@/lib/seed'
import { SEED_FOODS } from '@/lib/seed-foods'
import { SEED_EXERCISES, SEED_TEMPLATES } from '@/lib/seed-program'
import { suggest } from '@/lib/suggest'
import { dailyRows, movingAverage, summarize } from '@/lib/trends'
import type { Measurement, Recovery, SetLog, WorkoutSession } from '@/lib/types'
import { crc32 } from '@/lib/zip'
import { recoverySignals } from '@/lib/recovery'
import { cycleInfo, periodStarts } from '@/lib/cycle'
import { defaultSettings } from '@/lib/seed'

const foods = recomputeLibrary(SEED_FOODS)
const food = (id: string) => foods.find((f) => f.id === id)!
const ex = (id: string) => SEED_EXERCISES.find((e) => e.id === id)!
const plan = (tid: string, eid: string) => SEED_TEMPLATES.find((t) => t.id === tid)!.exercises.find((p) => p.exerciseId === eid)!

function session(date: string, exerciseId: string, sets: [number, number, number?][], pain = false, tid = 'lowerA'): WorkoutSession {
  const s: SetLog[] = sets.map(([weight, reps, rir]) => ({ weight, reps, rir: rir ?? null, done: true }))
  return {
    id: `${date}-${exerciseId}`,
    date,
    templateId: tid,
    dayType: 'lowerA',
    name: 'x',
    startedAt: new Date(date).getTime(),
    status: 'done',
    exercises: [{ exerciseId, plan: plan(tid, exerciseId), sets: s, pain }],
  }
}

describe('food library', () => {
  it('calculates the cottage cheese pancake recipe from its ingredients', () => {
    const p = food('pancakes').nutrients
    expect(p.kcal).toBeGreaterThan(220)
    expect(p.kcal).toBeLessThan(260)
    expect(p.protein).toBeCloseTo(27.9, 0)
    expect(p.carbs).toBeGreaterThan(20)
    expect(p.fat).toBeLessThan(5)
    expect(p.fiber).toBeGreaterThan(4)
  })
  it('Oats Overnight + 5 oz soy milk lands near 30 g protein', () => {
    expect(food('oo-cookies-soy').nutrients.protein).toBeGreaterThanOrEqual(28)
    expect(food('oo-cookies-soy').nutrients.protein).toBeLessThanOrEqual(31)
  })
  it('Chobani entries match the stated protein', () => {
    expect(food('chobani-plain').nutrients.protein).toBe(20)
    expect(food('chobani-lemon').nutrients).toMatchObject({ kcal: 140, protein: 11 })
  })
  it('every combo references existing foods and has nutrition', () => {
    const ids = new Set(foods.map((f) => f.id))
    for (const f of foods.filter((x) => x.kind !== 'food')) {
      for (const c of f.components!) expect(ids.has(c.foodId), `${f.id} → ${c.foodId}`).toBe(true)
      expect(f.nutrients.kcal, f.id).toBeGreaterThan(0)
    }
    for (const f of foods) for (const a of f.addons ?? []) expect(ids.has(a), `${f.id} addon ${a}`).toBe(true)
  })
  it('fills rest-day carbs from remaining calories', () => {
    const r = carbRange(DEFAULT_TARGETS.rest)
    expect(r.min).toBeGreaterThan(150)
    expect(r.max).toBeGreaterThan(r.min)
  })
})

describe('logging + history integrity', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    await ensureSeeded()
  })

  it('logging creates an entry that updates the day totals, deleting removes it', async () => {
    const e = await logFood('2026-09-21', food('pancakes'), { source: 'quick' })
    let es = await db.entries.where('date').equals('2026-09-21').toArray()
    expect(es).toHaveLength(1)
    expect(dayTotals(es).protein).toBeCloseTo(27.9, 0)
    await deleteEntry(e.id)
    es = await db.entries.where('date').equals('2026-09-21').toArray()
    expect(dayTotals(es).kcal).toBe(0)
  })

  it('keeps past day targets when targets change', async () => {
    const past = await ensureDay('2020-01-06') // a Monday
    expect(past.dayType).toBe('lowerA')
    const s = await getSettings()
    s.targets.lowerA.kcal = { min: 2100, max: 2200 }
    await saveSettings(s)
    expect((await db.days.get('2020-01-06'))!.targets.kcal.min).toBe(1950)
  })

  it('editing a food does not rewrite already-logged entries, but updates recipes that use it', async () => {
    await logFood('2026-09-21', food('pancakes'))
    const cc = (await db.foods.get('cottage-cheese'))!
    await saveFood({ ...cc, nutrients: { ...cc.nutrients, protein: 20 } })
    const entry = (await db.entries.toArray())[0]
    expect(entry.per.protein).toBeCloseTo(27.9, 0)
    expect((await db.foods.get('pancakes'))!.nutrients.protein).toBeCloseTo(33.9, 0)
  })

  it('addons and components are counted', async () => {
    const e = await logFood('2026-09-21', food('poke'), { modifiers: ['nomayo', 'xsalmon'], addons: [{ foodId: 'maple-syrup', qty: 1 }] })
    const base = food('poke').nutrients
    const t = entryTotal(e)
    expect(t.kcal).toBeCloseTo(base.kcal - 135 + 235 + 52, -1)
  })
})

describe('double progression', () => {
  const hip = ex('hip-thrust')
  const p = plan('lowerA', 'hip-thrust')
  it('keeps the load and adds reps when not all sets hit the top', () => {
    const h = historyFor('hip-thrust', [session('2026-09-21', 'hip-thrust', [[130, 9], [130, 8], [130, 8], [130, 7]])])
    const s = suggestNext(hip, p, h)
    expect(s.kind).toBe('add-reps')
    expect(s.weight).toBe(130)
    expect(s.text).toMatch(/Keep 130/)
  })
  it('adds load once every set reaches the top of the range', () => {
    const h = historyFor('hip-thrust', [session('2026-09-21', 'hip-thrust', [[130, 10, 1], [130, 10, 1], [130, 10, 2], [130, 10, 1]])])
    const s = suggestNext(hip, p, h)
    expect(s.kind).toBe('add-load')
    expect(s.weight).toBe(140)
  })
  it('holds progression after knee discomfort and flags repeated pain', () => {
    const sessions = [
      session('2026-09-14', 'hip-thrust', [[130, 10], [130, 10], [130, 10], [130, 10]], true),
      session('2026-09-21', 'hip-thrust', [[130, 10], [130, 10], [130, 10], [130, 10]], true),
    ]
    expect(suggestNext(hip, p, historyFor('hip-thrust', sessions)).kind).toBe('deload-pain')
    expect(kneeFlag('hip-thrust', sessions).flagged).toBe(true)
  })
  it('uses the baseline when there is no history', () => {
    const s = suggestNext(hip, p, [])
    expect(s.weight).toBe(130)
  })
  it('reports rep changes and PRs', () => {
    const a = session('2026-09-14', 'hip-thrust', [[130, 9], [130, 8], [130, 8], [130, 7]])
    const b = session('2026-09-21', 'hip-thrust', [[130, 10], [130, 9], [130, 8], [130, 7]])
    expect(compareToLast(b.exercises[0].sets, historyFor('hip-thrust', [a])[0])).toBe('+2 total reps vs last session')
    const prs = findPRs(b, [a], new Map([['hip-thrust', 'Hip thrust']]))
    expect(prs[0]).toMatchObject({ type: 'rep', reps: 10, weight: 130 })
  })
})

describe('meal timing', () => {
  it('10 AM training → breakfast ~8, post-workout lunch', () => {
    const r = dayRhythm({ wake: '07:00', training: '10:00' })
    expect(r[0]).toMatchObject({ key: 'breakfast', start: '08:00' })
    expect(r.find((x) => x.key === 'lunch')!.label).toMatch(/Post-workout/)
  })
  it('4 PM training → pre-workout snack ~2 PM, dinner after', () => {
    const r = dayRhythm({ wake: '07:30', training: '16:00' })
    expect(r.find((x) => x.key === 'snack')!.start).toBe('14:00')
    expect(r.find((x) => x.key === 'dinner')!.start).toBe('17:30')
  })
  it('7 PM training → substantial mini-meal 4–5 PM', () => {
    const r = dayRhythm({ wake: '07:30', training: '19:00' })
    expect(r.find((x) => x.key === 'snack')).toMatchObject({ start: '16:00', end: '17:00' })
  })
  it('Friday dance at 8 PM', () => {
    const r = dayRhythm({ wake: '07:30', training: null, dance: '20:00' })
    expect(r.find((x) => x.key === 'snack')).toMatchObject({ start: '16:00', end: '17:00' })
    expect(r.find((x) => x.key === 'topup')).toMatchObject({ start: '18:30', optional: true })
  })
})

describe('what should I eat next', () => {
  it('suggests 2–4 foods from the library before a 4 PM workout', () => {
    const res = suggest({
      now: '14:30',
      targets: DEFAULT_TARGETS.lowerA,
      training: '16:00',
      dance: null,
      wake: '07:30',
      entries: [],
      history: [],
      foods,
      fruitGoal: 2,
      today: '2026-09-21',
    })
    expect(res.phase).toBe('pre')
    expect(res.headline).toMatch(/you train at 4:00 PM/)
    expect(res.items.length).toBeGreaterThanOrEqual(2)
    expect(res.items.length).toBeLessThanOrEqual(4)
    for (const i of res.items) expect(foods).toContain(i.food)
  })
})

describe('trends', () => {
  it('moving averages ignore days that were not logged', () => {
    const entries = [
      { id: 'a', date: '2026-09-01', time: '08:00', meal: 'breakfast' as const, name: 'x', qty: 1, serving: '', per: { kcal: 2000, protein: 130, carbs: 200, fat: 60, fiber: 25 }, createdAt: 0 },
      { id: 'b', date: '2026-09-03', time: '08:00', meal: 'breakfast' as const, name: 'x', qty: 1, serving: '', per: { kcal: 1800, protein: 120, carbs: 200, fat: 60, fiber: 25 }, createdAt: 0 },
    ]
    const rows = dailyRows('2026-09-01', '2026-09-03', [], entries)
    expect(rows[1].logged).toBe(false)
    expect(movingAverage(rows, 'kcal', 7, 1)[2]).toBe(1900)
    expect(summarize(rows).logged).toBe(2)
  })
})

describe('weekly decision engine', () => {
  const today = '2026-10-20'
  const m = (date: string, waist: number, belly: number, hips: number, cycleDay: number | null = null): Measurement => ({
    id: date,
    date,
    values: { waist, belly, hips },
    cycleDay,
  })
  const rows = (kcal: number) =>
    dailyRows(addDays(today, -20), today, [], Array.from({ length: 21 }, (_, i) => ({
      id: String(i), date: addDays(today, -i), time: '12:00', meal: 'lunch' as const, name: 'x', qty: 1, serving: '',
      per: { kcal, protein: 130, carbs: 220, fat: 60, fiber: 25 }, createdAt: 0,
    })))
  const goodRecovery: Recovery[] = Array.from({ length: 14 }, (_, i) => ({ date: addDays(today, -i), hunger: 3, energy: 4, performance: 4, sleep: 4, preoccupation: 2, binge: 'none' }))
  const base = {
    today,
    retentionWindow: false,
    cycleDays: [],
    sessions: [],
    priorReviews: [],
    currentKcalMax: 1950,
    rows21: rows(1930),
    rows7: rows(1930).slice(-7),
    recovery: goodRecovery,
  }

  it('needs ~3 weeks of data before suggesting changes', () => {
    const r = weeklyReview({ ...base, measurements: [m('2026-10-13', 28, 31, 37), m('2026-10-20', 28, 31, 37)] })
    expect(r.outcome).toBe('keep')
  })
  it('keeps the plan when the waist trends down and hips hold', () => {
    const r = weeklyReview({ ...base, measurements: [m('2026-09-22', 28, 31, 37), m('2026-09-29', 27.9, 31, 37), m('2026-10-06', 27.75, 30.9, 37), m('2026-10-13', 27.6, 30.75, 37.1), m('2026-10-20', 27.5, 30.6, 37.1)] })
    expect(r.outcome).toBe('keep')
    expect(r.message).toMatch(/aligned/)
  })
  it('suggests a small reduction only after a ~3-week stall with good recovery', () => {
    const ms = [m('2026-09-22', 28, 31, 37), m('2026-09-29', 28, 31, 37), m('2026-10-06', 28, 31, 37), m('2026-10-13', 28, 31, 37), m('2026-10-20', 28, 31, 37)]
    const r = weeklyReview({ ...base, measurements: ms })
    expect(r.outcome).toBe('reduce')
    expect(r.message).toMatch(/100–150/)
  })
  it('does not suggest a reduction when intake is above the planned range', () => {
    const ms = [m('2026-09-22', 28, 31, 37), m('2026-09-29', 28, 31, 37), m('2026-10-06', 28, 31, 37), m('2026-10-13', 28, 31, 37), m('2026-10-20', 28, 31, 37)]
    expect(weeklyReview({ ...base, rows21: rows(2200), measurements: ms }).outcome).toBe('keep')
  })
  it('holds when a waist increase happens in a water-retention window', () => {
    const ms = [m('2026-09-22', 28, 31, 37), m('2026-09-29', 28, 31, 37), m('2026-10-06', 28, 31, 37), m('2026-10-13', 28, 31, 37), m('2026-10-20', 28.5, 31.5, 37, 26)]
    expect(weeklyReview({ ...base, measurements: ms, retentionWindow: true }).outcome).toBe('hold')
  })
  it('recommends eating more when hunger and food preoccupation rise', () => {
    const rec: Recovery[] = Array.from({ length: 14 }, (_, i) => ({ date: addDays(today, -i), hunger: 5, energy: 2, preoccupation: 4, binge: i % 4 === 0 ? 'strong' : 'none' }))
    expect(recoverySignals(rec, today).concern).toBe(true)
    const r = weeklyReview({ ...base, recovery: rec, measurements: [m('2026-10-13', 28, 31, 37), m('2026-10-20', 28, 31, 37)] })
    expect(r.outcome).toBe('increase')
  })
})

describe('cycle', () => {
  it('computes cycle day and retention window from logged period starts', () => {
    const s = defaultSettings('2026-09-01')
    const starts = periodStarts([{ date: '2026-09-01', flow: 'medium' }, { date: '2026-09-02', flow: 'heavy' }], s)
    expect(starts).toEqual(['2026-09-01'])
    expect(cycleInfo('2026-09-12', starts, s)).toMatchObject({ day: 12, retention: false })
    expect(cycleInfo('2026-09-26', starts, s)).toMatchObject({ day: 26, retention: true })
  })
})

describe('zip', () => {
  it('crc32 matches the reference value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })
})

describe('v2 program migration', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })
  it('moves an existing v1 install to the leg-hypertrophy week without touching past days', async () => {
    const { migrate } = await import('@/lib/seed')
    const { DEFAULT_TARGETS: T } = await import('@/lib/nutrition')
    const s = defaultSettings('2026-09-20')
    const v1 = { ...s, setupDone: true, baselineWeight: 137, programVersion: undefined, schedule: ['rest', 'lowerA', 'upper', 'core', 'lowerB', 'glute', 'rest'] }
    const t = structuredClone(T) as Record<string, unknown>
    delete t.lowerC
    delete t.dance
    ;(t.glute as { kcal: { min: number } }).kcal.min = 1990 // a user edit that should carry over to dance night
    await db.settings.put({ ...v1, targets: t as typeof s.targets })
    await db.templates.put({ id: 'glute', name: 'old', dayType: 'glute', goal: '', exercises: [] })
    await db.days.put({ date: '2020-01-03', dayType: 'glute', targets: T.glute })
    await migrate()
    const m = (await db.settings.get('profile'))!
    expect(m.baselineWeight).toBe(128)
    expect(m.schedule).toEqual(['rest', 'lowerA', 'upper', 'lowerB', 'lowerC', 'dance', 'rest'])
    expect(m.targets.dance.kcal.min).toBe(1990)
    expect(m.targets.lowerC).toBeDefined()
    expect(m.trainingTimes[5]).toBeNull()
    expect(await db.templates.get('glute')).toBeUndefined()
    expect((await db.templates.get('lowerC'))!.exercises.length).toBeGreaterThan(3)
    expect((await db.days.get('2020-01-03'))!.dayType).toBe('glute')
    // Friday is dance night with no workout template
    const { dayTypeFromSchedule } = await import('@/lib/repo')
    expect(dayTypeFromSchedule(m, await db.templates.toArray(), '2026-09-25')).toBe('dance')
  })
  it('glutes are trained 3x and quads at least 2x per week, with no lifting on dance night', () => {
    const lower = SEED_TEMPLATES.filter((t) => ['lowerA', 'lowerB', 'lowerC'].includes(t.id))
    expect(lower).toHaveLength(3)
    const glute = ['hip-thrust', 'machine-hip-thrust', 'glute-bridge', 'cable-kickback', 'back-ext-45', 'abduction', 'bss', 'reverse-lunge']
    for (const t of lower) expect(t.exercises.some((p) => glute.includes(p.exerciseId))).toBe(true)
    const quadDays = lower.filter((t) => t.exercises.some((p) => ['leg-press', 'bss', 'reverse-lunge', 'leg-extension'].includes(p.exerciseId)))
    expect(quadDays.length).toBeGreaterThanOrEqual(2)
  })
})

describe('editable nutrition', () => {
  it('a meal with manual totals uses them instead of the calculation', () => {
    const lib = new Map(foods.map((f) => [f.id, f]))
    const poke = { ...food('poke'), manual: true, nutrients: { kcal: 720, protein: 40, carbs: 80, fat: 25, fiber: 6 } }
    const r = recomputeLibrary([...foods.filter((f) => f.id !== 'poke'), poke]).find((f) => f.id === 'poke')!
    expect(r.nutrients.kcal).toBe(720)
    expect(lib.get('poke')!.nutrients.kcal).not.toBe(720)
  })
})

describe('Apple Health import', () => {
  it('parses an import link with workouts, sleep and resting HR', async () => {
    const { parseImportParams } = await import('@/lib/health')
    const q = new URLSearchParams('date=2026-09-25&workout=Traditional Strength Training&start=16:05&min=1:02:30&hr=128&sleep=7:30&rhr=58&w=Dance~2026-09-25T20:00~118~135')
    const r = parseImportParams(q, '2026-09-25')
    expect(r.activities).toHaveLength(2)
    expect(r.activities[0]).toMatchObject({ type: 'Traditional Strength Training', start: '16:05', minutes: 63, avgHR: 128 })
    expect(r.activities[1]).toMatchObject({ type: 'Dance', start: '20:00', minutes: 118 })
    expect(r.sleep).toEqual({ date: '2026-09-25', hours: 7.5 })
    expect(r.restingHR?.value).toBe(58)
  })
  it('reads a workouts CSV by column names and does not duplicate on re-import', async () => {
    await db.delete()
    await db.open()
    const { parseWorkoutCSV, applyImport } = await import('@/lib/health')
    const csv = 'Workout Type,Start,End,Duration,Active Energy (kcal),Avg Heart Rate (bpm)\nTraditional Strength Training,2026-09-24 16:02:11,2026-09-24 17:00:00,00:57:49,210,121\nSocial Dance,2026-09-25 20:01:00,2026-09-25 22:00:00,01:59:00,450,133\n'
    const acts = parseWorkoutCSV(csv)
    expect(acts).toHaveLength(2)
    expect(acts[0]).toMatchObject({ date: '2026-09-24', start: '16:02', minutes: 58, avgHR: 121 })
    expect(Object.keys(acts[0])).not.toContain('kcal')
    expect((await applyImport({ activities: acts })).added).toBe(2)
    expect((await applyImport({ activities: parseWorkoutCSV(csv) })).updated).toBe(2)
    expect(await db.activities.count()).toBe(2)
  })
})
