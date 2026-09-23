import Dexie, { type EntityTable } from 'dexie'
import type {
  CycleDay,
  DayLog,
  Exercise,
  FoodEntry,
  FoodItem,
  Measurement,
  Photo,
  Recovery,
  Settings,
  WeeklyReview,
  WorkoutSession,
  WorkoutTemplate,
} from './types'

export class TaperDB extends Dexie {
  settings!: EntityTable<Settings, 'id'>
  foods!: EntityTable<FoodItem, 'id'>
  entries!: EntityTable<FoodEntry, 'id'>
  days!: EntityTable<DayLog, 'date'>
  exercises!: EntityTable<Exercise, 'id'>
  templates!: EntityTable<WorkoutTemplate, 'id'>
  sessions!: EntityTable<WorkoutSession, 'id'>
  recovery!: EntityTable<Recovery, 'date'>
  cycle!: EntityTable<CycleDay, 'date'>
  measurements!: EntityTable<Measurement, 'id'>
  photos!: EntityTable<Photo, 'id'>
  reviews!: EntityTable<WeeklyReview, 'id'>

  constructor(name = 'taper') {
    super(name)
    this.version(1).stores({
      settings: 'id',
      foods: 'id, category, kind, quickLog, updatedAt',
      entries: 'id, date, foodId, createdAt',
      days: 'date',
      exercises: 'id',
      templates: 'id',
      sessions: 'id, date, templateId, status',
      recovery: 'date',
      cycle: 'date',
      measurements: 'id, date',
      photos: 'id, date, angle',
      reviews: 'id, date',
    })
  }
}

export const db = new TaperDB()

/** Ask the browser not to evict local data (long-term history lives here). */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist()
  } catch {
    /* not supported */
  }
  return false
}
