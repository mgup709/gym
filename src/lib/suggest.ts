// "What should I eat next?" — ranks foods from the user's own library using time of day, training
// time, what's already eaten, and remaining targets. Nutrition shown is always the stored values.
import { fmtTime, toMin } from './dates'
import { dayRhythm, nextRhythmItem } from './mealtiming'
import { carbRange, dayTotals, mid, scaleN } from './nutrition'
import type { DayTargets, FoodEntry, FoodItem, Nutrients } from './types'

export type Phase = 'breakfast' | 'lunch' | 'pre' | 'topup' | 'post' | 'snack' | 'dinner' | 'evening'

export interface SuggestInput {
  now: string
  targets: DayTargets
  training: string | null
  dance: string | null
  wake: string
  entries: FoodEntry[] // today's
  history: FoodEntry[] // recent entries (e.g. last 30 days) for frequency
  foods: FoodItem[]
  hunger?: number | null
  fruitGoal: number
  today: string
}

export interface SuggestionItem {
  food: FoodItem
  qty: number
  n: Nutrients
  reason: string
  score: number
}

export interface SuggestResult {
  phase: Phase
  headline: string
  lines: string[]
  items: SuggestionItem[]
}

const PHASE_LABEL: Record<Phase, string> = {
  breakfast: 'breakfast',
  lunch: 'a midday meal',
  pre: 'a pre-workout snack',
  topup: 'a small top-up',
  post: 'a post-workout meal',
  snack: 'a snack',
  dinner: 'dinner',
  evening: 'an evening snack',
}

const PROTEIN_WINDOW: Record<Phase, [number, number]> = {
  breakfast: [25, 35],
  lunch: [30, 35],
  pre: [20, 30],
  topup: [0, 12],
  post: [25, 40],
  snack: [15, 30],
  dinner: [30, 40],
  evening: [10, 25],
}

export function detectPhase(i: Pick<SuggestInput, 'now' | 'training' | 'dance' | 'wake' | 'entries'>): Phase {
  const t = toMin(i.now)
  const meals = new Set(i.entries.map((e) => e.meal))
  if (i.training) {
    const T = toMin(i.training)
    const until = T - t
    if (until > 0 && until <= 75) return 'topup'
    if (until > 75 && until <= 180) return 'pre'
    const since = t - (T + 75)
    const ateSince = i.entries.some((e) => toMin(e.time) >= T)
    if (since >= -30 && since <= 150 && !ateSince) return 'post'
  }
  if (i.dance) {
    const until = toMin(i.dance) - t
    if (until > 0 && until <= 120) return 'topup'
    if (until > 120 && until <= 300) return 'pre'
  }
  const next = nextRhythmItem(dayRhythm({ wake: i.wake, training: i.training, dance: i.dance }), i.now, meals)
  if (!meals.has('breakfast') && t < 11 * 60) return 'breakfast'
  if (next?.meal === 'lunch') return 'lunch'
  if (next?.meal === 'dinner') return 'dinner'
  if (t >= 20 * 60 + 30) return 'evening'
  if (t >= 17 * 60 + 30) return meals.has('dinner') ? 'evening' : 'dinner'
  if (t >= 11 * 60 && t < 14 * 60 + 30 && !meals.has('lunch')) return 'lunch'
  return 'snack'
}

const ELIGIBLE = new Set(['breakfast', 'meal', 'snack', 'fruit', 'side', 'pasta'])

export function suggest(i: SuggestInput): SuggestResult {
  const totals = dayTotals(i.entries)
  const t = i.targets
  const proteinLeft = Math.max(0, mid(t.protein) - totals.protein)
  const kcalLeft = t.kcal.max - totals.kcal
  const carbsLeft = mid(carbRange(t)) - totals.carbs
  const phase = detectPhase(i)
  const [pLo, pHi] = PROTEIN_WINDOW[phase]
  const nowMin = toMin(i.now)

  // Frequency from the user's own history.
  const freq = new Map<string, { n: number; nearNow: number }>()
  for (const e of i.history) {
    if (!e.foodId) continue
    const f = freq.get(e.foodId) ?? { n: 0, nearNow: 0 }
    f.n++
    if (Math.abs(toMin(e.time) - nowMin) <= 120) f.nearNow++
    freq.set(e.foodId, f)
  }
  const eatenToday = new Map<string, number>()
  for (const e of i.entries) if (e.foodId) eatenToday.set(e.foodId, (eatenToday.get(e.foodId) ?? 0) + 1)

  const dayFrac = Math.min(1, Math.max(0, (nowMin - toMin(i.wake)) / (14 * 60)))
  const fiberBehind = totals.fiber < t.fiber.min * dayFrac - 3
  const fruitBehind = totals.fruit < i.fruitGoal

  const scored: SuggestionItem[] = []
  for (const food of i.foods) {
    if (food.archived || !ELIGIBLE.has(food.category)) continue
    if (food.nutrients.kcal <= 0) continue
    const qty = food.defaultQty ?? 1
    const n = scaleN(food.nutrients, qty)
    let s = 0
    const why: string[] = []

    // Protein fit for this eating occasion
    if (n.protein >= pLo && n.protein <= pHi + 5) s += 3
    else if (n.protein < pLo) s -= (pLo - n.protein) / 6
    else s -= (n.protein - pHi) / 12
    if (proteinLeft > 40) s += (n.protein / Math.max(n.kcal, 1)) * 20 // protein density matters more when far behind
    if (proteinLeft < 10 && phase !== 'topup') s += n.fiber / 4

    // Energy fit — big items are down-ranked late in the day, never framed as off-limits
    if (kcalLeft < 250) s -= n.kcal > 250 ? 3 : 0
    else if (n.kcal > kcalLeft + 150) s -= 2

    switch (phase) {
      case 'pre':
        if (n.carbs >= 30 && n.carbs <= 70) { s += 2; why.push('good pre-workout carbs') }
        if (n.fat > 15) s -= 2
        if (food.category === 'meal' || food.category === 'pasta') s -= 1
        break
      case 'topup':
        if (n.kcal <= 160 && n.carbs >= 10) { s += 3; why.push('light and carb-focused') }
        if (n.kcal > 300) s -= 4
        if (n.fat > 8) s -= 2
        break
      case 'post':
        if (n.carbs >= 40) { s += 2; why.push('protein + carbs to recover') }
        if (food.category === 'meal' || food.category === 'pasta') s += 1.5
        break
      case 'breakfast':
        if (food.category === 'breakfast') { s += 3; why.push('one of your usual breakfasts') }
        if (food.category === 'meal' || food.category === 'pasta') s -= 2
        break
      case 'lunch':
      case 'dinner':
        if (food.category === 'meal' || food.category === 'pasta') s += 2.5
        if (food.category === 'fruit' || food.category === 'side') s -= 2
        break
      case 'snack':
      case 'evening':
        if (food.category === 'snack') s += 2
        if (food.category === 'meal' || food.category === 'pasta') s -= 1.5
        if (i.hunger != null && i.hunger >= 4) s += (n.protein + n.fiber) / 20
        break
    }

    if (carbsLeft < 20 && n.carbs > 50 && phase !== 'post' && phase !== 'pre') s -= 1
    if (fruitBehind && (food.servings?.fruit ?? 0) > 0) { s += 1; why.push('adds fruit') }
    if (fiberBehind && n.fiber >= 4) { s += 1; why.push('adds fiber') }

    const seen = eatenToday.get(food.id) ?? 0
    s -= seen * 2.5
    const fq = freq.get(food.id)
    if (fq) {
      s += Math.min(2, fq.n / 5)
      if (fq.nearNow >= 2) { s += 1; why.push('you often have this around now') }
    } else if (!food.quickLog && !food.favorite) {
      s -= 1 // saved template you haven't eaten yet — suggested only when it fits well
    }

    const macro = `${Math.round(n.protein)} g protein · ${Math.round(n.carbs)} g carbs · ${Math.round(n.kcal)} kcal`
    scored.push({ food, qty, n, score: s, reason: [macro, ...why.slice(0, 2)].join(' — ') })
  }

  scored.sort((a, b) => b.score - a.score)
  const picked: SuggestionItem[] = []
  const catCount = new Map<string, number>()
  for (const s of scored) {
    if (picked.length >= 4) break
    const c = catCount.get(s.food.category) ?? 0
    if (c >= 2) continue
    // Keep variety: skip near-duplicates (e.g. two flavours of the same product)
    if (picked.some((p) => p.food.name.split(' — ')[0] === s.food.name.split(' — ')[0] && p.food.name.includes('—'))) continue
    picked.push(s)
    catCount.set(s.food.category, c + 1)
  }
  const items = picked.filter((p, idx) => idx < 2 || p.score > picked[0].score - 4)

  const lines: string[] = []
  let headline = `It is ${fmtTime(i.now)}`
  if (i.training && (phase === 'pre' || phase === 'topup')) headline += ` and you train at ${fmtTime(i.training)}.`
  else if (i.dance && (phase === 'pre' || phase === 'topup')) headline += ` and you dance at ${fmtTime(i.dance)}.`
  else if (phase === 'post') headline += ' — you trained recently.'
  else headline += '.'
  headline += ` Good time for ${PHASE_LABEL[phase]}.`

  if (proteinLeft >= 50) lines.push(`You still need substantial protein today (about ${Math.round(proteinLeft)} g).`)
  else if (proteinLeft >= 15) lines.push(`About ${Math.round(proteinLeft)} g protein to go today.`)
  else lines.push('Protein is on track today.')
  if (kcalLeft < 250 && (phase === 'evening' || phase === 'snack') && (i.hunger ?? 0) >= 3)
    lines.push("If you're genuinely hungry, a protein-forward snack is a good choice — no need to go to bed hungry.")
  if (fiberBehind) lines.push(`Fiber is at ${Math.round(totals.fiber)} g so far — fruit, edamame or beans help.`)

  return { phase, headline, lines, items }
}
