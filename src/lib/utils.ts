import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

export const round = (n: number, dp = 0) => {
  const f = 10 ** dp
  return Math.round(n * f) / f
}

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

export const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : null)

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

export function fmtNum(n: number | null | undefined, dp = 0): string {
  if (n == null || Number.isNaN(n)) return '—'
  return round(n, dp).toLocaleString(undefined, { maximumFractionDigits: dp })
}

export function signed(n: number, dp = 2): string {
  const r = round(n, dp)
  if (r === 0) return '±0'
  return (r > 0 ? '+' : '−') + Math.abs(r).toLocaleString(undefined, { maximumFractionDigits: dp })
}

/** Least-squares slope of y over x. */
export function slope(points: { x: number; y: number }[]): number | null {
  if (points.length < 2) return null
  const mx = sum(points.map((p) => p.x)) / points.length
  const my = sum(points.map((p) => p.y)) / points.length
  let num = 0
  let den = 0
  for (const p of points) {
    num += (p.x - mx) * (p.y - my)
    den += (p.x - mx) ** 2
  }
  return den === 0 ? null : num / den
}
