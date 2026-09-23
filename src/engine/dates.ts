const DAY_MS = 86_400_000

const toUtc = (d: string) => {
  const [y, m, day] = d.split('-').map(Number)
  return Date.UTC(y, m - 1, day)
}

export function todayStr(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function daysBetween(a: string, b: string): number {
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS)
}

export function addDays(d: string, n: number): string {
  const t = new Date(toUtc(d) + n * DAY_MS)
  return t.toISOString().slice(0, 10)
}

export function weekday(d: string): number {
  return new Date(toUtc(d)).getUTCDay()
}

/** Monday-start week containing d. */
export function weekStart(d: string): string {
  const wd = weekday(d)
  return addDays(d, -((wd + 6) % 7))
}

export function formatDate(d: string): string {
  return new Date(toUtc(d)).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
}
