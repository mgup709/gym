import type { DayPlan, DayType, Slot } from '../engine/types'

const s = (
  slotId: string,
  exerciseId: string,
  sets: number,
  repRange: [number, number],
  rir: [number, number],
  restSec: [number, number],
  slotPurpose: string,
  target: Slot['target'],
): Slot => ({ slotId, exerciseId, sets, repRange, rir, restSec, slotPurpose, target })

/**
 * Default week. Priority order is expressed through weekly volume:
 * glutes > thighs/lower-body width > hamstrings > deep core > lower strength > upper maintenance.
 */
export const DAY_PLANS: Record<DayType, DayPlan> = {
  glutesHams: {
    type: 'glutesHams',
    title: 'Glutes + Hamstrings',
    objective: 'Glute projection — heavy hip extension plus lengthened hinge work',
    isLowerBody: true, isTraining: true, deepCore: false,
    slots: [
      s('d1-thrust', 'hipThrust', 3, [6, 8], [1, 2], [150, 180], 'Heavy shortened-position glute max (projection)', ['gluteMax']),
      s('d1-hinge', 'rdl', 3, [8, 10], [1, 3], [150, 180], 'Lengthened glute + hamstring', ['gluteMax', 'hamstrings']),
      s('d1-backext', 'backExtension', 2, [10, 15], [1, 2], [90, 120], 'Glute max through a long range', ['gluteMax']),
      s('d1-curl', 'seatedLegCurl', 3, [10, 12], [1, 2], [90, 120], 'Hamstrings (back-of-thigh fullness)', ['hamstrings']),
      s('d1-abd', 'cableAbduction', 3, [12, 15], [0, 2], [60, 90], 'Upper/side glutes — lower-body width', ['upperGlute']),
    ],
  },
  upperCore: {
    type: 'upperCore',
    title: 'Upper-Body Maintenance + Deep Core',
    objective: 'Keep strength, posture and tone — no shoulder hypertrophy focus',
    isLowerBody: false, isTraining: true, deepCore: true,
    slots: [
      s('d2-pull', 'latPulldown', 2, [10, 12], [2, 3], [90, 120], 'Back strength & posture', 'upper'),
      s('d2-row', 'cableRow', 2, [10, 12], [2, 3], [90, 120], 'Mid-back / posture', 'upper'),
      s('d2-push', 'chestPress', 2, [10, 12], [2, 3], [90, 120], 'Maintain pushing strength (flat, not overhead)', 'upper'),
      s('d2-tri', 'tricepPushdown', 2, [12, 15], [2, 3], [60, 90], 'Arm tone', 'upper'),
      s('d2-bi', 'bicepCurl', 1, [12, 15], [2, 3], [60, 90], 'Arm tone', 'upper'),
      s('d2-cuff', 'externalRotation', 1, [12, 15], [3, 4], [45, 60], 'Shoulder joint health (no size stimulus)', 'upper'),
    ],
  },
  recovery: {
    type: 'recovery',
    title: 'Recovery / Walking',
    objective: 'Steps, mobility, and a short deep-core session',
    isLowerBody: false, isTraining: false, deepCore: true, slots: [],
  },
  glutesThighs: {
    type: 'glutesThighs',
    title: 'Glutes + Thighs',
    objective: 'Lower-body width + glute development',
    isLowerBody: true, isTraining: true, deepCore: false,
    slots: [
      s('d4-thrust', 'bStanceThrust', 3, [8, 10], [1, 2], [120, 150], 'Glute max, each side', ['gluteMax']),
      s('d4-hinge', 'dbRdl', 2, [10, 12], [1, 2], [120, 150], 'Lengthened glute + hamstring', ['gluteMax', 'hamstrings']),
      s('d4-uni', 'reverseLunge', 3, [8, 10], [1, 3], [90, 120], 'Knee-tolerant unilateral glute + thigh', ['gluteMax', 'quads']),
      s('d4-thigh', 'legPressHighWide', 3, [10, 12], [1, 2], [120, 150], 'Thigh fullness (quads + adductors)', ['quads', 'adductors']),
      s('d4-add', 'adductionMachine', 2, [12, 15], [1, 2], [60, 90], 'Inner-thigh fullness', ['adductors']),
      s('d4-abd', 'abductionMachine', 3, [15, 20], [0, 2], [60, 90], 'Upper/side glutes — lower-body width', ['upperGlute']),
    ],
  },
  lowerAccessory: {
    type: 'lowerAccessory',
    title: 'Glute Emphasis + Deep Core',
    objective: 'Extra glute & side-glute volume with low knee load',
    isLowerBody: true, isTraining: true, deepCore: true,
    slots: [
      s('d5-bridge', 'gluteBridge', 2, [12, 15], [1, 2], [90, 120], 'Glute max, high-rep shortened position', ['gluteMax']),
      s('d5-slrdl', 'singleLegRdl', 2, [10, 12], [1, 2], [90, 120], 'Lengthened glute + hip stability', ['gluteMax', 'hamstrings']),
      s('d5-step', 'stepUp', 2, [10, 12], [2, 3], [90, 120], 'Unilateral glute + thigh (box height controls knee load)', ['gluteMax', 'quads']),
      s('d5-kick', 'cableKickback', 2, [12, 15], [0, 2], [60, 90], 'Glute max isolation', ['gluteMax']),
      s('d5-curl', 'lyingLegCurl', 2, [10, 12], [1, 2], [60, 90], 'Hamstrings', ['hamstrings']),
      s('d5-abd', 'cableAbduction', 3, [12, 15], [0, 2], [60, 90], 'Upper/side glutes — lower-body width', ['upperGlute']),
    ],
  },
  optional: {
    type: 'optional',
    title: 'Optional: Walk / Light Conditioning',
    objective: 'Walking, easy conditioning or a short upper-body maintenance circuit if you feel good',
    isLowerBody: false, isTraining: false, deepCore: false, slots: [],
  },
  rest: {
    type: 'rest',
    title: 'Rest',
    objective: 'Full rest. Recovery is when growth happens.',
    isLowerBody: false, isTraining: false, deepCore: false, slots: [],
  },
}

// Sunday → Saturday. Mon: glutes/hams, Tue: upper+core, Wed: recovery, Thu: glutes/thighs, Fri: accessory, Sat: optional, Sun: rest.
export const DEFAULT_SCHEDULE: DayType[] = ['rest', 'glutesHams', 'upperCore', 'recovery', 'glutesThighs', 'lowerAccessory', 'optional']

/** Effective weekly set targets for the Lower-Body Width Engine & scorecard. */
export const WEEKLY_TARGETS = {
  gluteMax: [16, 26],
  upperGlute: [10, 18],
  hamstrings: [8, 14],
  quads: [6, 10],
  adductors: [4, 8],
} as const

export const DAY_TYPE_LABEL: Record<DayType, string> = Object.fromEntries(
  Object.values(DAY_PLANS).map((d) => [d.type, d.title]),
) as Record<DayType, string>
