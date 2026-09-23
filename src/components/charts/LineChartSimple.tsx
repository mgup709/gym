import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmtDate } from '@/lib/dates'
import { fmtNum } from '@/lib/utils'
import { axis, C, TooltipBox } from './common'

/** One measure over time (single series → no legend; the card title names it). */
export function LineChartSimple({ data, unit, baseline, height = 170, dp = 2, domain, note }: { data: { date: string; value: number | null; note?: string }[]; unit: string; baseline?: number; height?: number; dp?: number; domain?: [number | string, number | string]; note?: (d: { date: string; value: number | null; note?: string }) => string | undefined }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="date" {...axis} tickFormatter={(d) => fmtDate(d)} minTickGap={24} />
          <YAxis {...axis} width={44} domain={domain ?? ['dataMin - 0.5', 'dataMax + 0.5']} tickFormatter={(v) => fmtNum(v, 1)} />
          {baseline != null && <ReferenceLine y={baseline} stroke={C.ink3} strokeDasharray="4 3" label={{ value: 'baseline', position: 'insideTopLeft', fontSize: 10, fill: C.ink3 }} />}
          <Tooltip
            cursor={{ stroke: C.ink3, strokeDasharray: '3 3' }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TooltipBox
                  title={fmtDate(payload[0].payload.date, { month: 'short', day: 'numeric', year: 'numeric' })}
                  rows={[
                    { label: 'Value', value: payload[0].payload.value == null ? '—' : `${fmtNum(payload[0].payload.value, dp)} ${unit}`, color: C.line },
                    ...(note?.(payload[0].payload) ? [{ label: 'Context', value: note(payload[0].payload)! }] : []),
                  ]}
                />
              ) : null
            }
          />
          <Line dataKey="value" stroke={C.line} strokeWidth={2} dot={{ r: 3, fill: C.line, strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
