import { db } from './db'
import { todayISO } from './dates'
import { DEFAULT_MICROS, DEFAULT_TARGETS, recomputeLibrary } from './nutrition'
import { DEFAULT_SCHEDULE, DEFAULT_TRAINING_TIMES, SEED_EXERCISES, SEED_TEMPLATES } from './seed-program'
import { SEED_FOODS } from './seed-foods'
import type { Measurement, Settings } from './types'

export function defaultSettings(today = todayISO()): Settings {
  const year = today.slice(0, 4)
  return {
    id: 'profile',
    setupDone: false,
    age: 22,
    heightIn: 66,
    baselineWeight: 137,
    startDate: today,
    units: { weight: 'lb', length: 'in' },
    theme: 'system',
    steadyIntake: false,
    targets: structuredClone(DEFAULT_TARGETS),
    microTargets: { ...DEFAULT_MICROS },
    wholeFood: { fruit: 2, veg: 3, calcium: 2 },
    schedule: [...DEFAULT_SCHEDULE],
    trainingTimes: [...DEFAULT_TRAINING_TIMES],
    wakeTime: '07:30',
    dance: { enabled: true, weekday: 5, time: '20:00' },
    measurementDay: 1,
    photoFrequency: '4weeks',
    cycle: { enabled: true, length: 28, periodLength: 5, lastStart: null, note: 'Copper IUD (non-hormonal) — cramps can be stronger.' },
    notifications: { weeklyCheckIn: true, browser: false },
    checkpoints: [
      { date: `${year}-10-31`, label: 'October 31 checkpoint' },
      { date: `${year}-12-25`, label: 'December 25 checkpoint' },
    ],
  }
}

export function baselineMeasurement(date: string): Measurement {
  return {
    id: 'baseline',
    date,
    baseline: true,
    values: {
      bust: 35,
      underbust: 31.5,
      waist: 28,
      belly: 31,
      highHip: 33,
      hips: 37,
      upperThigh: 21.75,
      midThigh: 19.75,
      calf: 13.5,
      wShoulders: 15.5,
      wBust: 12,
      wRibcage: 10,
      wWaist: 9.75,
      wBelly: 12,
      wHighHip: 12.75,
      wHips: 13.75,
      wUpperThigh: 7,
      wCalf: 4.25,
    },
    note: 'Starting measurements',
  }
}

/** Seeds the database on first run. Safe to call on every start. */
export async function ensureSeeded(): Promise<void> {
  await db.transaction('rw', [db.settings, db.foods, db.exercises, db.templates, db.measurements], async () => {
    const existing = await db.settings.get('profile')
    if (existing) return
    const today = todayISO()
    const now = Date.now()
    await db.settings.put(defaultSettings(today))
    const foods = recomputeLibrary(SEED_FOODS.map((f) => ({ ...f, createdAt: now, updatedAt: now })))
    await db.foods.bulkPut(foods)
    await db.exercises.bulkPut(SEED_EXERCISES)
    await db.templates.bulkPut(SEED_TEMPLATES)
    await db.measurements.put(baselineMeasurement(today))
  })
}
