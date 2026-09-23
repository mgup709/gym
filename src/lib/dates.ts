import type { ISODate } from './types'

const pad = (n: number) => String(n).padStart(2, '0')

export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayISO(): ISODate {
  return toISO(new Date())
}

export function parseISO(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = parseISO(s)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((parseISO(a).getTime() - parseISO(b).getTime()) / 86400000)
}

export function weekday(s: ISODate): number {
  return parseISO(s).getDay()
}

export function rangeDates(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

/** Monday of the week containing s. */
export function weekStart(s: ISODate): ISODate {
  const wd = weekday(s)
  return addDays(s, wd === 0 ? -6 : 1 - wd)
}

export const monthKey = (s: ISODate) => s.slice(0, 7)

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function fmtDate(s: ISODate, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }): string {
  return parseISO(s).toLocaleDateString(undefined, opts)
}

export function fmtMonth(key: string): string {
  return parseISO(`${key}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function nowHM(): string {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const toMin = (hm: string) => {
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + (m || 0)
}

export const fromMin = (min: number) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
}

/** '14:30' → '2:30 PM' */
export function fmtTime(hm: string): string {
  const [h, m] = hm.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${pad(m)} ${suffix}`
}

export function fmtDuration(ms: number): string {
  const min = Math.round(ms / 60000)
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${min % 60} min`
}
