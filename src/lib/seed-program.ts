import type { Exercise, PlannedExercise, WorkoutTemplate } from './types'

type Ex = Omit<Exercise, 'alternatives' | 'increment'> & { alternatives?: string[]; increment?: number }
const ex = (e: Ex): Exercise => ({ increment: 5, alternatives: [], ...e })

export const SEED_EXERCISES: Exercise[] = [
  // Lower body — every one has the Pain / Discomfort option
  ex({ id: 'hip-thrust', name: 'Hip thrust', kind: 'weighted', cls: 'compound', knee: true, increment: 10, baseline: { weight: 130, reps: 9, sets: 1 }, alternatives: ['machine-hip-thrust', 'glute-bridge', 'b-stance-hip-thrust'], cues: 'Chin tucked, ribs down, full lockout with a 1-second squeeze.' }),
  ex({ id: 'machine-hip-thrust', name: 'Machine hip thrust', kind: 'weighted', cls: 'compound', knee: true, increment: 10, alternatives: ['hip-thrust', 'glute-bridge'] }),
  ex({ id: 'glute-bridge', name: 'Barbell glute bridge', kind: 'weighted', cls: 'compound', knee: true, increment: 10, alternatives: ['hip-thrust', 'machine-hip-thrust', 'b-stance-hip-thrust'] }),
  ex({ id: 'b-stance-hip-thrust', name: 'B-stance hip thrust', kind: 'weighted', cls: 'unilateral', knee: true, perLeg: true, increment: 5, alternatives: ['hip-thrust', 'sl-glute-bridge'] }),
  ex({ id: 'rdl', name: 'Romanian deadlift', kind: 'weighted', cls: 'compound', knee: true, increment: 5, baseline: { weight: 74, reps: 9, sets: 1 }, alternatives: ['db-rdl', 'cable-pull-through', 'back-ext-45'], cues: 'Soft knees, hips back, stop when the hamstrings are long — not when the plates touch.' }),
  ex({ id: 'db-rdl', name: 'Dumbbell RDL', kind: 'weighted', cls: 'compound', knee: true, increment: 5, alternatives: ['rdl', 'cable-pull-through'] }),
  ex({ id: 'cable-pull-through', name: 'Cable pull-through', kind: 'weighted', cls: 'compound', knee: true, increment: 5, alternatives: ['rdl', 'back-ext-45'] }),
  ex({ id: 'bss', name: 'Glute-biased Bulgarian split squat', kind: 'weighted', cls: 'unilateral', knee: true, perLeg: true, increment: 5, alternatives: ['reverse-lunge', 'step-up', 'sl-leg-press', 'b-stance-hip-thrust'], cues: 'Longer stance, slight forward lean, drive through the front heel.' }),
  ex({ id: 'reverse-lunge', name: 'Reverse lunge', kind: 'weighted', cls: 'unilateral', knee: true, perLeg: true, increment: 5, alternatives: ['step-up', 'bss', 'sl-leg-press'] }),
  ex({ id: 'step-up', name: 'Step-up', kind: 'weighted', cls: 'unilateral', knee: true, perLeg: true, increment: 5, alternatives: ['reverse-lunge', 'sl-leg-press', 'b-stance-hip-thrust'], cues: 'Box around knee height or lower; control the way down.' }),
  ex({ id: 'sl-leg-press', name: 'Single-leg leg press', kind: 'weighted', cls: 'unilateral', knee: true, perLeg: true, increment: 10, alternatives: ['reverse-lunge', 'step-up'] }),
  ex({ id: 'leg-press', name: 'Leg press (high, wide feet)', kind: 'weighted', cls: 'compound', knee: true, increment: 10, alternatives: ['hack-squat', 'goblet-box-squat', 'belt-squat'], cues: 'Feet high and a little wide to reduce knee travel; stop short of pain.' }),
  ex({ id: 'hack-squat', name: 'Hack squat', kind: 'weighted', cls: 'compound', knee: true, increment: 10, alternatives: ['leg-press', 'belt-squat', 'goblet-box-squat'] }),
  ex({ id: 'goblet-box-squat', name: 'Goblet box squat', kind: 'weighted', cls: 'compound', knee: true, increment: 5, alternatives: ['leg-press', 'belt-squat'] }),
  ex({ id: 'belt-squat', name: 'Belt squat', kind: 'weighted', cls: 'compound', knee: true, increment: 10, alternatives: ['leg-press', 'goblet-box-squat'] }),
  ex({ id: 'leg-extension', name: 'Leg extension', kind: 'weighted', cls: 'isolation', knee: true, increment: 5, alternatives: ['spanish-squat', 'leg-press'], cues: 'Only if your knees tolerate it. Partial range is fine.' }),
  ex({ id: 'spanish-squat', name: 'Spanish squat (band)', kind: 'bodyweight', cls: 'isolation', knee: true, increment: 0, alternatives: ['leg-extension'] }),
  ex({ id: 'ham-curl', name: 'Hamstring curl', kind: 'weighted', cls: 'isolation', knee: true, increment: 5, alternatives: ['seated-ham-curl', 'ball-ham-curl'] }),
  ex({ id: 'seated-ham-curl', name: 'Seated hamstring curl', kind: 'weighted', cls: 'isolation', knee: true, increment: 5, alternatives: ['ham-curl', 'ball-ham-curl'] }),
  ex({ id: 'ball-ham-curl', name: 'Stability-ball hamstring curl', kind: 'bodyweight', cls: 'isolation', knee: true, increment: 0, alternatives: ['ham-curl', 'rdl'] }),
  ex({ id: 'abduction', name: 'Hip abduction', kind: 'weighted', cls: 'isolation', knee: true, increment: 5, baseline: { weight: 85, reps: 10, sets: 3 }, alternatives: ['cable-abduction', 'banded-abduction'], cues: 'Lean forward slightly to bias upper glutes.' }),
  ex({ id: 'cable-abduction', name: 'Cable hip abduction', kind: 'weighted', cls: 'isolation', knee: true, perLeg: true, increment: 2.5, alternatives: ['abduction', 'banded-abduction'] }),
  ex({ id: 'banded-abduction', name: 'Banded seated abduction', kind: 'bodyweight', cls: 'isolation', knee: true, increment: 0, alternatives: ['abduction'] }),
  ex({ id: 'cable-kickback', name: 'Cable kickback', kind: 'weighted', cls: 'isolation', knee: true, perLeg: true, increment: 2.5, alternatives: ['machine-kickback', 'sl-glute-bridge'] }),
  ex({ id: 'machine-kickback', name: 'Machine glute kickback', kind: 'weighted', cls: 'isolation', knee: true, perLeg: true, increment: 5, alternatives: ['cable-kickback'] }),
  ex({ id: 'back-ext-45', name: '45° glute-biased back extension', kind: 'weighted', cls: 'isolation', knee: true, increment: 5, alternatives: ['sl-glute-bridge', 'cable-pull-through'], cues: 'Rounded upper back, toes out, squeeze glutes to come up.' }),
  ex({ id: 'sl-glute-bridge', name: 'Single-leg glute bridge', kind: 'bodyweight', cls: 'unilateral', knee: true, perLeg: true, increment: 0, alternatives: ['back-ext-45', 'b-stance-hip-thrust'] }),
  ex({ id: 'glute-pump', name: 'Glute pump (frog pumps / banded bridges)', kind: 'bodyweight', cls: 'isolation', knee: true, increment: 0, alternatives: ['banded-abduction'] }),

  // Upper body — maintenance / definition, no lateral-delt specialization
  ex({ id: 'lat-pulldown', name: 'Lat pulldown', kind: 'weighted', cls: 'compound', knee: false, increment: 5, alternatives: ['single-arm-pulldown', 'assisted-pullup'] }),
  ex({ id: 'single-arm-pulldown', name: 'Single-arm cable pulldown', kind: 'weighted', cls: 'compound', knee: false, increment: 2.5, alternatives: ['lat-pulldown'] }),
  ex({ id: 'assisted-pullup', name: 'Assisted pull-up', kind: 'weighted', cls: 'compound', knee: false, increment: 5, alternatives: ['lat-pulldown'] }),
  ex({ id: 'cs-row', name: 'Chest-supported row', kind: 'weighted', cls: 'compound', knee: false, increment: 5, alternatives: ['seated-cable-row', 'db-row'] }),
  ex({ id: 'seated-cable-row', name: 'Seated cable row', kind: 'weighted', cls: 'compound', knee: false, increment: 5, alternatives: ['cs-row', 'db-row'] }),
  ex({ id: 'db-row', name: 'One-arm dumbbell row', kind: 'weighted', cls: 'compound', knee: false, increment: 5, alternatives: ['cs-row'] }),
  ex({ id: 'face-pull', name: 'Face pull', kind: 'weighted', cls: 'isolation', knee: false, increment: 2.5, baseline: { weight: 20, reps: 12, sets: 3 }, alternatives: ['reverse-fly'] }),
  ex({ id: 'reverse-fly', name: 'Reverse fly', kind: 'weighted', cls: 'isolation', knee: false, increment: 2.5, alternatives: ['face-pull'] }),
  ex({ id: 'chest-press', name: 'Chest press', kind: 'weighted', cls: 'compound', knee: false, increment: 5, alternatives: ['db-bench', 'push-up'] }),
  ex({ id: 'db-bench', name: 'Dumbbell bench press', kind: 'weighted', cls: 'compound', knee: false, increment: 5, alternatives: ['chest-press', 'push-up'] }),
  ex({ id: 'push-up', name: 'Push-up', kind: 'bodyweight', cls: 'compound', knee: false, increment: 0, alternatives: ['chest-press'] }),
  ex({ id: 'bicep-curl', name: 'Bicep curl', kind: 'weighted', cls: 'isolation', knee: false, increment: 2.5, baseline: { weight: 10, reps: 12, sets: 3 }, alternatives: ['cable-curl', 'hammer-curl'] }),
  ex({ id: 'cable-curl', name: 'Cable curl', kind: 'weighted', cls: 'isolation', knee: false, increment: 2.5, alternatives: ['bicep-curl'] }),
  ex({ id: 'hammer-curl', name: 'Hammer curl', kind: 'weighted', cls: 'isolation', knee: false, increment: 2.5, alternatives: ['bicep-curl'] }),
  ex({ id: 'tricep-pressdown', name: 'Tricep pressdown', kind: 'weighted', cls: 'isolation', knee: false, increment: 2.5, alternatives: ['overhead-tricep'] }),
  ex({ id: 'overhead-tricep', name: 'Overhead cable tricep extension', kind: 'weighted', cls: 'isolation', knee: false, increment: 2.5, alternatives: ['tricep-pressdown'] }),

  // Core + recovery
  ex({ id: 'cable-crunch', name: 'Cable crunch', kind: 'weighted', cls: 'core', knee: false, increment: 5, alternatives: ['reverse-crunch'] }),
  ex({ id: 'reverse-crunch', name: 'Reverse crunch', kind: 'bodyweight', cls: 'core', knee: false, increment: 0, alternatives: ['dead-bug'] }),
  ex({ id: 'pallof', name: 'Pallof press', kind: 'weighted', cls: 'core', knee: false, increment: 2.5, alternatives: ['dead-bug'] }),
  ex({ id: 'dead-bug', name: 'Dead bug', kind: 'bodyweight', cls: 'core', knee: false, increment: 0, alternatives: ['pallof'] }),
  ex({ id: 'easy-cardio', name: 'Easy cardio (incline walk, elliptical or walk)', kind: 'cardio', cls: 'cardio', knee: false, increment: 0, alternatives: [], cues: 'Conversational pace. This is for health and recovery, not to offset food.' }),
]

const p = (
  exerciseId: string,
  sets: number,
  reps: [number, number],
  rir: [number, number],
  rest: [number, number],
  extra: Partial<PlannedExercise> = {},
): PlannedExercise => ({
  exerciseId,
  sets,
  repMin: reps[0],
  repMax: reps[1],
  rirMin: rir[0],
  rirMax: rir[1],
  restMin: rest[0],
  restMax: rest[1],
  ...extra,
})

const HEAVY: [number, number] = [120, 180]
const UNI: [number, number] = [90, 120]
const ISO: [number, number] = [60, 90]

export const SEED_TEMPLATES: WorkoutTemplate[] = [
  {
    id: 'lowerA',
    name: 'Lower A — heavy glute + hamstring',
    dayType: 'lowerA',
    goal: 'Glute projection + hamstrings',
    exercises: [
      p('hip-thrust', 4, [6, 10], [1, 2], HEAVY),
      p('rdl', 3, [6, 10], [2, 2], HEAVY),
      p('bss', 3, [8, 12], [1, 2], [120, 120]),
      p('abduction', 3, [12, 20], [0, 2], ISO),
      p('ham-curl', 2, [10, 15], [1, 2], ISO),
    ],
  },
  {
    id: 'upper',
    name: 'Upper — maintenance / definition',
    dayType: 'upper',
    goal: 'Definition, posture and balanced back/arm development — not maximal shoulder width',
    exercises: [
      p('lat-pulldown', 3, [8, 12], [1, 3], UNI),
      p('cs-row', 3, [8, 12], [1, 3], UNI),
      p('face-pull', 3, [12, 20], [0, 2], ISO, { note: '2–3 sets' }),
      p('chest-press', 2, [8, 12], [1, 3], UNI),
      p('bicep-curl', 2, [10, 15], [0, 2], ISO),
      p('tricep-pressdown', 2, [10, 15], [0, 2], ISO),
    ],
  },
  {
    id: 'core',
    name: 'Core + recovery',
    dayType: 'core',
    goal: 'Ab development and an easy recovery day',
    exercises: [
      p('cable-crunch', 3, [10, 15], [1, 2], ISO),
      p('reverse-crunch', 3, [10, 15], [1, 2], ISO),
      p('pallof', 3, [10, 12], [1, 2], ISO, { note: 'Or dead bug. Reps per side.' }),
      p('easy-cardio', 1, [20, 30], [3, 5], [0, 0], { optional: true, note: 'Optional, 20–30 min, conversational pace.' }),
    ],
  },
  {
    id: 'lowerB',
    name: 'Lower B — glutes + quads',
    dayType: 'lowerB',
    goal: 'Glutes + quads for the hip/lower-body silhouette',
    exercises: [
      p('leg-press', 3, [8, 12], [1, 3], HEAVY, { note: 'Knee-friendly: leg press, hack squat or a squat variation.' }),
      p('reverse-lunge', 3, [8, 12], [1, 2], [120, 120], { note: 'Or step-up.' }),
      p('glute-bridge', 3, [8, 12], [1, 2], UNI),
      p('leg-extension', 2, [10, 15], [1, 2], ISO, { note: 'Only if your knees tolerate it.', optional: true }),
      p('ham-curl', 2, [10, 15], [1, 2], ISO),
      p('abduction', 3, [15, 25], [0, 2], ISO, { note: '2–3 sets' }),
    ],
  },
  {
    id: 'glute',
    name: 'Glute specialization (short)',
    dayType: 'glute',
    goal: 'Short glute session — salsa/bachata later',
    finisher: 'Salsa / bachata later (about 2 h). Keep this session short and leave some energy for dancing.',
    exercises: [
      p('cable-kickback', 3, [10, 15], [0, 2], ISO),
      p('back-ext-45', 3, [10, 15], [1, 2], ISO, { note: 'Or single-leg glute bridge.' }),
      p('abduction', 3, [15, 25], [0, 2], ISO),
      p('glute-pump', 2, [15, 30], [1, 3], [60, 60], { optional: true, note: 'Optional, 1–2 sets.' }),
    ],
  },
]

/** index 0 = Sunday */
export const DEFAULT_SCHEDULE = ['rest', 'lowerA', 'upper', 'core', 'lowerB', 'glute', 'rest']
export const DEFAULT_TRAINING_TIMES: (string | null)[] = [null, '16:00', '16:00', '16:00', '16:00', '16:00', null]
