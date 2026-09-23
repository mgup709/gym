import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { dayTotals, targetsFor, type DayTotals } from '@/lib/nutrition'
import { dayTypeFromSchedule } from '@/lib/repo'
import type { DayLog, FoodEntry, ISODate, Settings } from '@/lib/types'

export interface DayData {
  day: DayLog
  entries: FoodEntry[]
  totals: DayTotals
  stored: boolean
}

/** Live data for one date. If the day has no stored DayLog yet, targets come from current settings. */
export function useDay(date: ISODate, settings: Settings | undefined): DayData | undefined {
  return useLiveQuery(async () => {
    if (!settings) return undefined
    const [stored, entries, templates] = await Promise.all([
      db.days.get(date),
      db.entries.where('date').equals(date).sortBy('time'),
      db.templates.toArray(),
    ])
    const dayType = stored?.dayType ?? dayTypeFromSchedule(settings, templates, date)
    const day: DayLog = stored ?? { date, dayType, targets: targetsFor(settings, dayType) }
    return { day, entries, totals: dayTotals(entries), stored: !!stored }
  }, [date, settings])
}
