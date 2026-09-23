import type { DayType, GoalMode, Profile } from './types'
import { DAY_PLANS } from '../data/program'

export interface Macros {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export type NutritionDay = 'lower' | 'upper' | 'rest'

export const dayKind = (t: DayType): NutritionDay =>
  DAY_PLANS[t].isLowerBody ? 'lower' : DAY_PLANS[t].isTraining ? 'upper' : 'rest'

const LB_TO_KG = 0.4536

/** Deliberately modest adjustments: a big deficit would undercut glute and thigh growth. */
const GOAL_FACTOR: Record<GoalMode, number> = {
  recomp: 0.92,
  gentleCut: 0.85,
  maintain: 1,
  leanGain: 1.07,
}

export const GOAL_LABEL: Record<GoalMode, string> = {
  recomp: 'Recomposition (small deficit)',
  gentleCut: 'Gentle fat loss',
  maintain: 'Maintenance',
  leanGain: 'Lean gain (build lower body)',
}

export function bmr(p: Profile): number | null {
  if (!p.weightLb || !p.age) return null
  // Mifflin-St Jeor (female)
  return 10 * p.weightLb * LB_TO_KG + 6.25 * p.heightIn * 2.54 - 5 * p.age - 161
}

export function averageTargets(p: Profile, activityFactor = 1.5): Macros | null {
  const b = bmr(p)
  if (!b || !p.weightLb) return null
  const tdee = b * activityFactor
  // Never below ~1.2 × BMR: no extreme restriction in pursuit of a smaller waist.
  const kcal = Math.round(Math.max(tdee * GOAL_FACTOR[p.goalMode], b * 1.2) / 10) * 10
  const protein = Math.round(Math.min(p.weightLb * 0.8, 170)) // ~1.75 g/kg, stable every day
  const fat = Math.round(Math.max(p.weightLb * 0.35, (kcal * 0.25) / 9))
  const carbs = Math.round((kcal - protein * 4 - fat * 9) / 4)
  return { kcal, protein, carbs, fat }
}

/**
 * Carb cycling that keeps the weekly total equal to 7 × average. Lower-body days get the
 * most carbohydrate; rest days a little less (fat nudges up). Swings are capped around ±10%.
 */
export function dayTargets(avg: Macros, schedule: DayType[], day: DayType): Macros {
  const kinds = schedule.map(dayKind)
  const n = { lower: 0, upper: 0, rest: 0 }
  kinds.forEach((k) => n[k]++)

  const lowerCarbBump = Math.round(avg.carbs * 0.18)
  const restCarbCut = n.rest ? Math.round((lowerCarbBump * n.lower) / (n.rest + n.upper * 0.3)) : 0
  const upperCarbCut = Math.round(restCarbCut * 0.3)
  const restFatBump = Math.round((restCarbCut * 4 * 0.45) / 9)
  const fatSurplus = restFatBump * n.rest
  const lowerFatCut = n.lower ? Math.round(fatSurplus / n.lower) : 0

  const k = dayKind(day)
  let carbs = avg.carbs
  let fat = avg.fat
  if (k === 'lower') {
    carbs += lowerCarbBump
    fat -= lowerFatCut
  } else if (k === 'upper') {
    carbs -= upperCarbCut
  } else {
    carbs -= restCarbCut
    fat += restFatBump
  }
  // Floor to keep carbs meaningful on every day.
  carbs = Math.max(carbs, Math.round(avg.carbs * 0.75))
  const kcal = Math.round((avg.protein * 4 + carbs * 4 + fat * 9) / 10) * 10
  return { kcal, protein: avg.protein, carbs, fat }
}

export function applyCycle(m: Macros, kcalDelta: number, carbDeltaG: number): Macros {
  if (!kcalDelta) return m
  const fatExtra = Math.max(0, Math.round((kcalDelta - carbDeltaG * 4) / 9))
  return { kcal: m.kcal + kcalDelta, protein: m.protein, carbs: m.carbs + carbDeltaG, fat: m.fat + fatExtra }
}

export interface Meal {
  time: string
  name: string
  focus: string
  share: { protein: number; carbs: number; fat: number }
  ideas: string[]
}

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
const toTime = (min: number) => {
  const m = ((Math.round(min / 15) * 15) % 1440 + 1440) % 1440
  const h = Math.floor(m / 60)
  const mm = m % 60
  const suffix = h >= 12 ? 'PM' : 'AM'
  return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${suffix}`
}

export const MEAL_IDEAS = {
  breakfast: ['Cottage-cheese protein pancakes + berries + maple', 'Overnight oats with whey, chia and banana', 'Egg & veggie scramble on sourdough with feta', 'Skyr bowl with granola, honey and fruit'],
  lunch: ['Chicken shawarma rice bowl with garlic yogurt sauce', 'Turkey pesto sandwich + fruit', 'Mediterranean grain bowl with salmon, hummus, olives', 'Carnitas burrito bowl with salsa verde and black beans'],
  pre: ['Greek yogurt + banana + honey', 'Rice cakes with jam + a protein shake', 'Bagel with light cream cheese and turkey', 'Overnight oats (small) + fruit'],
  post: ['Chicken or shrimp pasta arrabbiata with parmesan', 'Beef & rice burrito bowl with pico and crema', 'Salmon, lemon-herb orzo and roasted veg', 'Turkey meatballs, marinara and spaghetti'],
  dinner: ['Lemon-garlic chicken with roasted potatoes and salad', 'Shrimp tacos with slaw and chipotle mayo', 'Pasta primavera with chicken sausage', 'Greek chicken souvlaki plate with tzatziki and pita'],
  snack: ['Protein pudding or skyr with cocoa', 'Cottage cheese + pineapple', 'Dark chocolate + a latte', 'Frozen-yogurt protein bark'],
}

/** Meal plan organised around the training time. */
export function mealPlan(day: DayType, trainingTime: string): Meal[] {
  const k = dayKind(day)
  if (k === 'rest') {
    return [
      { time: '9:00 AM', name: 'Breakfast', focus: 'Protein + some carbs', share: { protein: 0.25, carbs: 0.25, fat: 0.2 }, ideas: MEAL_IDEAS.breakfast },
      { time: '1:00 PM', name: 'Lunch', focus: 'Protein + carbs + veg', share: { protein: 0.3, carbs: 0.3, fat: 0.3 }, ideas: MEAL_IDEAS.lunch },
      { time: '4:00 PM', name: 'Snack', focus: 'Protein', share: { protein: 0.15, carbs: 0.15, fat: 0.1 }, ideas: MEAL_IDEAS.snack },
      { time: '7:00 PM', name: 'Dinner', focus: 'Protein + flavour + remaining macros', share: { protein: 0.3, carbs: 0.3, fat: 0.4 }, ideas: MEAL_IDEAS.dinner },
    ]
  }
  const w = toMin(trainingTime)
  const breakfast = Math.min(w - 180, 9 * 60)
  const pre = w - 90
  const post = w + 90
  const lunch = Math.min(Math.max(breakfast + 210, 11 * 60 + 30), pre - 120)
  const heavy = k === 'lower'
  const meals: Meal[] = []
  if (breakfast >= 5 * 60) meals.push({ time: toTime(breakfast), name: 'Breakfast', focus: 'Protein + carbohydrates', share: { protein: 0.22, carbs: 0.2, fat: 0.25 }, ideas: MEAL_IDEAS.breakfast })
  if (lunch > breakfast + 120 && lunch < pre - 60) meals.push({ time: toTime(lunch), name: 'Lunch', focus: 'Protein + carbohydrates', share: { protein: 0.25, carbs: 0.22, fat: 0.3 }, ideas: MEAL_IDEAS.lunch })
  meals.push({
    time: toTime(pre), name: 'Pre-workout', focus: heavy ? 'Readily digestible carbs + protein, low fat/fibre' : 'Light protein + carbs',
    share: { protein: 0.15, carbs: heavy ? 0.2 : 0.15, fat: 0.05 }, ideas: MEAL_IDEAS.pre,
  })
  meals.push({ time: toTime(w), name: 'Workout', focus: heavy ? 'Lower-body session — water, optional electrolytes' : 'Upper maintenance + core', share: { protein: 0, carbs: 0, fat: 0 }, ideas: [] })
  meals.push({
    time: toTime(post), name: 'Post-workout meal', focus: 'Protein + substantial carbohydrates', share: { protein: 0.28, carbs: heavy ? 0.3 : 0.25, fat: 0.25 },
    ideas: w >= 15 * 60 ? MEAL_IDEAS.post : MEAL_IDEAS.lunch,
  })
  meals.push({ time: toTime(Math.max(post + 150, 20 * 60 + 30)), name: 'Evening', focus: 'Remaining macros — dessert fits here', share: { protein: 0.1, carbs: 0.08, fat: 0.15 }, ideas: MEAL_IDEAS.snack })
  // Normalise shares so the plan always sums to the day's targets.
  const tot = meals.reduce((a, m) => ({ protein: a.protein + m.share.protein, carbs: a.carbs + m.share.carbs, fat: a.fat + m.share.fat }), { protein: 0, carbs: 0, fat: 0 })
  return meals.map((m) => ({ ...m, share: { protein: m.share.protein / tot.protein, carbs: m.share.carbs / tot.carbs, fat: m.share.fat / tot.fat } }))
}

export function nextMeal(meals: Meal[], now: Date): Meal | undefined {
  const mins = now.getHours() * 60 + now.getMinutes()
  const parse = (t: string) => {
    const [hm, ap] = t.split(' ')
    const [h, m] = hm.split(':').map(Number)
    return ((h % 12) + (ap === 'PM' ? 12 : 0)) * 60 + m
  }
  return meals.find((m) => m.name !== 'Workout' && parse(m.time) >= mins - 30) ?? meals[meals.length - 1]
}
