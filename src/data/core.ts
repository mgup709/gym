export interface CoreLevel {
  name: string
  prescription: string
  cue: string
}

export interface CoreMove {
  id: string
  name: string
  purpose: string
  levels: CoreLevel[]
}

/** Deep-core ladders. Control and breathing gate progression — reps alone never do. */
export const CORE_MOVES: CoreMove[] = [
  {
    id: 'breathing',
    name: '360° breathing',
    purpose: 'Diaphragm + transverse abdominis coordination — the base of bracing',
    levels: [
      { name: '90/90 breathing on back (feet on wall)', prescription: '5 slow breaths × 2', cue: 'Inhale into the sides and back of the ribs; exhale fully, feel the low belly draw in gently' },
      { name: 'Crocodile breathing (face down)', prescription: '6 breaths × 2', cue: 'Feel the low back rise on the inhale' },
      { name: 'Half-kneeling 360° breathing', prescription: '6 breaths × 2', cue: 'Ribs stay stacked over pelvis' },
      { name: 'Brace-and-breathe (hold 30% brace, keep breathing)', prescription: '3 × 20 s', cue: 'Breathe behind the brace — no breath-holding' },
    ],
  },
  {
    id: 'deadBug',
    name: 'Dead bug',
    purpose: 'Anti-extension: keep the ribs and pelvis stacked while limbs move',
    levels: [
      { name: 'Level 1 — legs supported (feet on bench/wall)', prescription: '2 × 6/side', cue: 'Low back gently on the floor; exhale as the arm moves' },
      { name: 'Level 2 — alternating heel taps', prescription: '2 × 8/side', cue: 'Tap heel to floor slowly; no back arch' },
      { name: 'Level 3 — full dead bug (opposite arm/leg)', prescription: '3 × 6/side', cue: 'Leg extends only as far as the back stays down' },
      { name: 'Level 4 — band or resistance dead bug', prescription: '3 × 8/side', cue: 'Press into a band anchored overhead' },
    ],
  },
  {
    id: 'birdDog',
    name: 'Bird dog',
    purpose: 'Spine and pelvic control with hip/shoulder movement',
    levels: [
      { name: 'Level 1 — leg only', prescription: '2 × 6/side', cue: 'Pelvis level — imagine a cup of water on your low back' },
      { name: 'Level 2 — opposite arm & leg', prescription: '2 × 8/side', cue: 'Reach long, not high' },
      { name: 'Level 3 — 3 s pause at full reach', prescription: '3 × 6/side', cue: 'Breathe during the pause' },
      { name: 'Level 4 — knees hovering 1 in', prescription: '3 × 5/side', cue: 'Keep the hover without shifting hips' },
    ],
  },
  {
    id: 'pallof',
    name: 'Pallof press',
    purpose: 'Anti-rotation: trunk resists twisting',
    levels: [
      { name: 'Level 1 — half-kneeling', prescription: '2 × 8/side', cue: 'Press straight out, hips square' },
      { name: 'Level 2 — tall kneeling', prescription: '2 × 10/side', cue: 'Glutes lightly on, ribs down' },
      { name: 'Level 3 — standing with 3 s hold', prescription: '3 × 8/side', cue: 'No rotation at all' },
      { name: 'Level 4 — split stance with overhead reach', prescription: '3 × 6/side', cue: 'Reach up without arching' },
    ],
  },
  {
    id: 'legLower',
    name: 'Controlled leg lowering',
    purpose: 'Lower-abdominal control and pelvic position',
    levels: [
      { name: 'Level 1 — bent-knee heel slides', prescription: '2 × 8/side', cue: 'Slide heel away as far as the back stays quiet' },
      { name: 'Level 2 — single bent-leg lower', prescription: '2 × 8/side', cue: 'Lower slowly, exhale' },
      { name: 'Level 3 — single straight-leg lower', prescription: '3 × 6/side', cue: 'Other leg stays up at 90°' },
      { name: 'Level 4 — double bent-leg lower', prescription: '3 × 6', cue: 'Stop the range before the back arches' },
    ],
  },
  {
    id: 'plank',
    name: 'Plank progression',
    purpose: 'Anti-extension endurance',
    levels: [
      { name: 'Level 1 — incline / knee plank', prescription: '3 × 20 s', cue: 'Ribs down, glutes gently on' },
      { name: 'Level 2 — forearm plank', prescription: '3 × 20–30 s', cue: 'Breathe steadily' },
      { name: 'Level 3 — RKC plank (max tension, short)', prescription: '3 × 10–15 s', cue: 'Pull elbows toward toes' },
      { name: 'Level 4 — plank with alternating leg lift', prescription: '3 × 6/side', cue: 'Hips don\'t rotate' },
    ],
  },
]

/** Default rotation: three moves per core session. */
export const CORE_SESSION: string[][] = [
  ['breathing', 'deadBug', 'pallof'],
  ['breathing', 'birdDog', 'legLower'],
  ['breathing', 'deadBug', 'plank'],
]

export const CORE_BY_ID: Record<string, CoreMove> = Object.fromEntries(CORE_MOVES.map((m) => [m.id, m]))
