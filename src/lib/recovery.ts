// Recovery trend detection. Rising hunger / food preoccupation / binge urges, or falling energy /
// performance, are signs intake or recovery may be too aggressive — never evidence the diet "works".
import { addDays } from './dates'
import type { BingeLevel, ISODate, Recovery } from './types'
import { mean } from './utils'

export type RecKey = 'hunger' | 'energy' | 'performance' | 'soreness' | 'stress' | 'sleep' | 'preoccupation'

export const REC_LABEL: Record<RecKey, string> = {
  hunger: 'Hunger',
  energy: 'Energy',
  performance: 'Gym performance',
  soreness: 'Soreness',
  stress: 'Stress',
  sleep: 'Sleep quality',
  preoccupation: 'Food preoccupation',
}

/** For these, higher is harder (1 = low, 5 = high). */
export const HIGHER_IS_HARDER: Record<RecKey, boolean> = {
  hunger: true,
  energy: false,
  performance: false,
  soreness: true,
  stress: true,
  sleep: false,
  preoccupation: true,
}

export const BINGE_LABEL: Record<BingeLevel, string> = {
  none: 'No',
  mild: 'Mild urge',
  strong: 'Strong urge',
  episode: 'Episode occurred',
}

function windowAvg(rs: Recovery[], k: RecKey, from: ISODate, to: ISODate) {
  return mean(rs.filter((r) => r.date >= from && r.date <= to && r[k] != null).map((r) => r[k]!))
}

export interface RecoverySignals {
  signals: string[]
  concern: boolean
  recent: Partial<Record<RecKey, number | null>>
  prior: Partial<Record<RecKey, number | null>>
  bingeStrong: number
  bingeEpisodes: number
  days: number
}

/** Compares the last 14 days with the 14 before. */
export function recoverySignals(rs: Recovery[], today: ISODate): RecoverySignals {
  const a = addDays(today, -13)
  const pa = addDays(today, -27)
  const pb = addDays(today, -14)
  const recentRs = rs.filter((r) => r.date >= a && r.date <= today)
  const keys: RecKey[] = ['hunger', 'energy', 'performance', 'soreness', 'stress', 'sleep', 'preoccupation']
  const recent: RecoverySignals['recent'] = {}
  const prior: RecoverySignals['prior'] = {}
  for (const k of keys) {
    recent[k] = windowAvg(rs, k, a, today)
    prior[k] = windowAvg(rs, k, pa, pb)
  }
  const signals: string[] = []
  const rising = (k: RecKey, abs: number) => {
    const r = recent[k]
    const p = prior[k]
    return r != null && (r >= abs || (p != null && r - p >= 0.75 && r >= 3))
  }
  const falling = (k: RecKey, abs: number) => {
    const r = recent[k]
    const p = prior[k]
    return r != null && (r <= abs || (p != null && p - r >= 0.75 && r <= 3))
  }
  if (recentRs.length >= 4) {
    if (rising('hunger', 4)) signals.push('Hunger has been high or rising')
    if (rising('preoccupation', 3.5)) signals.push('Food preoccupation has been high or rising')
    if (falling('energy', 2.25)) signals.push('Energy has been low or falling')
    if (falling('performance', 2.25)) signals.push('Gym performance has been lower')
    if (falling('sleep', 2)) signals.push('Sleep quality has been low')
  }
  const bingeStrong = recentRs.filter((r) => r.binge === 'strong').length
  const bingeEpisodes = recentRs.filter((r) => r.binge === 'episode').length
  if (bingeStrong + bingeEpisodes >= 2) signals.push('Strong urges or loss-of-control eating have come up more than once')
  const concern = signals.length >= 2 || bingeStrong + bingeEpisodes >= 3 || (bingeEpisodes >= 1 && signals.length >= 1)
  return { signals, concern, recent, prior, bingeStrong, bingeEpisodes, days: recentRs.length }
}

export const RECOVERY_MESSAGE =
  'Your current intake or recovery may be too aggressive for your recomp goal. Consider maintaining or slightly increasing intake rather than cutting further.'
