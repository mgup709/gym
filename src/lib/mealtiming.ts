// Meal rhythm for a day, adapted to wake time, training time and Friday dancing.
// Goal: avoid a big morning → long gap → ravenous evening pattern by keeping a real midday meal
// and a planned pre-workout snack. Times are guidance, not rules.
import { fmtTime, fromMin, toMin } from './dates'
import type { MealSlot } from './types'

export interface RhythmItem {
  key: string
  label: string
  start: string
  end: string
  meal?: MealSlot // which logged meal satisfies this item
  kind: 'meal' | 'train' | 'dance'
  aim: string
  optional?: boolean
}

interface Input {
  wake: string
  training: string | null
  dance?: string | null
}

const it = (key: string, label: string, s: number, e: number, meal: MealSlot | undefined, aim: string, extra: Partial<RhythmItem> = {}): RhythmItem => ({
  key,
  label,
  start: fromMin(s),
  end: fromMin(e),
  meal,
  kind: 'meal',
  aim,
  ...extra,
})

const BREAKFAST_AIM = '25–35 g protein + carbs + fruit or another whole food'
const MIDDAY_AIM = '30–35 g protein — keeps the afternoon and evening steady'
const PRE_AIM = '20–30 g protein, 30–60 g carbs, low-to-moderate fat'
const POST_AIM = '25–40 g protein, 40–80 g carbs, plus vegetables or fruit'
const DINNER_AIM = '30–40 g protein, carbs, vegetables'
const EVENING_AIM = 'If you are genuinely hungry, a planned snack is fine'

export function dayRhythm({ wake, training, dance }: Input): RhythmItem[] {
  const w = toMin(wake)
  const breakfast = w + 60
  const out: RhythmItem[] = []

  if (dance) {
    // Dance evening (Friday): substantial meal in the late afternoon, small carb top-up before.
    const d = toMin(dance)
    const T = training ? toMin(training) : null
    out.push(it('breakfast', 'Breakfast', breakfast, breakfast + 60, 'breakfast', BREAKFAST_AIM))
    if (T != null && T < 12 * 60) {
      out.push({ ...it('train', 'Glute session', T, T + 45, undefined, 'Short session — save energy for dancing'), kind: 'train' })
      out.push(it('lunch', 'Post-workout lunch', T + 90, T + 120, 'lunch', POST_AIM))
    } else {
      out.push(it('lunch', 'Lunch', Math.max(breakfast + 210, 12 * 60), Math.max(breakfast + 270, 13 * 60), 'lunch', MIDDAY_AIM))
      if (T != null) out.push({ ...it('train', 'Glute session', T, T + 45, undefined, 'Short session — save energy for dancing'), kind: 'train' })
    }
    out.push(it('snack', 'Protein + carb meal', d - 240, d - 180, 'snack', 'Substantial protein + carbs before dancing'))
    out.push(it('topup', 'Small carb snack', d - 90, d - 60, 'snack', 'Only if needed — fruit or a small carb snack', { optional: true }))
    out.push({ ...it('dance', 'Salsa / bachata', d, d + 120, undefined, 'About 2 hours'), kind: 'dance' })
    out.push(it('dinner', 'After dancing', d + 120, d + 150, 'dinner', 'Protein + carbs if hungry', { optional: true }))
    return out
  }

  if (training == null) {
    const lunch = Math.max(breakfast + 210, 12 * 60)
    out.push(it('breakfast', 'Breakfast', breakfast, breakfast + 60, 'breakfast', BREAKFAST_AIM))
    out.push(it('lunch', 'Lunch', lunch, lunch + 60, 'lunch', MIDDAY_AIM))
    out.push(it('snack', 'Afternoon snack', lunch + 180, lunch + 240, 'snack', '20–30 g protein + fruit'))
    out.push(it('dinner', 'Dinner', 18 * 60, 19 * 60, 'dinner', DINNER_AIM))
    out.push(it('evening', 'Evening (optional)', 20 * 60 + 30, 21 * 60 + 30, 'evening', EVENING_AIM, { optional: true }))
    return out
  }

  const T = toMin(training)
  const train: RhythmItem = { ...it('train', 'Train', T, T + 75, undefined, 'Workout'), kind: 'train' }

  if (T <= 11 * 60) {
    // Morning training
    const b = Math.max(w + 30, T - 120)
    out.push(it('breakfast', 'Breakfast', b, b + 30, 'breakfast', `${BREAKFAST_AIM}. Keep fat moderate before training.`))
    if (T - b > 90) out.push(it('topup', 'Small top-up', T - 45, T - 30, 'snack', 'Only if needed — fruit or a small carb snack', { optional: true }))
    out.push(train)
    out.push(it('lunch', 'Post-workout lunch', T + 90, T + 120, 'lunch', POST_AIM))
    out.push(it('snack', 'Afternoon snack', 15 * 60, 16 * 60, 'snack', '20–30 g protein + fruit'))
    out.push(it('dinner', 'Dinner', 18 * 60, 19 * 60, 'dinner', DINNER_AIM))
    out.push(it('evening', 'Evening (optional)', 20 * 60 + 30, 21 * 60 + 30, 'evening', EVENING_AIM, { optional: true }))
    return out
  }

  out.push(it('breakfast', 'Breakfast', breakfast, breakfast + 60, 'breakfast', BREAKFAST_AIM))

  if (T < 17 * 60 + 30) {
    // Afternoon training
    const lunch = Math.min(Math.max(breakfast + 210, 12 * 60), T - 150)
    if (T - lunch >= 150) {
      out.push(it('lunch', 'Lunch', lunch, lunch + 60, 'lunch', MIDDAY_AIM))
      out.push(it('snack', 'Pre-workout snack', T - 120, T - 90, 'snack', PRE_AIM))
    } else {
      out.push(it('lunch', 'Lunch (doubles as pre-workout)', lunch, lunch + 45, 'lunch', PRE_AIM))
    }
    out.push(train)
    out.push(it('dinner', 'Post-workout dinner', T + 90, T + 150, 'dinner', POST_AIM))
    out.push(it('evening', 'Evening (optional)', Math.max(T + 240, 20 * 60 + 30), Math.max(T + 300, 21 * 60 + 30), 'evening', EVENING_AIM, { optional: true }))
    return out
  }

  // Evening training
  const lunch = Math.max(breakfast + 210, 12 * 60)
  out.push(it('lunch', 'Lunch', lunch, lunch + 60, 'lunch', MIDDAY_AIM))
  out.push(it('snack', 'Substantial mini-meal', T - 180, T - 120, 'snack', PRE_AIM))
  out.push(train)
  out.push(it('dinner', 'Post-workout dinner', T + 90, T + 120, 'dinner', POST_AIM))
  return out
}

export const fmtWindow = (r: RhythmItem) => (r.start === r.end ? fmtTime(r.start) : `${fmtTime(r.start)}–${fmtTime(r.end)}`)

/** The next meal item whose window hasn't passed and whose meal isn't logged yet. */
export function nextRhythmItem(items: RhythmItem[], now: string, loggedMeals: Set<MealSlot>): RhythmItem | null {
  const t = toMin(now)
  return (
    items.find((r) => r.kind === 'meal' && !(r.meal && loggedMeals.has(r.meal) && r.key !== 'topup') && toMin(r.end) + 60 >= t) ?? null
  )
}
