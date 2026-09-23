import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { axis, C, TooltipBox } from '@/components/charts/common'
import { Empty } from '@/components/ui/card'
import { Chip } from '@/components/ui/controls'
import { averageLength, cycleLengths, periodStarts } from '@/lib/cycle'
import { addDays, fmtDate, rangeDates, weekStart } from '@/lib/dates'
import { db } from '@/lib/db'
import { REC_LABEL, type RecKey } from '@/lib/recovery'
import type { ISODate, Settings } from '@/lib/types'
import { fmtNum, mean } from '@/lib/utils'

const KEYS: RecKey[] = ['hunger', 'energy', 'sleep', 'soreness', 'stress', 'performance', 'preoccupation']

export function RecoverySection({ today }: { today: ISODate }) {
  const all = useLiveQuery(() => db.recovery.toArray(), [])
  const [days, setDays] = useState(60)
  const series = useMemo(() => {
    if (!all) return null
    const map = new Map(all.map((r) => [r.date, r]))
    const dates = rangeDates(addDays(today, -(days - 1)), today)
    const out = dates.map((d, i) => {
      const row: Record<string, number | string | null> = { date: d }
      for (const k of KEYS) {
        const win = dates.slice(Math.max(0, i - 6), i + 1).map((x) => map.get(x)?.[k]).filter((v): v is number => v != null)
        row[k] = win.length >= 2 ? Math.round(mean(win)! * 10) / 10 : null
        row[`${k}_raw`] = map.get(d)?.[k] ?? null
      }
      return row
    })
    const weeks = new Map<string, { key: string; strong: number; episode: number; mild: number }>()
    for (const d of dates) {
      const w = weekStart(d)
      const b = weeks.get(w) ?? { key: w, strong: 0, episode: 0, mild: 0 }
      const r = map.get(d)?.binge
      if (r === 'mild') b.mild++
      if (r === 'strong') b.strong++
      if (r === 'episode') b.episode++
      weeks.set(w, b)
    }
    return { out, weeks: [...weeks.values()], logged: dates.filter((d) => map.has(d)).length }
  }, [all, days, today])
  if (!series) return null
  if (series.logged === 0) return <Empty>Recovery trends appear once you log a few daily check-ins.</Empty>
  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        {[30, 60, 180].map((d) => (
          <Chip key={d} active={days === d} onClick={() => setDays(d)}>
            {d} days
          </Chip>
        ))}
      </div>
      <p className="text-xs text-ink-3">7-day averages on a 1–5 scale. For hunger, soreness, stress and food preoccupation, higher means more.</p>
      <div className="grid grid-cols-2 gap-3">
        {KEYS.map((k) => (
          <div key={k}>
            <div className="mb-0.5 text-xs font-medium text-ink-2">{REC_LABEL[k]}</div>
            <div className="h-20">
              <ResponsiveContainer>
                <LineChart data={series.out} syncId="rec" margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
                  <CartesianGrid stroke={C.grid} vertical={false} />
                  <XAxis dataKey="date" hide />
                  <YAxis {...axis} domain={[1, 5]} ticks={[1, 3, 5]} width={40} />
                  <Tooltip
                    cursor={{ stroke: C.ink3, strokeDasharray: '3 3' }}
                    content={({ active, payload }) =>
                      active && payload?.length ? (
                        <TooltipBox title={fmtDate(payload[0].payload.date)} rows={[{ label: '7-day avg', value: fmtNum(payload[0].payload[k], 1) }, { label: 'That day', value: payload[0].payload[`${k}_raw`] ?? '—' }]} />
                      ) : null
                    }
                  />
                  <Line dataKey={k} stroke={C.line} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
      <div>
        <div className="mb-0.5 text-xs font-medium text-ink-2">Strong urges or episodes per week</div>
        <div className="h-24">
          <ResponsiveContainer>
            <BarChart data={series.weeks} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis dataKey="key" {...axis} tickFormatter={(d) => fmtDate(d)} minTickGap={20} />
              <YAxis {...axis} allowDecimals={false} width={40} />
              <Tooltip
                cursor={{ fill: 'var(--surface-2)' }}
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <TooltipBox
                      title={`Week of ${fmtDate(payload[0].payload.key)}`}
                      rows={[
                        { label: 'Mild urges', value: payload[0].payload.mild },
                        { label: 'Strong urges', value: payload[0].payload.strong },
                        { label: 'Episodes', value: payload[0].payload.episode },
                      ]}
                    />
                  ) : null
                }
              />
              <Bar dataKey={(d: { strong: number; episode: number }) => d.strong + d.episode} fill={C.bar} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

export function CycleHistory({ settings }: { settings: Settings }) {
  const days = useLiveQuery(() => db.cycle.toArray(), [])
  if (!days) return null
  const starts = periodStarts(days, settings)
  const lengths = cycleLengths(starts)
  const avg = averageLength(starts)
  const symptomDays = days.filter((d) => (d.cramps ?? 0) >= 2 || (d.bloating ?? 0) >= 2).length
  if (!starts.length) return <Empty>Log your period in the daily check-in (or set the last start date in Settings) to see cycle history.</Empty>
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap gap-4">
        <div>
          <div className="text-xs text-ink-3">Average length</div>
          <div className="font-display text-xl">{avg ? `${avg} days` : `~${settings.cycle.length} days`}</div>
        </div>
        <div>
          <div className="text-xs text-ink-3">Last start</div>
          <div className="font-display text-xl">{fmtDate(starts[starts.length - 1])}</div>
        </div>
        <div>
          <div className="text-xs text-ink-3">Days with notable cramps / bloating</div>
          <div className="font-display text-xl">{symptomDays}</div>
        </div>
      </div>
      {lengths.length > 0 && (
        <ul className="divide-y divide-border">
          {lengths
            .slice(-8)
            .reverse()
            .map((l) => (
              <li key={l.start} className="flex justify-between py-1.5">
                <span>{fmtDate(l.start, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                <span className="text-ink-2">{l.length} days</span>
              </li>
            ))}
        </ul>
      )}
      <p className="text-xs text-ink-3">Regular cycles are one of the signs that intake is supporting your training. {settings.cycle.note}</p>
    </div>
  )
}
