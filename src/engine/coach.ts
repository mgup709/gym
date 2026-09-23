import type { AppState } from './types'
import { buildToday, dayTypeFor } from './plan'
import { latestValues, proportionReport, RATIOS, ratioValue } from './proportions'
import { weeklyScorecard } from './scorecard'
import { kneeMemory, kneeSessions } from './knee'
import { reviewPlan } from './adjust'
import { PHASE_LABEL } from './cycle'
import { DAY_TYPE_LABEL } from '../data/program'
import { MEASUREMENT_META } from '../data/baseline'
import { EXERCISE_BY_ID } from '../data/exercises'
import { strengthTrend } from './progression'
import { addDays } from './dates'

export const COACH_SYSTEM = `You are the personal training and nutrition coach inside a one-person body-recomposition app.

THE USER'S GOAL: a lower-body-dominant hourglass silhouette — small-looking upper body, shoulders kept as visually small as possible, narrow-looking waist, flat and controlled midsection, full/round/projected glutes, fuller hips and thighs, and strong contrast between waist and hips/thighs. (The user sometimes calls this a "Latina body"; treat that only as shorthand for these visual traits, never as an ethnic or biological body type.)

HARD CONSTRAINTS — always obey:
1. Never intentionally grow the user's shoulders. Never use shoulder-widening to create an hourglass ("build the top to balance the bottom" is the opposite of the user's strategy). When two options are otherwise equal, pick the one less likely to grow shoulders/traps. No lateral raises, overhead-press volume, shrugs, or delt specialisation.
2. Prioritise glute development (max, upper/side), then thighs/lower-body width, hamstrings, deep core, lower-body strength, upper-body maintenance, cardio.
3. Thigh growth is allowed and often desirable; judge it relative to waist and hips. Don't let quads dominate the glutes.
4. Core work is deep-core (breathing, bracing, dead bugs, bird dogs, Pallof, anti-extension/anti-rotation, controlled leg lowering). No bodybuilding ab hypertrophy or heavy side bends.
5. The user has a history of knee problems. Account for knee response (0–5 scale) whenever choosing or progressing lower-body exercises. Never program through meaningful knee pain; substitute movements that preserve the intended muscle stimulus. Don't diagnose. If pain is significant, persistent, worsening, or with swelling/instability, recommend a professional assessment.
6. Muscle training cannot change pelvic bone width — only muscular fullness around the pelvis and thighs. Never promise otherwise.
7. No extreme calorie restriction for a smaller waist. Scale weight is not the only measure of success. Fuel lower-body days with carbohydrates. Prefer flavourful, normal food (Italian, Mediterranean, Mexican-style bowls, pasta, sandwiches, sauces, desserts in moderation) over plain chicken-broccoli-rice.
8. Keep the program stable long enough to measure. Don't assume more volume is better.
9. Cycle syncing: use the menstrual-cycle data as context, not as rigid rules. Evidence for phase-based programming is weak/mixed; adjust mainly by symptoms and readiness. Luteal-phase water retention can inflate waist and scale readings — flag it when interpreting measurements.
10. Never give attractiveness scores or judgements about the user's body. Talk about proportions and direction relative to THEIR stated goal.

STYLE: straightforward, concise, practical, evidence-oriented, non-judgmental. Define fitness terms simply the first time (e.g. RIR = reps in reserve). No hype, don't glorify exhaustion. Think in proportions: e.g. "Your thigh circumference increased while your waist stayed stable, increasing lower-body-to-waist contrast." Keep answers short unless asked for detail. Use the context snapshot below — it is the user's live data. Address the user as "you".`

const r2 = (n: number) => Math.round(n * 100) / 100

/** Everything the coach needs to know, rendered as a compact text snapshot. */
export function buildContext(state: AppState, today: string): string {
  const plan = buildToday(state, today)
  const current = latestValues(state.baseline, state.measurements)
  const report = proportionReport(state.baseline.values, current)
  const card = weeklyScorecard(state.sessions, state.kneeCheckins, today)
  const memory = kneeMemory(kneeSessions(state), state.preferences).filter((m) => m.sessions > 0)
  const review = reviewPlan(state, today)
  const thrust = strengthTrend(state.sessions, ['hipThrust', 'smithHipThrust', 'bStanceThrust']).slice(-4)
  const rdl = strengthTrend(state.sessions, ['rdl', 'dbRdl']).slice(-4)
  const steps = state.steps[today]
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(today, i))

  const lines: string[] = []
  lines.push(`TODAY: ${today} — ${plan.day.title}. Objective: ${plan.day.objective}.`)
  lines.push(`Week ahead: ${weekDays.map((d) => DAY_TYPE_LABEL[dayTypeFor(state, d)]).join(' → ')}`)
  lines.push(`Profile: height 5'6"; weight ${state.profile.weightLb ?? 'not set'} lb; age ${state.profile.age ?? 'not set'}; goal mode ${state.profile.goalMode}; training time ${state.profile.trainingTime}.`)
  lines.push('\nBASELINE → CURRENT (inches):')
  for (const [k, meta] of Object.entries(MEASUREMENT_META)) {
    const b = state.baseline.values[k as keyof typeof state.baseline.values]
    const c = current[k as keyof typeof current]
    if (b === undefined && c === undefined) continue
    lines.push(`- ${meta.label}: ${b ?? '—'} → ${c ?? '—'} (goal: ${meta.want})`)
  }
  lines.push('Ratios (descriptive, not scores): ' + RATIOS.map((r) => {
    const b = ratioValue(state.baseline.values, r)
    const c = ratioValue(current, r)
    return `${r.label} ${b ? r2(b) : '—'} → ${c ? r2(c) : '—'}`
  }).join('; '))
  lines.push('Proportion analysis: ' + report.lines.join(' '))
  lines.push(`\nPLAN REVIEW: ${review.headline}`)

  lines.push('\nTODAY\'S WORKOUT:')
  for (const e of plan.exercises) {
    lines.push(`- ${e.exercise.name} [${e.slot.slotPurpose}] ${e.slot.sets}×${e.slot.repRange.join('–')}, RIR ${e.target.rir.join('–')}. Last: ${e.lastText}. Today: ${e.target.weight ?? 'choose'} lb × ${e.target.reps.join('/')} (${e.target.action}). Knee demand ${e.exercise.kneeDemand}.${e.substitution ? ` SUBSTITUTED for ${EXERCISE_BY_ID[e.substitution.originalId].name}: ${e.substitution.why}` : ''}`)
  }
  if (plan.core.length) lines.push('Deep core: ' + plan.core.map((c) => `${c.moveId} L${c.level + 1} (${c.levelName})`).join('; '))

  lines.push(`\nTHIS WEEK SCORECARD (effective sets): glute max ${r2(card.sets.gluteMax)}, upper/side glutes ${r2(card.sets.upperGlute)}, hamstrings ${r2(card.sets.hamstrings)}, quads ${r2(card.sets.quads)}, adductors ${r2(card.sets.adductors)}, delts ${card.shoulder.directSets} (${card.shoulder.status}), deep-core sessions ${card.deepCoreSessions}, knee ${card.knee}.`)
  lines.push(`Strength (est. 1RM trend): hip thrust ${thrust.map((t) => t.e1rm).join(' → ') || 'no data'}; RDL ${rdl.map((t) => t.e1rm).join(' → ') || 'no data'}.`)

  lines.push(`\nKNEE: today ${plan.knee.status} — ${plan.knee.message}${plan.knee.seeProfessional ? ' ' + plan.knee.seeProfessional : ''}`)
  if (memory.length) {
    lines.push('Knee memory: ' + memory.map((m) => `${m.exercise.name} (glute ${m.gluteStimulus}, quad ${m.quadStimulus}, avg knee ${m.avgKnee?.toFixed(1)}/5, pref ${m.preference}, ${m.tolerance})`).join('; '))
  }

  lines.push(`\nNUTRITION TODAY: ${plan.macros ? `${plan.macros.kcal} kcal, P ${plan.macros.protein} g, C ${plan.macros.carbs} g, F ${plan.macros.fat} g` : 'targets need weight + age in Settings'}.`)
  lines.push('Meal timing: ' + plan.meals.map((m) => `${m.time} ${m.name}`).join(', '))
  const eaten = (state.food[today] ?? []).reduce((a, f) => ({ kcal: a.kcal + f.kcal, p: a.p + f.protein }), { kcal: 0, p: 0 })
  lines.push(`Logged so far today: ${eaten.kcal} kcal, ${eaten.p} g protein. Steps: ${steps ?? 'not logged'} / ${state.profile.stepTarget}.`)

  if (state.cycle.enabled) {
    lines.push(`\nCYCLE: ${PHASE_LABEL[plan.cycle.phase]}${plan.cycle.cycleDay ? `, day ${plan.cycle.cycleDay} of ~${plan.cycle.cycleLength}` : ''}. ${plan.cycleGuide.training} ${plan.cycleGuide.measurement}`)
  }

  const lastCheckin = [...state.checkins].sort((a, b) => a.date.localeCompare(b.date)).pop()
  if (lastCheckin) {
    lines.push(`\nLAST WEEKLY CHECK-IN (${lastCheckin.date}): fatigue ${lastCheckin.fatigue}/5, soreness ${lastCheckin.soreness}/5, sleep ${lastCheckin.sleepHours} h, stress ${lastCheckin.stress}/5, protein days ${lastCheckin.proteinHit}/7, completion ${lastCheckin.completion}%, knee ${lastCheckin.kneeSymptoms}/5.`)
  }
  return lines.join('\n')
}

export async function askClaude(
  state: AppState,
  today: string,
  question: string,
  onText: (full: string) => void,
): Promise<string> {
  if (!state.profile.apiKey) throw new Error('No API key')
  // Loaded on demand so the SDK isn't in the main bundle.
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  // Personal, single-user app running on your own device: the key stays in this browser's storage.
  const client = new Anthropic({ apiKey: state.profile.apiKey, dangerouslyAllowBrowser: true })
  const history = state.coach.slice(-10).map((m) => ({ role: m.role, content: m.content }))

  const stream = client.beta.messages.stream({
    model: 'claude-opus-5',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium' },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: [
      { type: 'text', text: COACH_SYSTEM, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: `CONTEXT SNAPSHOT (live app data):\n${buildContext(state, today)}` },
    ],
    messages: [...history, { role: 'user', content: question }],
  })

  let text = ''
  stream.on('text', (delta) => {
    text += delta
    onText(text)
  })
  const final = await stream.finalMessage()
  if (final.stop_reason === 'refusal') {
    return 'The model declined this request. Try rephrasing, or use the offline coach.'
  }
  return final.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
}

/** Human-readable message for a failed coach request, using the SDK's typed errors. */
export async function describeCoachError(e: unknown): Promise<string> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  if (e instanceof Anthropic.AuthenticationError) return 'The API key was rejected. Check it in Settings.'
  if (e instanceof Anthropic.RateLimitError) return 'Rate limited — try again in a moment.'
  if (e instanceof Anthropic.APIConnectionError) return 'Could not reach the API (offline?).'
  if (e instanceof Anthropic.APIError) return `API error ${e.status ?? ''}: ${e.message}`
  return e instanceof Error ? e.message : String(e)
}

/** Rule-based answers for the common questions, used without an API key (or offline). */
export function offlineAnswer(state: AppState, today: string, q: string): string {
  const t = q.toLowerCase()
  const plan = buildToday(state, today)
  const current = latestValues(state.baseline, state.measurements)
  const report = proportionReport(state.baseline.values, current)
  const card = weeklyScorecard(state.sessions, state.kneeCheckins, today)
  const has = (...w: string[]) => w.some((x) => t.includes(x))

  if (has('shoulder') && has('remove', 'drop', 'skip', 'cut')) {
    return 'Yes, mostly. Your program already has no direct shoulder exercises. The only overhead-adjacent work is a flat chest press (2 sets, RIR 2–3) plus a light rotator-cuff exercise for joint health. You can drop the chest press to 1 set or swap it for push-ups, but keep the rotator-cuff work and your rows/pulldowns — they protect posture and shoulder health without adding width.'
  }
  if (has('shoulder') && has('bigger', 'grow', 'wider', 'broad')) {
    const ex = t.match(/(lateral|overhead|press|shrug|push|pulldown|row|pull-up|pullup)/)?.[0]
    const verdict = ex && ['lateral', 'overhead', 'shrug'].includes(ex)
      ? 'Yes — that one directly targets side delts or traps, which widen the upper body. It is deliberately excluded.'
      : 'At maintenance volume (1–2 sets, 2–3 reps in reserve, no progressive overload chase), rows, pulldowns, and a flat press are very unlikely to visibly widen your shoulders.'
    return `${verdict} Your current direct delt volume this week: ${card.shoulder.directSets} effective sets (${card.shoulder.status}). Shoulder width: ${state.baseline.values.shoulderWidth} in baseline → ${current.shoulderWidth} in now.`
  }
  if (has('quad') && has('glute')) {
    return 'Glute-biased versions keep quads from dominating: lean the torso forward on lunges/split squats, take a longer stride, place feet high on the leg press, and drive through the heel/midfoot. In your program, glute max gets ~2–3× the weekly sets of quads, which keeps the emphasis where you want it.'
  }
  if (has('knee', 'bulgarian', 'hurt', 'pain')) {
    const pro = plan.knee.seeProfessional ? `\n\n${plan.knee.seeProfessional}` : ''
    return `Stop or modify any movement that scores 3+ on the 0–5 knee scale. For glute + thigh work that's usually easier on knees, try: reverse lunge with a shorter range, supported split squat (hand on rack, shallower), leg press with feet high and wide, or go hip-dominant — hip thrusts, RDLs, back extensions, and abduction all keep the glute stimulus with low knee demand. Use the "Swap" button on the workout screen: it picks a replacement that keeps the same target muscles and explains why. The app also stops prescribing any exercise that repeatedly scores 3+.${pro}`
  }
  if (has('eat', 'food', 'pre-workout', 'preworkout', 'meal')) {
    const pre = plan.meals.find((m) => m.name === 'Pre-workout')
    return `Before glute day (about 60–90 min before training): easy-to-digest carbs + some protein, low in fat and fibre. Ideas: ${(pre?.ideas ?? []).slice(0, 3).join('; ')}. After: a real meal with protein and substantial carbs — e.g. pasta arrabbiata with chicken, or a burrito bowl.${plan.macros ? ` Today's targets: ${plan.macros.kcal} kcal, ${plan.macros.protein} g protein, ${plan.macros.carbs} g carbs, ${plan.macros.fat} g fat.` : ''}`
  }
  if (has('thigh')) {
    return report.lines.find((l) => l.toLowerCase().includes('thigh')) ?? `Upper thigh: ${state.baseline.values.upperThighCirc} in → ${current.upperThighCirc} in. Thigh growth is welcome in your plan when the waist stays stable. Weekly quad sets: ${card.sets.quads.toFixed(1)}, adductor sets: ${card.sets.adductors.toFixed(1)}.`
  }
  if (has('waist')) {
    const b = (state.baseline.values.hipCirc ?? 0) / (state.baseline.values.waistCirc ?? 1)
    const c = (current.hipCirc ?? 0) / (current.waistCirc ?? 1)
    return `Hip ÷ waist (circumference): ${b.toFixed(2)} at baseline → ${c.toFixed(2)} now. ${report.lines[0]}${plan.cycle.retentionWindow ? ' Note: you are in a water-retention window, so waist readings today may be temporarily higher.' : ''}`
  }
  if (has('more glute', 'add', 'sets', 'volume')) {
    return `This week so far: glute max ${card.sets.gluteMax.toFixed(1)} effective sets, upper/side glutes ${card.sets.upperGlute.toFixed(1)}. Before adding sets, check: are your hip thrust and RDL numbers going up, are sets ending 0–2 reps from failure, are you eating enough protein and carbs, and sleeping 7+ h? If all of that is solid for 6+ weeks and glutes still aren't growing, add 2–3 sets of side-glute or glute-bridge work — not a whole extra day.`
  }
  if (has('width', 'wider', 'hip')) {
    return 'For visible hip width from the front, the biggest muscular contributors are the upper/side glutes (glute medius/minimus and upper glute max) — trained by the abduction machine (leaning forward), cable abduction, and hip thrusts. Glute max adds width and projection, and fuller quads/adductors widen the upper thigh. Bone width can\'t change, but muscle around the pelvis and thighs can add noticeable fullness.'
  }
  if (has('period', 'cycle', 'luteal', 'follicular', 'menstrual')) {
    return `${plan.cycleGuide.training} ${plan.cycleGuide.nutrition} ${plan.cycleGuide.measurement}${plan.cycleGuide.knee ? ' ' + plan.cycleGuide.knee : ''}`
  }
  return 'Offline coach: I can answer questions about shoulders, knees/substitutions, pre-workout food, thighs, waist-to-hip changes, glute volume, hip width, and your cycle. Add an Anthropic API key in Settings for full answers using all your data.'
}
