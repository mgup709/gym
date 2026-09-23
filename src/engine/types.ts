// Core domain types for the lower-body-dominant recomposition app.

export type Muscle =
  | 'gluteMax'
  | 'upperGlute' // glute medius / minimus / upper glute max — side & upper-glute width
  | 'hamstrings'
  | 'quads'
  | 'adductors'
  | 'deltoids'
  | 'traps'
  | 'back'
  | 'chest'
  | 'arms'

export type LowerMuscle = 'gluteMax' | 'upperGlute' | 'hamstrings' | 'quads' | 'adductors'

export type Level = 'low' | 'moderate' | 'high'

export type Pattern =
  | 'hipExtension' // shortened-position glute work
  | 'hinge' // lengthened glute / hamstring work
  | 'unilateral'
  | 'abduction'
  | 'hamstringCurl'
  | 'quad'
  | 'adduction'
  | 'upperPull'
  | 'upperPush'
  | 'arms'
  | 'shoulderHealth'

export interface Exercise {
  id: string
  name: string
  pattern: Pattern
  /** Fractional set credit per hard set (1 = primary mover, 0.5 = meaningful secondary). */
  muscles: Partial<Record<Muscle, number>>
  purpose: string
  kneeDemand: Level
  /** How much this movement tends to grow shoulders/traps. Used as a hard filter. */
  shoulderStimulus: Level
  /** Positioning for glute emphasis, used by the knee memory display. */
  gluteStimulus: Level
  quadStimulus: Level
  /** Default load increment in lb once the top of the rep range is hit. */
  increment: number
  cues: string[]
  kneeNotes?: string
  /** Load is external weight (true) or bodyweight / band (false). */
  loaded: boolean
}

export type DayType = 'glutesHams' | 'upperCore' | 'recovery' | 'glutesThighs' | 'lowerAccessory' | 'optional' | 'rest'

export interface Slot {
  slotId: string
  exerciseId: string
  sets: number
  repRange: [number, number]
  rir: [number, number]
  restSec: [number, number]
  /** Why this slot exists in the program — preserved across substitutions. */
  slotPurpose: string
  /** Which muscles the slot is responsible for, used to find stimulus-preserving substitutes. */
  target: LowerMuscle[] | 'upper'
}

export interface DayPlan {
  type: DayType
  title: string
  objective: string
  slots: Slot[]
  deepCore: boolean
  isLowerBody: boolean
  isTraining: boolean
}

export interface SetLog {
  weight: number
  reps: number
  rir: number
}

export interface ExerciseLog {
  slotId: string
  exerciseId: string
  sets: SetLog[]
  /** 0–5 knee response, only for knee-relevant exercises. */
  knee?: number
  formOk: boolean
}

export interface CoreLog {
  moveId: string
  level: number
  control: number // 1–5
  breathing: number // 1–5
  lumbarNeutral: boolean
  completed: boolean
}

export interface WorkoutSession {
  id: string
  date: string // YYYY-MM-DD
  dayType: DayType
  exercises: ExerciseLog[]
  core: CoreLog[]
  fatigue?: number // 1–5
  notes?: string
}

export interface KneeCheckin {
  date: string
  score: number // 0–5
  swelling: boolean
  instability: boolean
  notes?: string
}

export type MeasurementKey =
  | 'shoulderWidth'
  | 'bustWidth'
  | 'waistWidth'
  | 'lowerStomachWidth'
  | 'highHipWidth'
  | 'hipWidth'
  | 'thighWidth'
  | 'calfWidth'
  | 'bustCirc'
  | 'ribcageCirc'
  | 'waistCirc'
  | 'lowerStomachCirc'
  | 'highHipCirc'
  | 'hipCirc'
  | 'upperThighCirc'
  | 'midThighCirc'
  | 'calfCirc'
  | 'weight'

export type Measurements = Partial<Record<MeasurementKey, number>>

export interface MeasurementEntry {
  date: string
  values: Measurements
}

export type GoalMode = 'recomp' | 'gentleCut' | 'maintain' | 'leanGain'

export interface Profile {
  heightIn: number
  weightLb?: number
  age?: number
  goalMode: GoalMode
  trainingTime: string // HH:MM
  stepTarget: number
  /** Index 0 = Sunday … 6 = Saturday. */
  schedule: DayType[]
  apiKey?: string
}

export interface FoodItem {
  id: string
  name: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  meal: string
}

export interface WeeklyCheckin {
  date: string
  body: Measurements
  gluteStrength: 'down' | 'same' | 'up'
  lowerPerformance: 'down' | 'same' | 'up'
  completion: number // % of planned sessions
  soreness: number // 1–5
  fatigue: number // 1–5
  kneeSymptoms: number // 0–5
  coreControl: number // 1–5
  coreSessions: number
  calorieAdherence: number // 1–5
  proteinHit: number // days of 7
  hunger: number // 1–5
  carbsAroundTraining: boolean
  steps: number
  sleepHours: number
  stress: number // 1–5
  shoulderLooksBigger?: boolean
  notes?: string
}

export interface CycleSymptoms {
  energy: number // 1–5
  cramps: number // 0–3
  bloating: number // 0–3
  sleep: number // 1–5
  mood: number // 1–5
  bleeding?: 'none' | 'spotting' | 'light' | 'medium' | 'heavy'
}

export interface CycleSettings {
  enabled: boolean
  periodStarts: string[] // YYYY-MM-DD, any order
  cycleLength: number
  periodLength: number
  hormonalContraception: boolean
  symptoms: Record<string, CycleSymptoms>
}

export type Preference = 'low' | 'neutral' | 'high'

export interface CoachMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AppState {
  version: number
  profile: Profile
  baseline: MeasurementEntry
  measurements: MeasurementEntry[]
  sessions: WorkoutSession[]
  kneeCheckins: KneeCheckin[]
  preferences: Record<string, Preference>
  substitutions: Record<string, string>
  food: Record<string, FoodItem[]>
  steps: Record<string, number>
  checkins: WeeklyCheckin[]
  cycle: CycleSettings
  coreLevels: Record<string, number>
  /** Exercise id → date. Knee scores before this date are ignored (the user chose to retest the movement). */
  kneeResets: Record<string, string>
  coach: CoachMessage[]
}
