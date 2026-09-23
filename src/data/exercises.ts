import type { Exercise } from '../engine/types'

// Muscle credit: 1 = primary mover for a hard set, 0.5 = meaningful secondary.
// shoulderStimulus is a hard filter: nothing "high" is ever programmed.
export const EXERCISES: Exercise[] = [
  // ---------- Shortened-position glute work ----------
  {
    id: 'hipThrust', name: 'Barbell hip thrust', pattern: 'hipExtension',
    muscles: { gluteMax: 1, upperGlute: 0.5, hamstrings: 0.25 },
    purpose: 'Glute max / projection (shortened position)',
    kneeDemand: 'low', shoulderStimulus: 'low', gluteStimulus: 'high', quadStimulus: 'low',
    increment: 10, loaded: true,
    cues: ['Ribs down, chin tucked', 'Shins vertical at the top', 'Pause 1 s at lockout — squeeze, don\'t arch'],
    kneeNotes: 'Usually very knee-friendly. If the front of the knee is irritated, move feet slightly farther out.',
  },
  {
    id: 'smithHipThrust', name: 'Smith / machine hip thrust', pattern: 'hipExtension',
    muscles: { gluteMax: 1, upperGlute: 0.5, hamstrings: 0.25 },
    purpose: 'Glute max / projection (shortened position)',
    kneeDemand: 'low', shoulderStimulus: 'low', gluteStimulus: 'high', quadStimulus: 'low',
    increment: 10, loaded: true,
    cues: ['Same setup as barbell thrust', 'Controlled 2 s lowering'],
  },
  {
    id: 'bStanceThrust', name: 'B-stance hip thrust', pattern: 'hipExtension',
    muscles: { gluteMax: 1, upperGlute: 0.5, hamstrings: 0.25 },
    purpose: 'Glute max, one side at a time — fixes side-to-side imbalance',
    kneeDemand: 'low', shoulderStimulus: 'low', gluteStimulus: 'high', quadStimulus: 'low',
    increment: 10, loaded: true,
    cues: ['~80% of the load on the working leg', 'Kickstand heel only lightly touching'],
  },
  {
    id: 'gluteBridge', name: 'Paused glute bridge (floor)', pattern: 'hipExtension',
    muscles: { gluteMax: 1, upperGlute: 0.5, hamstrings: 0.25 },
    purpose: 'Glute max, lower back-friendly shortened position',
    kneeDemand: 'low', shoulderStimulus: 'low', gluteStimulus: 'high', quadStimulus: 'low',
    increment: 10, loaded: true,
    cues: ['2 s pause at top', 'Push knees slightly out against a mini-band if desired'],
  },
  {
    id: 'cableKickback', name: 'Cable glute kickback', pattern: 'hipExtension',
    muscles: { gluteMax: 1, upperGlute: 0.5 },
    purpose: 'Glute max isolation with low spinal and knee load',
    kneeDemand: 'low', shoulderStimulus: 'low', gluteStimulus: 'high', quadStimulus: 'low',
    increment: 5, loaded: true,
    cues: ['Slight forward lean, hips square', 'Kick back and slightly out, don\'t arch the low back'],
  },

  // ---------- Lengthened glute / hinge ----------
  {
    id: 'rdl', name: 'Romanian deadlift', pattern: 'hinge',
    muscles: { gluteMax: 0.75, hamstrings: 1, adductors: 0.5 },
    purpose: 'Glutes + hamstrings in the lengthened position',
    kneeDemand: 'low', shoulderStimulus: 'low', gluteStimulus: 'high', quadStimulus: 'low',
    increment: 10, loaded: true,
    cues: ['Soft knees, push hips back', 'Bar stays close to legs', 'Stop when hips stop moving back — no rounding'],
    kneeNotes: 'Knees stay softly bent and mostly still, so knee demand is low.',
  },
  {
    id: 'dbRdl', name: 'Dumbbell Romanian deadlift', pattern: 'hinge',
    muscles: { gluteMax: 0.75, hamstrings: 1, adductors: 0.5 },
    purpose: 'Glutes + hamstrings in the lengthened position',
    kneeDemand: 'low', shoulderStimulus: 'low', gluteStimulus: 'high', quadStimulus: 'low',
    increment: 5, loaded: true,
    cues: ['Dumbbells slide down the thighs', 'Feel the stretch in the glutes/hamstrings'],
  },
  {
    id: 'backExtension', name: '45° back extension (glute-biased)', pattern: 'hinge',
    muscles: { gluteMax: 1, hamstrings: 0.5, upperGlute: 0.25 },
    purpose: 'Glute max through a long range with rounded upper back and turned-out feet',
    kneeDemand: 'low', shoulderStimulus: 'low', gluteStimulus: 'high', quadStimulus: 'low',
    increment: 5, loaded: true,
    cues: ['Pad just below the hip crease', 'Feet turned out ~30°', 'Squeeze glutes to come up; stop at a straight line'],
  },
  {
    id: 'singleLegRdl', name: 'Supported single-leg RDL', pattern: 'hinge',
    muscles: { gluteMax: 1, hamstrings: 0.5, upperGlute: 0.5 },
    purpose: 'Lengthened glute + hip stability, one leg at a time',
    kneeDemand: 'low', shoulderStimulus: 'low', gluteStimulus: 'high', quadStimulus: 'low',
    increment: 5, loaded: true,
    cues: ['Hold a rack for balance', 'Hips stay square to the floor'],
  },
  {
    id: 'pullThrough', name: 'Cable pull-through', pattern: 'hinge',
    muscles: { gluteMax: 1, hamstrings: 0.5 },
    purpose: 'Hip-extension pattern with very low knee and back load',
    kneeDemand: 'low', shoulderStimulus: 'low', gluteStimulus: 'high', quadStimulus: 'low',
    increment: 5, loaded: true,
    cues: ['Hinge, don\'t squat', 'Finish by squeezing glutes, not leaning back'],
  },

  // ---------- Unilateral (knee-gated) ----------
  {
    id: 'reverseLunge', name: 'Reverse lunge (glute bias)', pattern: 'unilateral',
    muscles: { gluteMax: 1, quads: 0.75, adductors: 0.5, upperGlute: 0.25 },
    purpose: 'Unilateral glute + thigh development; reverse stepping is usually easier on knees than forward lunges',
    kneeDemand: 'moderate', shoulderStimulus: 'low', gluteStimulus: 'high', quadStimulus: 'moderate',
    increment: 5, loaded: true,
    cues: ['Long step back', 'Slight forward torso lean', 'Drive through the front heel/midfoot'],
    kneeNotes: 'Shorten range (touch a pad with the back knee) or reduce load if knee awareness appears.',
  },
  {
    id: 'deficitReverseLunge', name: 'Deficit reverse lunge', pattern: 'unilateral',
    muscles: { gluteMax: 1, quads: 0.75, adductors: 0.5, upperGlute: 0.25 },
    purpose: 'Lengthened-position glute + thigh work (more range than a flat lunge)',
    kneeDemand: 'moderate', shoulderStimulus: 'low', gluteStimulus: 'high', quadStimulus: 'moderate',
    increment: 5, loaded: true,
    cues: ['Stand on a 2–4 in platform', 'Only use once flat reverse lunges are 0–1 knee response'],
    kneeNotes: 'More knee flexion than flat reverse lunge — progression, not a default.',
  },
  {
    id: 'supportedSplitSquat', name: 'Supported split squat (hand on rack)', pattern: 'unilateral',
    muscles: { gluteMax: 0.75, quads: 1, adductors: 0.5 },
    purpose: 'Unilateral thigh + glute; hand support lets you control depth and knee path',
    kneeDemand: 'moderate', shoulderStimulus: 'low', gluteStimulus: 'moderate', quadStimulus: 'high',
    increment: 5, loaded: true,
    cues: ['Hold the rack', 'Lean forward slightly to bias glutes', 'Only as deep as the knee is quiet'],
    kneeNotes: 'Reduce range or step the front foot farther forward if knee is irritated.',
  },
  {
    id: 'bulgarian', name: 'Bulgarian split squat', pattern: 'unilateral',
    muscles: { gluteMax: 1, quads: 1, adductors: 0.5 },
    purpose: 'High glute + quad stimulus, lengthened position',
    kneeDemand: 'high', shoulderStimulus: 'low', gluteStimulus: 'high', quadStimulus: 'moderate',
    increment: 5, loaded: true,
    cues: ['Front foot far enough forward that the shin leans slightly', 'Torso lean for glute bias'],
    kneeNotes: 'High knee demand — only used if your knee memory says you tolerate it.',
  },
  {
    id: 'stepUp', name: 'Low-box step-up', pattern: 'unilateral',
    muscles: { gluteMax: 1, quads: 0.75, upperGlute: 0.5 },
    purpose: 'Unilateral glute + thigh; box height controls knee demand',
    kneeDemand: 'moderate', shoulderStimulus: 'low', gluteStimulus: 'high', quadStimulus: 'moderate',
    increment: 5, loaded: true,
    cues: ['Box at or below mid-shin to start', 'Drive through the top leg — no pushing off the bottom foot'],
    kneeNotes: 'Lower the box before removing the movement.',
  },

  // ---------- Abduction / upper-side glutes ----------
  {
    id: 'abductionMachine', name: 'Hip abduction machine (lean forward)', pattern: 'abduction',
    muscles: { upperGlute: 1 },
    purpose: 'Upper / side glutes — the main muscular driver of hip width from the front',
    kneeDemand: 'low', shoulderStimulus: 'low', gluteStimulus: 'high', quadStimulus: 'low',
    increment: 10, loaded: true,
    cues: ['Lean the torso forward and hold the seat', 'Pause 1 s at full opening', 'Slow return'],
  },
  {
    id: 'cableAbduction', name: 'Standing cable hip abduction', pattern: 'abduction',
    muscles: { upperGlute: 1 },
    purpose: 'Upper / side glutes, one side at a time',
    kneeDemand: 'low', shoulderStimulus: 'low', gluteStimulus: 'high', quadStimulus: 'low',
    increment: 2.5, loaded: true,
    cues: ['Slight forward lean', 'Leg travels out and slightly back', 'No torso tilt'],
  },
  {
    id: 'sideLyingAbduction', name: 'Side-lying hip abduction (banded)', pattern: 'abduction',
    muscles: { upperGlute: 1 },
    purpose: 'Glute medius — home or finisher option',
    kneeDemand: 'low', shoulderStimulus: 'low', gluteStimulus: 'moderate', quadStimulus: 'low',
    increment: 0, loaded: false,
    cues: ['Top leg slightly behind the body', 'Toes angled slightly down'],
  },

  // ---------- Hamstrings ----------
  {
    id: 'seatedLegCurl', name: 'Seated leg curl', pattern: 'hamstringCurl',
    muscles: { hamstrings: 1 },
    purpose: 'Hamstrings (lengthened) — rounds out the back of the thigh',
    kneeDemand: 'low', shoulderStimulus: 'low', gluteStimulus: 'low', quadStimulus: 'low',
    increment: 5, loaded: true,
    cues: ['Lean the torso forward for more stretch', 'Control the return'],
    kneeNotes: 'Low load on the kneecap; stop if the back of the knee cramps or pinches.',
  },
  {
    id: 'lyingLegCurl', name: 'Lying leg curl', pattern: 'hamstringCurl',
    muscles: { hamstrings: 1 },
    purpose: 'Hamstrings',
    kneeDemand: 'low', shoulderStimulus: 'low', gluteStimulus: 'low', quadStimulus: 'low',
    increment: 5, loaded: true,
    cues: ['Hips pressed into the pad', 'Slow lowering'],
  },

  // ---------- Quads / thighs ----------
  {
    id: 'legPressHighWide', name: 'Leg press — high & wide feet', pattern: 'quad',
    muscles: { quads: 1, gluteMax: 0.5, adductors: 0.5 },
    purpose: 'Thigh fullness with glute/adductor involvement; adjustable knee demand',
    kneeDemand: 'moderate', shoulderStimulus: 'low', gluteStimulus: 'moderate', quadStimulus: 'high',
    increment: 10, loaded: true,
    cues: ['Feet high and a bit wider than hips', 'Depth only as far as the knee is quiet', 'Don\'t lock the knees hard'],
    kneeNotes: 'Higher foot placement = less knee travel. Shorten the range before dropping it.',
  },
  {
    id: 'hackSquat', name: 'Hack squat', pattern: 'quad',
    muscles: { quads: 1, gluteMax: 0.5, adductors: 0.5 },
    purpose: 'Quad-dominant thigh development',
    kneeDemand: 'high', shoulderStimulus: 'low', gluteStimulus: 'moderate', quadStimulus: 'high',
    increment: 10, loaded: true,
    cues: ['Controlled depth'],
    kneeNotes: 'High knee demand — only if well tolerated.',
  },
  {
    id: 'gobletBoxSquat', name: 'Goblet box squat', pattern: 'quad',
    muscles: { quads: 1, gluteMax: 0.5, adductors: 0.5 },
    purpose: 'Thigh + glute with a box to cap depth',
    kneeDemand: 'moderate', shoulderStimulus: 'low', gluteStimulus: 'moderate', quadStimulus: 'high',
    increment: 5, loaded: true,
    cues: ['Sit back to a box at a knee-comfortable height', 'Knees track over toes'],
  },
  {
    id: 'legExtension', name: 'Leg extension (partial range)', pattern: 'quad',
    muscles: { quads: 1 },
    purpose: 'Quad isolation; the range can be limited to pain-free',
    kneeDemand: 'moderate', shoulderStimulus: 'low', gluteStimulus: 'low', quadStimulus: 'high',
    increment: 5, loaded: true,
    cues: ['Use the range that feels fine', 'Slow lowering'],
    kneeNotes: 'Loads the kneecap directly. Many people tolerate the top half better or worse — log it.',
  },

  // ---------- Adductors ----------
  {
    id: 'adductionMachine', name: 'Hip adduction machine', pattern: 'adduction',
    muscles: { adductors: 1 },
    purpose: 'Inner-thigh fullness — adds visual thigh size from the front',
    kneeDemand: 'low', shoulderStimulus: 'low', gluteStimulus: 'low', quadStimulus: 'low',
    increment: 10, loaded: true,
    cues: ['Start from a comfortable stretch', 'Pause when legs meet'],
  },
  {
    id: 'copenhagenShort', name: 'Short-lever Copenhagen plank', pattern: 'adduction',
    muscles: { adductors: 1 },
    purpose: 'Adductor strength, no equipment',
    kneeDemand: 'low', shoulderStimulus: 'low', gluteStimulus: 'low', quadStimulus: 'low',
    increment: 0, loaded: false,
    cues: ['Knee (not foot) on the bench', 'Hold 15–30 s per side'],
  },

  // ---------- Upper-body maintenance (low shoulder growth stimulus) ----------
  {
    id: 'latPulldown', name: 'Lat pulldown (neutral grip)', pattern: 'upperPull',
    muscles: { back: 1, arms: 0.5 },
    purpose: 'Back strength & posture — lats pull the shoulders down, not wider-looking at your volume',
    kneeDemand: 'low', shoulderStimulus: 'low', gluteStimulus: 'low', quadStimulus: 'low',
    increment: 5, loaded: true,
    cues: ['Shoulders down away from ears', 'Pull elbows to ribs', 'No shrugging'],
  },
  {
    id: 'cableRow', name: 'Seated cable row', pattern: 'upperPull',
    muscles: { back: 1, arms: 0.5 },
    purpose: 'Mid-back / posture',
    kneeDemand: 'low', shoulderStimulus: 'low', gluteStimulus: 'low', quadStimulus: 'low',
    increment: 5, loaded: true,
    cues: ['Chest tall, shoulders down', 'Stop before the shoulders roll forward or shrug'],
  },
  {
    id: 'chestPress', name: 'Machine chest press (flat)', pattern: 'upperPush',
    muscles: { chest: 1, arms: 0.5, deltoids: 0.25 },
    purpose: 'Pushing strength with minimal front-delt emphasis',
    kneeDemand: 'low', shoulderStimulus: 'moderate', gluteStimulus: 'low', quadStimulus: 'low',
    increment: 5, loaded: true,
    cues: ['Flat, not incline', 'Shoulder blades back and down'],
  },
  {
    id: 'pushUp', name: 'Push-up (incline if needed)', pattern: 'upperPush',
    muscles: { chest: 1, arms: 0.5, deltoids: 0.25 },
    purpose: 'Pushing strength + trunk control at bodyweight',
    kneeDemand: 'low', shoulderStimulus: 'moderate', gluteStimulus: 'low', quadStimulus: 'low',
    increment: 0, loaded: false,
    cues: ['Brace like a plank', 'Elbows ~45° from the body'],
  },
  {
    id: 'tricepPushdown', name: 'Triceps rope pushdown', pattern: 'arms',
    muscles: { arms: 1 },
    purpose: 'Arm tone',
    kneeDemand: 'low', shoulderStimulus: 'low', gluteStimulus: 'low', quadStimulus: 'low',
    increment: 2.5, loaded: true,
    cues: ['Elbows pinned to sides'],
  },
  {
    id: 'bicepCurl', name: 'Dumbbell curl', pattern: 'arms',
    muscles: { arms: 1 },
    purpose: 'Arm tone',
    kneeDemand: 'low', shoulderStimulus: 'low', gluteStimulus: 'low', quadStimulus: 'low',
    increment: 2.5, loaded: true,
    cues: ['No swinging'],
  },
  {
    id: 'externalRotation', name: 'Cable/band external rotation', pattern: 'shoulderHealth',
    muscles: {},
    purpose: 'Rotator-cuff health — negligible size stimulus',
    kneeDemand: 'low', shoulderStimulus: 'low', gluteStimulus: 'low', quadStimulus: 'low',
    increment: 0, loaded: false,
    cues: ['Light load, 12–15 smooth reps', 'Elbow tucked at your side'],
  },

  // ---------- Reference only: listed so the coach can explain why they're NOT programmed ----------
  {
    id: 'lateralRaise', name: 'Lateral raise', pattern: 'upperPush',
    muscles: { deltoids: 1 },
    purpose: 'Side-delt hypertrophy — widens shoulders (conflicts with your goal)',
    kneeDemand: 'low', shoulderStimulus: 'high', gluteStimulus: 'low', quadStimulus: 'low',
    increment: 2.5, loaded: true,
    cues: ['Not programmed: grows shoulder width'],
  },
  {
    id: 'overheadPress', name: 'Overhead press', pattern: 'upperPush',
    muscles: { deltoids: 1, arms: 0.5, traps: 0.5 },
    purpose: 'Front/side delt + trap growth (conflicts with your goal)',
    kneeDemand: 'low', shoulderStimulus: 'high', gluteStimulus: 'low', quadStimulus: 'low',
    increment: 5, loaded: true,
    cues: ['Not programmed: grows shoulders and traps'],
  },
  {
    id: 'shrug', name: 'Shrug', pattern: 'upperPull',
    muscles: { traps: 1 },
    purpose: 'Upper-trap hypertrophy (conflicts with your goal)',
    kneeDemand: 'low', shoulderStimulus: 'high', gluteStimulus: 'low', quadStimulus: 'low',
    increment: 10, loaded: true,
    cues: ['Not programmed: builds traps'],
  },
]

export const EXERCISE_BY_ID: Record<string, Exercise> = Object.fromEntries(EXERCISES.map((e) => [e.id, e]))

export function getExercise(id: string): Exercise {
  const ex = EXERCISE_BY_ID[id]
  if (!ex) throw new Error(`Unknown exercise ${id}`)
  return ex
}

const KNEE_RELEVANT_PATTERNS = new Set(['unilateral', 'quad', 'hinge', 'hipExtension', 'adduction', 'hamstringCurl'])

/** Every lower-body movement that bends or loads the knee gets a 0–5 knee response after it. */
export function needsKneeCheck(ex: Exercise): boolean {
  return KNEE_RELEVANT_PATTERNS.has(ex.pattern)
}
