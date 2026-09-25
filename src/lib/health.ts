// Importing Apple Watch / Apple Health data. A web app can't read HealthKit directly, so data arrives
// either through an import link (opened by an iOS Shortcut) or a CSV exported by a Health export app.
// Calories burned are deliberately ignored — they're never used to adjust food targets.
import { db } from './db'
import { toISO, todayISO } from './dates'
import type { Activity, ISODate } from './types'
import { uid } from './utils'

const pad = (n: number) => String(n).padStart(2, '0')

/** Parses '45', '45.5', '1:02:30', '62:30', '2700s', '1.5h' into minutes. */
export function parseMinutes(v: string | null | undefined): number | null {
  if (v == null) return null
  const s = v.trim().toLowerCase().replace(',', '.')
  if (!s) return null
  if (/^\d+(\.\d+)?\s*s(ec)?$/.test(s)) return parseFloat(s) / 60
  if (/^\d+(\.\d+)?\s*h(r|ours?)?$/.test(s)) return parseFloat(s) * 60
  if (/^\d+(\.\d+)?\s*(m|min|minutes?)?$/.test(s)) return parseFloat(s)
  const parts = s.split(':').map(Number)
  if (parts.every((x) => !Number.isNaN(x))) {
    if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60
    if (parts.length === 2) return parts[0] + parts[1] / 60
  }
  return null
}

/** Parses '7.5', '7:30', '450m' as hours of sleep. */
export function parseHours(v: string | null | undefined): number | null {
  if (v == null || !v.trim()) return null
  const s = v.trim().toLowerCase()
  if (/^\d+(\.\d+)?\s*m(in)?$/.test(s)) return parseFloat(s) / 60
  if (s.includes(':')) {
    const [h, m] = s.split(':').map(Number)
    return Number.isNaN(h) ? null : h + (m || 0) / 60
  }
  const n = parseFloat(s)
  if (Number.isNaN(n)) return null
  return n > 24 ? n / 60 : n // plain minutes
}

/** Accepts ISO datetimes, 'YYYY-MM-DD HH:MM', 'HH:MM', or anything Date.parse understands. */
export function parseStart(v: string | null | undefined, fallbackDate: ISODate): { date: ISODate; time?: string } {
  if (!v || !v.trim()) return { date: fallbackDate }
  const s = v.trim()
  const hm = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i)
  if (hm) {
    let h = Number(hm[1])
    if (hm[3]) h = (h % 12) + (hm[3].toLowerCase() === 'pm' ? 12 : 0)
    return { date: fallbackDate, time: `${pad(h)}:${hm[2]}` }
  }
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2}))?/)
  if (iso) return { date: iso[1], time: iso[2] ? `${iso[2]}:${iso[3]}` : undefined }
  const t = Date.parse(s.replace(' at ', ' '))
  if (!Number.isNaN(t)) {
    const d = new Date(t)
    return { date: toISO(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` }
  }
  return { date: fallbackDate }
}

const num = (v: string | null | undefined) => {
  if (v == null || !v.trim()) return undefined
  const n = parseFloat(v.replace(',', '.'))
  return Number.isNaN(n) ? undefined : Math.round(n)
}

export interface HealthImport {
  activities: Activity[]
  sleep?: { date: ISODate; hours: number }
  restingHR?: { date: ISODate; value: number }
}

/**
 * Import-link format (all optional):
 *   date=YYYY-MM-DD            day the data belongs to (default today)
 *   workout=Type&start=…&min=…&hr=…&maxhr=…   one workout
 *   w=Type~start~minutes~avgHR  repeatable, one per workout
 *   sleep=7.5 (or 7:30)         hours slept last night
 *   rhr=58                      resting heart rate
 */
export function parseImportParams(q: URLSearchParams, today = todayISO()): HealthImport {
  const date = q.get('date') || today
  const activities: Activity[] = []
  const add = (type: string | null, start: string | null, min: string | null, hr?: string | null, maxhr?: string | null) => {
    const minutes = parseMinutes(min)
    if (!type || minutes == null || minutes <= 0) return
    const st = parseStart(start, date)
    activities.push({ id: uid(), date: st.date, source: 'apple-health', type: type.trim(), start: st.time, minutes: Math.round(minutes), avgHR: num(hr), maxHR: num(maxhr) })
  }
  add(q.get('workout') ?? q.get('type'), q.get('start'), q.get('min') ?? q.get('duration'), q.get('hr'), q.get('maxhr'))
  for (const w of q.getAll('w')) {
    const [type, start, min, hr] = w.split('~')
    add(type, start ?? null, min ?? null, hr)
  }
  const out: HealthImport = { activities }
  const sleep = parseHours(q.get('sleep'))
  if (sleep != null && sleep > 0 && sleep < 16) out.sleep = { date, hours: Math.round(sleep * 4) / 4 }
  const rhr = num(q.get('rhr'))
  if (rhr != null && rhr > 25 && rhr < 150) out.restingHR = { date, value: rhr }
  return out
}

function splitCSVLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (c === '"') q = false
      else cur += c
    } else if (c === '"') q = true
    else if (c === ',' || c === ';' || c === '\t') {
      out.push(cur)
      cur = ''
    } else cur += c
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

/** Reads a workouts CSV (e.g. from a Health export app) by sniffing column names. */
export function parseWorkoutCSV(text: string, today = todayISO()): Activity[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []
  const head = splitCSVLine(lines[0]).map((h) => h.toLowerCase())
  const find = (re: RegExp, not?: RegExp) => head.findIndex((h) => re.test(h) && !(not && not.test(h)))
  const iType = find(/workout type|activity type|^type$|^workout$|^activity$|name/)
  const iStart = find(/start|^date/)
  const iDur = find(/duration|minutes|^time$/)
  const iHR = find(/(avg|average).*heart|heart rate.*(avg|average)|avg hr|average hr/)
  const iMax = find(/max.*heart|heart.*max|max hr/)
  if (iType < 0 || iDur < 0) return []
  const durUnit = head[iDur]
  const out: Activity[] = []
  for (const line of lines.slice(1)) {
    const c = splitCSVLine(line)
    let min = parseMinutes(c[iDur])
    if (min == null) continue
    if (/\(s\)|sec/.test(durUnit) && !c[iDur].includes(':')) min = min / 60
    if (/\(h\)|hour|hr\b/.test(durUnit) && !c[iDur].includes(':')) min = min * 60
    const st = parseStart(iStart >= 0 ? c[iStart] : null, today)
    if (!c[iType] || min <= 0) continue
    out.push({ id: uid(), date: st.date, source: 'apple-health', type: c[iType], start: st.time, minutes: Math.round(min), avgHR: iHR >= 0 ? num(c[iHR]) : undefined, maxHR: iMax >= 0 ? num(c[iMax]) : undefined })
  }
  return out
}

const same = (a: Activity, b: Activity) =>
  a.date === b.date && a.type.toLowerCase() === b.type.toLowerCase() && (a.start && b.start ? a.start === b.start : Math.abs(a.minutes - b.minutes) <= 2)

/** Saves imported data, updating instead of duplicating anything already imported. */
export async function applyImport(data: HealthImport): Promise<{ added: number; updated: number; sleep: boolean; rhr: boolean }> {
  let added = 0
  let updated = 0
  for (const a of data.activities) {
    const existing = (await db.activities.where('date').equals(a.date).toArray()).find((x) => same(x, a))
    if (existing) {
      await db.activities.put({ ...a, id: existing.id, note: existing.note })
      updated++
    } else {
      await db.activities.put(a)
      added++
    }
  }
  const patch = async (date: ISODate, p: Record<string, number>) => {
    const cur = (await db.recovery.get(date)) ?? { date }
    await db.recovery.put({ ...cur, ...p, date })
  }
  if (data.sleep) await patch(data.sleep.date, { sleepHours: data.sleep.hours })
  if (data.restingHR) await patch(data.restingHR.date, { restingHR: data.restingHR.value })
  return { added, updated, sleep: !!data.sleep, rhr: !!data.restingHR }
}

export const isDance = (a: Activity) => /danc|salsa|bachata/i.test(a.type)

export function describeActivity(a: Activity): string {
  return [a.type, `${a.minutes} min`, a.avgHR ? `avg HR ${a.avgHR}` : null].filter(Boolean).join(' · ')
}

/** The base link a Shortcut should open, e.g. https://…/gym/#/import */
export function importBaseURL(): string {
  return `${location.origin}${location.pathname}#/import`
}
