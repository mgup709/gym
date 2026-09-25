import { useLiveQuery } from 'dexie-react-hooks'
import { Music, Trash2, Watch } from 'lucide-react'
import { Chip } from '@/components/ui/controls'
import { toast } from '@/components/ui/toast'
import { fmtDate, fmtTime } from '@/lib/dates'
import { db } from '@/lib/db'
import { describeActivity, isDance } from '@/lib/health'
import type { ISODate } from '@/lib/types'
import { uid } from '@/lib/utils'

/** Workouts recorded outside the app (Apple Watch via Apple Health, or entered by hand) for one date. */
export function ActivityList({ date, showDate = false, dates }: { date?: ISODate; showDate?: boolean; dates?: [ISODate, ISODate] }) {
  const list = useLiveQuery(
    () => (dates ? db.activities.where('date').between(dates[0], dates[1], true, true).reverse().sortBy('date') : db.activities.where('date').equals(date!).toArray()),
    [date, dates?.[0], dates?.[1]],
  )
  if (!list?.length) return null
  return (
    <ul className="space-y-1.5">
      {list.map((a) => (
        <li key={a.id} className="flex items-center gap-2 text-sm">
          {isDance(a) ? <Music className="size-4 shrink-0 text-sage" /> : <Watch className="size-4 shrink-0 text-sage" />}
          <span className="min-w-0 flex-1">
            {describeActivity(a)}
            <span className="text-xs text-ink-3">
              {showDate && ` · ${fmtDate(a.date)}`}
              {a.start && ` · ${fmtTime(a.start)}`}
              {a.source === 'apple-health' ? ' · Apple Health' : ''}
            </span>
          </span>
          <button
            className="rounded-full p-1.5 text-ink-3"
            aria-label="Remove activity"
            onClick={async () => {
              await db.activities.delete(a.id)
              toast('Activity removed', () => db.activities.put(a).then(() => undefined))
            }}
          >
            <Trash2 className="size-3.5" />
          </button>
        </li>
      ))}
    </ul>
  )
}

/** One tap to record tonight's dancing when it isn't coming from the watch. No calorie estimate. */
export function DanceToggle({ date }: { date: ISODate }) {
  const dance = useLiveQuery(async () => (await db.activities.where('date').equals(date).toArray()).find(isDance), [date])
  return (
    <Chip
      active={!!dance}
      onClick={async () => {
        if (dance) {
          await db.activities.delete(dance.id)
          return
        }
        await db.activities.put({ id: uid(), date, source: 'manual', type: 'Salsa / bachata', minutes: 120 })
      }}
    >
      <Music className="size-3.5" /> {dance ? 'Danced tonight ✓' : 'Log tonight’s dancing'}
    </Chip>
  )
}
