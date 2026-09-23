import { diffDays, weekday } from './dates'
import { sorted } from './measurements'
import type { Measurement, Settings } from './types'

/** Due when no measurement in the last 6 days and it's measurement day (or it's been over a week). */
export function isCheckInDue(settings: Settings, ms: Measurement[], today: string): boolean {
  const last = sorted(ms).filter((m) => m.date <= today).pop()
  if (!last) return true
  const since = diffDays(today, last.date)
  return since >= 6 && (weekday(today) === settings.measurementDay || since >= 8)
}

export function isPhotoDue(settings: Settings, lastPhotoDate: string | undefined, today: string): boolean {
  if (!lastPhotoDate) return true
  return diffDays(today, lastPhotoDate) >= (settings.photoFrequency === 'weekly' ? 6 : 27)
}

