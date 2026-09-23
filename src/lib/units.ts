import type { Settings } from './types'
import { round } from './utils'

type Units = Settings['units']

export const wUnit = (u: Units) => u.weight
export const lUnit = (u: Units) => u.length

/** lb → display */
export const showW = (lb: number, u: Units) => (u.weight === 'kg' ? round(lb * 0.45359237, 1) : round(lb, 1))
/** display → lb */
export const readW = (v: number, u: Units) => (u.weight === 'kg' ? v / 0.45359237 : v)
/** in → display */
export const showL = (inch: number, u: Units) => (u.length === 'cm' ? round(inch * 2.54, 1) : round(inch, 2))
/** display → in */
export const readL = (v: number, u: Units) => (u.length === 'cm' ? v / 2.54 : v)
/** Length difference formatting, e.g. '+0.25 in' */
export function fmtL(inch: number, u: Units, signedOut = false): string {
  const v = showL(inch, u)
  const s = signedOut ? (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v) : String(v)
  return `${s} ${u.length}`
}
export function fmtW(lb: number, u: Units): string {
  return `${showW(lb, u)} ${u.weight}`
}
