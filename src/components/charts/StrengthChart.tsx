import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts'
import { fmtDate } from '@/lib/dates'
import { useSettings } from '@/lib/hooks'
import { bestE1RM, historyFor } from '@/lib/progression'
import type { WorkoutSession } from '@/lib/types'
import { showW } from '@/lib/units'
import { Empty } from '@/components/ui/card'
import { axis, C, Legend, TooltipBox } from './common'

export function StrengthChart({ exerciseId, sessions, height = 200 }: { exerciseId: string; sessions: WorkoutSession[]; height?: number }) {
  const settings = useSettings()
  const u = settings?.units ?? { weight: 'lb' as const, length: 'in' as const }
  const data = historyFor(exerciseId, sessions)
    .reverse()
    .map((h) => {
      const top = Math.max(...h.sets.map((s) => s.weight))
      const topReps = Math.max(...h.sets.filter((s) => s.weight === top).map((s) => s.reps))
      return { date: h.session.date, e1rm: Math.round(showW(bestE1RM(h.sets), u)), top: showW(top, u), topReps, reps: h.sets.reduce((a, s) => a + s.reps, 0) }
    })
  if (data.length < 2) return <Empty>The chart appears after two sessions of this exercise.</Empty>
  return (
    <div className="space-y-2">
      <Legend
        items={[
          { label: 'Estimated strength (e1RM)', color: C.line, kind: 'line' },
          { label: 'Top set weight', color: C.ink3, kind: 'dot' },
        ]}
      />
      <div style={{ height }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="date" {...axis} tickFormatter={(d) => fmtDate(d)} minTickGap={24} />
            <YAxis {...axis} domain={['dataMin - 10', 'dataMax + 10']} width={44} />
            <Tooltip
              cursor={{ stroke: C.ink3, strokeDasharray: '3 3' }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={fmtDate(payload[0].payload.date, { month: 'short', day: 'numeric', year: 'numeric' })}
                    rows={[
                      { label: 'e1RM', value: `${payload[0].payload.e1rm} ${u.weight}`, color: C.line },
                      { label: 'Top set', value: `${payload[0].payload.top} × ${payload[0].payload.topReps}`, color: C.ink3 },
                      { label: 'Total reps', value: payload[0].payload.reps },
                    ]}
                  />
                ) : null
              }
            />
            <Scatter dataKey="top" fill={C.ink3} />
            <Line dataKey="e1rm" stroke={C.line} strokeWidth={2} dot={{ r: 3, fill: C.line, strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
