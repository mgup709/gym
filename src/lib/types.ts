// Core data model. All weights are stored in lb and all lengths in inches;
// unit preferences only affect display and input.

export type ISODate = string // 'YYYY-MM-DD' (local calendar date)

export const MICROS = [
  'calcium',
  'iron',
  'magnesium',
  'potassium',
  'vitaminD',
  'folate',
  'b12',
  'iodine',
  'vitaminC',
] as const
export type Micro = (typeof MICROS)[number]

export interface Nutrients {
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  micros?: Partial<Record<Micro, number>>
}

/** Whole-food servings a food contributes, used for the fruit/veg/calcium goals. */
export interface FoodServings {
  fruit?: number
  veg?: number
  calcium?: number
}

export type FoodCategory =
  | 'breakfast'
  | 'meal'
  | 'snack'
  | 'fruit'
  | 'side'
  | 'pasta'
  | 'condiment'
  | 'ingredient'

export type FoodKind = 'food' | 'recipe' | 'meal'

export interface Component {
  foodId: string
  qty: number // servings of that food
}

export interface Modifier {
  id: string
  label: string
  /** foodId → qty to set (0 removes). Foods not in the component list are added. */
  set: Record<string, number>
}

export interface FoodItem {
  id: string
  name: string
  brand?: string
  kind: FoodKind
  category: FoodCategory
  serving: string // e.g. '1 cup (227 g)'
  /** Per one serving. For recipes/meals this is computed from components. */
  nutrients: Nutrients
  servings?: FoodServings
  tags?: string[]
  favorite?: boolean
  /** Shown in the Quick Log checklist, in this group. */
  quickLog?: QuickGroup
  quickOrder?: number
  /** Recipe: components make `yield` servings. Meal: components make one serving and can be adjusted when logging. */
  components?: Component[]
  yield?: number
  modifiers?: Modifier[]
  /** Optional extras offered when logging (default qty is ignored; they start at 0). */
  addons?: string[]
  /** Servings logged by a one-tap Quick Log. */
  defaultQty?: number
  /** Recipe/meal totals entered by hand instead of calculated from components. */
  manual?: boolean
  /** Values are an estimate (restaurant / typical label) — worth checking. */
  estimate?: boolean
  notes?: string
  archived?: boolean
  createdAt: number
  updatedAt: number
}

export type QuickGroup = 'breakfast' | 'snacks' | 'meals' | 'sides' | 'fruit' | 'extras'

export interface EntryAddon {
  foodId: string
  name: string
  qty: number
  per: Nutrients
  servings?: FoodServings
}

export type MealSlot = 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'evening'

export interface FoodEntry {
  id: string
  date: ISODate
  time: string // 'HH:MM'
  meal: MealSlot
  foodId?: string
  name: string
  qty: number
  serving: string
  /** Snapshot of nutrition for ONE serving at the time of logging (includes chosen components). */
  per: Nutrients
  servings?: FoodServings
  /** For meals logged with adjusted components. */
  components?: Component[]
  /** Extras logged with this entry, each with its own nutrition snapshot. */
  addons?: EntryAddon[]
  note?: string
  source?: 'quick' | 'search' | 'suggest' | 'copy' | 'manual'
  createdAt: number
}

/** 'glute' is the retired Friday glute + dance day, kept so older history still reads correctly. */
export type DayType = 'lowerA' | 'upper' | 'core' | 'lowerB' | 'lowerC' | 'dance' | 'glute' | 'rest'

export interface Range {
  min: number
  max: number
}

export interface DayTargets {
  kcal: Range
  protein: Range
  fat: Range
  /** null → fill remaining calories */
  carbs: Range | null
  fiber: Range
}

/** Per-date record. Holds the targets snapshot so history never changes when targets do. */
export interface DayLog {
  date: ISODate
  dayType: DayType
  targets: DayTargets
  workoutTime?: string // 'HH:MM' override for that day
  excluded?: boolean // incomplete log — left out of averages
  note?: string
}

export type ExerciseKind = 'weighted' | 'bodyweight' | 'timed' | 'cardio'
export type ExerciseClass = 'compound' | 'unilateral' | 'isolation' | 'core' | 'cardio'

export interface Exercise {
  id: string
  name: string
  kind: ExerciseKind
  cls: ExerciseClass
  knee: boolean // show the Pain / Discomfort option
  perLeg?: boolean
  increment: number // lb load step when progressing
  alternatives: string[]
  cues?: string
  baseline?: { weight: number; reps: number; sets: number }
  custom?: boolean
}

export interface PlannedExercise {
  exerciseId: string
  sets: number
  repMin: number
  repMax: number
  rirMin: number
  rirMax: number
  restMin: number // seconds
  restMax: number
  optional?: boolean
  note?: string
}

export interface WorkoutTemplate {
  id: string
  name: string
  dayType: DayType
  goal: string
  exercises: PlannedExercise[]
  finisher?: string // e.g. dance note
}

export interface SetLog {
  weight: number
  reps: number
  rir: number | null
  done: boolean
  minutes?: number
}

export interface SessionExercise {
  exerciseId: string
  plan: PlannedExercise
  sets: SetLog[]
  pain?: boolean
  painNote?: string
  skipped?: boolean
  swappedFrom?: string
}

export interface WorkoutSession {
  id: string
  date: ISODate
  templateId: string
  dayType: DayType
  name: string
  startedAt: number
  endedAt?: number
  status: 'active' | 'done'
  exercises: SessionExercise[]
  extras?: { dance?: boolean; cardioMin?: number }
  note?: string
}

export type BingeLevel = 'none' | 'mild' | 'strong' | 'episode'

export interface Recovery {
  date: ISODate
  hunger?: number
  energy?: number
  performance?: number
  soreness?: number
  stress?: number
  sleep?: number
  sleepHours?: number
  restingHR?: number
  preoccupation?: number
  binge?: BingeLevel
  note?: string
}

export type Flow = 'none' | 'spotting' | 'light' | 'medium' | 'heavy'

export interface CycleDay {
  date: ISODate
  flow?: Flow
  cramps?: number // 0–3
  bloating?: number // 0–3
  cravings?: number // 0–3
  note?: string
}

export const REQUIRED_MEASURES = ['waist', 'belly', 'hips'] as const
export const OPTIONAL_MEASURES = ['highHip', 'bust', 'underbust', 'upperThigh', 'midThigh', 'calf'] as const
export const WIDTHS = ['wWaist', 'wBelly', 'wHighHip', 'wHips'] as const
export type MeasureKey =
  | (typeof REQUIRED_MEASURES)[number]
  | (typeof OPTIONAL_MEASURES)[number]
  | (typeof WIDTHS)[number]
  | 'wShoulders'
  | 'wBust'
  | 'wRibcage'
  | 'wUpperThigh'
  | 'wCalf'

export interface Measurement {
  id: string
  date: ISODate
  values: Partial<Record<MeasureKey, number>>
  baseline?: boolean
  cycleDay?: number | null
  visualWaist?: 'tighter' | 'same' | 'softer' | 'unsure'
  visualGlutes?: 'fuller' | 'same' | 'smaller' | 'unsure'
  note?: string
}

export type PhotoAngle = 'front' | 'side' | 'back' | 'side2'

export interface Photo {
  id: string
  date: ISODate
  angle: PhotoAngle
  blob: Blob
  width: number
  height: number
  cycleDay?: number | null
  createdAt: number
}

export type Outcome = 'keep' | 'reduce' | 'increase' | 'hold'

export interface WeeklyReview {
  id: string
  kind?: 'weekly' | 'checkpoint'
  date: ISODate // check-in date
  outcome: Outcome
  headline: string
  message: string
  reasons: string[]
  snapshot: Record<string, number | string | null>
  applied?: boolean
  createdAt: number
}

export interface Settings {
  id: 'profile'
  setupDone: boolean
  age: number
  heightIn: number
  baselineWeight: number
  startDate: ISODate
  units: { weight: 'lb' | 'kg'; length: 'in' | 'cm' }
  theme: 'system' | 'light' | 'dark'
  steadyIntake: boolean
  targets: Record<DayType | 'default', DayTargets>
  microTargets: Record<Micro, number>
  wholeFood: { fruit: number; veg: number; calcium: number }
  /** index 0 = Sunday … 6 = Saturday → template id or 'rest' */
  schedule: string[]
  trainingTimes: (string | null)[]
  wakeTime: string
  dance: { enabled: boolean; weekday: number; time: string }
  measurementDay: number
  photoFrequency: 'weekly' | '4weeks'
  cycle: { enabled: boolean; length: number; periodLength: number; lastStart: ISODate | null; note: string }
  notifications: { weeklyCheckIn: boolean; browser: boolean }
  checkpoints: { date: ISODate; label: string }[]
  lastBackup?: number
  /** Bumped when the built-in program/targets are migrated. */
  programVersion?: number
}

/** A workout or activity recorded elsewhere (Apple Watch via Apple Health, or entered by hand). */
export interface Activity {
  id: string
  date: ISODate
  source: 'apple-health' | 'manual'
  type: string // e.g. 'Traditional Strength Training', 'Dance'
  start?: string // 'HH:MM'
  minutes: number
  avgHR?: number
  maxHR?: number
  note?: string
}
