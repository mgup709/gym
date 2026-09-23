import type { MeasurementEntry, MeasurementKey } from '../engine/types'

export const BASELINE_DATE = '2026-09-23'

/** Starting silhouette. Every future measurement is compared against this. */
export const BASELINE: MeasurementEntry = {
  date: BASELINE_DATE,
  values: {
    shoulderWidth: 15.5,
    bustWidth: 12,
    waistWidth: 9.75,
    lowerStomachWidth: 12,
    highHipWidth: 12.75,
    hipWidth: 13.75,
    thighWidth: 7,
    calfWidth: 4.25,
    bustCirc: 35,
    ribcageCirc: 31.5,
    waistCirc: 28,
    lowerStomachCirc: 31,
    highHipCirc: 33,
    hipCirc: 37,
    upperThighCirc: 21.75,
    midThighCirc: 19.75,
    calfCirc: 13.5,
  },
}

export const EXTRA_BASELINE = {
  upperThighsTogether: 36,
  midThighsTogether: 33,
  torsoLength: '18–19 in',
  insideLeg: 34,
  heightIn: 66,
}

/** Desired direction per measurement, used for proportion-first analysis (never scoring). */
export type Direction = 'maintain' | 'decrease' | 'increase' | 'neutral'

export const MEASUREMENT_META: Record<MeasurementKey, { label: string; group: 'width' | 'circ' | 'body'; want: Direction; priority?: boolean }> = {
  shoulderWidth: { label: 'Shoulder width (front)', group: 'width', want: 'maintain', priority: true },
  bustWidth: { label: 'Bust width (front)', group: 'width', want: 'neutral' },
  waistWidth: { label: 'Smallest waist width (front)', group: 'width', want: 'decrease', priority: true },
  lowerStomachWidth: { label: 'Lower stomach width (front)', group: 'width', want: 'decrease' },
  highHipWidth: { label: 'High-hip width (front)', group: 'width', want: 'increase', priority: true },
  hipWidth: { label: 'Widest hip/glute width (front)', group: 'width', want: 'increase', priority: true },
  thighWidth: { label: 'Upper thigh width (front, one leg)', group: 'width', want: 'increase' },
  calfWidth: { label: 'Calf width (front)', group: 'width', want: 'neutral' },
  bustCirc: { label: 'Bust', group: 'circ', want: 'neutral' },
  ribcageCirc: { label: 'Ribcage / underbust', group: 'circ', want: 'maintain' },
  waistCirc: { label: 'Smallest waist', group: 'circ', want: 'decrease', priority: true },
  lowerStomachCirc: { label: 'Belly button / lower stomach', group: 'circ', want: 'decrease' },
  highHipCirc: { label: 'High hip', group: 'circ', want: 'increase', priority: true },
  hipCirc: { label: 'Full hips / glutes', group: 'circ', want: 'increase', priority: true },
  upperThighCirc: { label: 'Upper thigh (one leg)', group: 'circ', want: 'increase', priority: true },
  midThighCirc: { label: 'Mid-thigh (one leg)', group: 'circ', want: 'increase' },
  calfCirc: { label: 'Calf', group: 'circ', want: 'neutral' },
  weight: { label: 'Body weight (lb)', group: 'body', want: 'neutral' },
}

export const PRIORITY_KEYS: MeasurementKey[] = [
  'waistWidth', 'highHipWidth', 'hipWidth', 'waistCirc', 'highHipCirc', 'hipCirc', 'upperThighCirc', 'shoulderWidth',
]
