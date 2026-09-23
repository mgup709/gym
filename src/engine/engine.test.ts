import { describe, expect, it } from 'vitest'
import { DAY_PLANS, DEFAULT_SCHEDULE, WEEKLY_TARGETS } from '../data/program'
import { EXERCISES, getExercise } from '../data/exercises'
import { DEFAULT_STATE } from '../store'
import { computeTarget } from './progression'
import { resolveSlot, substitutes, tolerance, kneeSummary } from './knee'
import { cycleGuidance, cycleStatus, readiness } from './cycle'
import { averageTargets, dayTargets, mealPlan } from './nutrition'
import { plannedVolume, weeklyScorecard } from './scorecard'
import { proportionReport, ratioValue, RATIOS } from './proportions'
import { reviewPlan } from './adjust'
import { buildToday } from './plan'
import type { AppState, WorkoutSession } from './types'

const thrustSlot = DAY_PLANS.glutesHams.slots[0]
const hipThrust = getExercise('hipThrust')
const session = (date: string, exerciseId: string, reps: number[], weight = 135, extra: Partial<WorkoutSession['exercises'][0]> = {}, slotId = 'x'): WorkoutSession => ({
  id: date + exerciseId, date, dayType: 'glutesHams', core: [],
  exercises: [{ slotId, exerciseId, sets: reps.map((r) => ({ weight, reps: r, rir: 1 })), formOk: true, ...extra }],
})

describe('double progression', () => {
  const slot = { ...thrustSlot, repRange: [8, 10] as [number, number] }
  it('adds a rep to the first set below the top of the range', () => {
    const t = computeTarget(slot, hipThrust, [session('2026-09-01', 'hipThrust', [8, 8, 8])], '2026-09-05')
    expect(t.action).toBe('addReps')
    expect(t.weight).toBe(135)
    expect(t.reps).toEqual([9, 8, 8])
  })
  it('adds load once every set reaches the top', () => {
    const t = computeTarget(slot, hipThrust, [session('2026-09-01', 'hipThrust', [10, 10, 10])], '2026-09-05')
    expect(t.action).toBe('addLoad')
    expect(t.weight).toBe(145)
    expect(t.reps).toEqual([8, 8, 8])
  })
  it('does not progress after meaningful knee discomfort', () => {
    const t = computeTarget(slot, hipThrust, [session('2026-09-01', 'hipThrust', [10, 10, 10], 135, { knee: 3 })], '2026-09-05')
    expect(t.action).toBe('hold')
    expect(t.weight).toBe(135)
  })
  it('reduces and recommends substitution at knee 4+', () => {
    const t = computeTarget(slot, hipThrust, [session('2026-09-01', 'hipThrust', [10, 10, 10], 135, { knee: 4 })], '2026-09-05')
    expect(t.action).toBe('reduce')
    expect(t.weight).toBeLessThan(135)
  })
  it('holds when cycle symptoms or fatigue say so', () => {
    const t = computeTarget(slot, hipThrust, [session('2026-09-01', 'hipThrust', [10, 10, 10])], '2026-09-05', { holdProgression: true })
    expect(t.action).toBe('hold')
  })
  it('progresses upper body conservatively', () => {
    const up = DAY_PLANS.upperCore.slots[0]
    const ex = getExercise(up.exerciseId)
    const s: WorkoutSession = { ...session('2026-09-01', ex.id, [12, 12], 60), dayType: 'upperCore' }
    s.exercises[0].sets.forEach((x) => (x.rir = 1))
    expect(computeTarget(up, ex, [s], '2026-09-05').action).toBe('hold')
    s.exercises[0].sets.forEach((x) => (x.rir = 3))
    const t = computeTarget(up, ex, [s], '2026-09-05')
    expect(t.action).toBe('addLoad')
    expect(t.weight).toBe(60 + ex.increment / 2)
  })
})

describe('knee memory and substitution', () => {
  const uniSlot = DAY_PLANS.glutesThighs.slots.find((s) => s.slotId === 'd4-uni')!
  const bad = ['2026-09-01', '2026-09-04', '2026-09-08'].map((d) => session(d, 'bulgarian', [8, 8, 8], 30, { knee: 3 }))

  it('flags repeated knee pain as avoid', () => {
    expect(tolerance(bad, 'bulgarian')).toBe('avoid')
    expect(tolerance([], 'bulgarian')).toBe('untested')
  })
  it('stops prescribing a painful exercise and explains the substitute', () => {
    const r = resolveSlot(uniSlot, { 'd4-uni': 'bulgarian' }, bad, {})
    expect(r.exercise.id).not.toBe('bulgarian')
    expect(r.substitution?.why).toMatch(/knee/i)
    expect(r.substitution?.stillTrains).toMatch(/glute max/)
  })
  it('prefers tolerated, preferred, low-knee-demand movements with the same stimulus', () => {
    const good = ['2026-09-02', '2026-09-05'].map((d) => session(d, 'stepUp', [10, 10], 20, { knee: 0 }))
    const subs = substitutes(uniSlot, 'bulgarian', [...bad, ...good], { stepUp: 'high' })
    expect(subs[0].kneeDemand === 'low' || subs[0].id === 'stepUp').toBe(true)
    expect(subs.every((e) => e.shoulderStimulus !== 'high')).toBe(true)
  })
  it('recommends professional assessment for swelling', () => {
    const k = kneeSummary([{ date: '2026-09-10', score: 2, swelling: true, instability: false }], [], '2026-09-10')
    expect(k.seeProfessional).toBeTruthy()
    expect(k.status).toBe('mild')
  })
  it('never programs high-shoulder-stimulus exercises', () => {
    for (const d of Object.values(DAY_PLANS)) for (const s of d.slots) expect(getExercise(s.exerciseId).shoulderStimulus).not.toBe('high')
  })
})

describe('program priorities', () => {
  const slots = DEFAULT_SCHEDULE.flatMap((t) => DAY_PLANS[t].slots)
  const v = plannedVolume(slots)
  it('meets the lower-body width engine targets', () => {
    for (const [m, [lo, hi]] of Object.entries(WEEKLY_TARGETS)) {
      const x = v[m as keyof typeof v]
      expect(x, m).toBeGreaterThanOrEqual(lo)
      expect(x, m).toBeLessThanOrEqual(hi)
    }
  })
  it('keeps glutes above quads and delts near zero', () => {
    expect(v.gluteMax).toBeGreaterThan(v.quads * 2)
    expect(v.gluteMax + v.upperGlute).toBeGreaterThan(v.quads + v.adductors + v.hamstrings)
    expect(v.deltoids).toBeLessThanOrEqual(1)
    expect(v.traps).toBe(0)
    const upper = v.back + v.chest + v.arms
    expect(upper).toBeLessThan((v.gluteMax + v.upperGlute + v.quads + v.hamstrings) / 3)
  })
  it('has three deep-core sessions per week', () => {
    expect(DEFAULT_SCHEDULE.filter((t) => DAY_PLANS[t].deepCore).length).toBe(3)
  })
})

describe('cycle sync', () => {
  const cycle = { ...DEFAULT_STATE.cycle, periodStarts: ['2026-08-01', '2026-08-29'] }
  it('estimates phases from logged starts', () => {
    expect(cycleStatus(cycle, '2026-08-30').phase).toBe('menstrual')
    expect(cycleStatus(cycle, '2026-09-05').phase).toBe('follicular')
    expect(cycleStatus(cycle, '2026-09-11').phase).toBe('ovulatory')
    expect(cycleStatus(cycle, '2026-09-24').phase).toBe('lateLuteal')
    expect(cycleStatus(cycle, '2026-09-24').retentionWindow).toBe(true)
    expect(cycleStatus(cycle, '2026-09-05').measurementWindow).toBe(true)
  })
  it('uses symptoms, not the calendar, to hold progression', () => {
    const s = cycleStatus(cycle, '2026-09-24')
    expect(cycleGuidance(s, 'good').holdProgression).toBe(false)
    expect(cycleGuidance(s, readiness({ energy: 1, cramps: 2, bloating: 1, sleep: 3, mood: 3 })).holdProgression).toBe(true)
  })
  it('switches to symptom-only mode with hormonal contraception', () => {
    expect(cycleStatus({ ...cycle, hormonalContraception: true }, '2026-09-24').phase).toBe('hormonal')
  })
})

describe('nutrition', () => {
  const profile = { ...DEFAULT_STATE.profile, weightLb: 150, age: 32 }
  const avg = averageTargets(profile)!
  it('keeps protein stable and weekly calories balanced', () => {
    const days = DEFAULT_SCHEDULE.map((d) => dayTargets(avg, DEFAULT_SCHEDULE, d))
    days.forEach((d) => expect(d.protein).toBe(avg.protein))
    const weekly = days.reduce((a, d) => a + d.kcal, 0)
    expect(Math.abs(weekly - avg.kcal * 7)).toBeLessThan(80)
  })
  it('gives lower-body days the most carbs without extreme swings', () => {
    const lower = dayTargets(avg, DEFAULT_SCHEDULE, 'glutesHams')
    const rest = dayTargets(avg, DEFAULT_SCHEDULE, 'rest')
    expect(lower.carbs).toBeGreaterThan(rest.carbs)
    expect(lower.kcal / rest.kcal).toBeLessThan(1.2)
  })
  it('never goes extreme', () => {
    const cut = averageTargets({ ...profile, goalMode: 'gentleCut' })!
    expect(cut.kcal).toBeGreaterThan(1500)
    expect(cut.carbs).toBeGreaterThan(130)
  })
  it('builds meals around training time', () => {
    const meals = mealPlan('glutesHams', '17:00')
    expect(meals.map((m) => m.name)).toEqual(['Breakfast', 'Lunch', 'Pre-workout', 'Workout', 'Post-workout meal', 'Evening'])
    expect(meals[2].time).toBe('3:30 PM')
    expect(meals[4].time).toBe('6:30 PM')
  })
})

describe('proportions', () => {
  const base = DEFAULT_STATE.baseline.values
  it('computes baseline ratios', () => {
    expect(ratioValue(base, RATIOS[0])!.toFixed(2)).toBe('1.41')
    expect(ratioValue(base, RATIOS[1])!.toFixed(2)).toBe('1.32')
  })
  it('describes proportion changes relative to the goal', () => {
    const r = proportionReport(base, { ...base, upperThighCirc: 22.5, waistCirc: 28 })
    expect(r.lines.join(' ')).toMatch(/thigh circumference increased/i)
    expect(r.lines.join(' ')).not.toMatch(/attractive|score/i)
  })
})

describe('plan adjustment', () => {
  const state = (patch: Partial<AppState>): AppState => ({ ...DEFAULT_STATE, ...patch })
  it('does not cut calories or change exercises when it is working', () => {
    const s = state({ measurements: [{ date: '2026-11-01', values: { waistCirc: 27.25, hipCirc: 37.5, shoulderWidth: 15.5 } }] })
    const r = reviewPlan(s, '2026-11-02')
    expect(r.verdict).toBe('working')
    expect(r.actions.join(' ')).toMatch(/do not reduce calories/i)
  })
  it('prioritises shoulder review when shoulders grow', () => {
    const s = state({ measurements: [{ date: '2026-11-01', values: { shoulderWidth: 16 } }] })
    expect(reviewPlan(s, '2026-11-02').verdict).toBe('shoulders')
  })
  it('works through the checklist when the lower body is flat', () => {
    const s = state({ measurements: [{ date: '2026-11-15', values: { waistCirc: 28, hipCirc: 37 } }] })
    const r = reviewPlan(s, '2026-11-16')
    expect(r.verdict).toBe('lowerNotGrowing')
    expect(r.checklist[0].factor).toMatch(/progression/i)
  })
})

describe('today plan', () => {
  it('builds a full glute + thigh day', () => {
    const s = { ...DEFAULT_STATE, profile: { ...DEFAULT_STATE.profile, weightLb: 150, age: 30 } }
    const p = buildToday(s, '2026-09-24', 'glutesThighs')
    expect(p.exercises.length).toBe(6)
    expect(p.macros?.kcal).toBeGreaterThan(0)
    expect(weeklyScorecard([], [], '2026-09-24').knee).toBe('No data')
  })
  it('swaps knee-dominant work on a modify day', () => {
    const s = { ...DEFAULT_STATE, kneeCheckins: [{ date: '2026-09-24', score: 3, swelling: false, instability: false }] }
    const p = buildToday(s, '2026-09-24', 'glutesThighs')
    expect(p.exercises.every((e) => e.exercise.kneeDemand === 'low')).toBe(true)
  })
  it('library references are valid', () => {
    for (const d of Object.values(DAY_PLANS)) for (const sl of d.slots) expect(EXERCISES.some((e) => e.id === sl.exerciseId)).toBe(true)
  })
})
