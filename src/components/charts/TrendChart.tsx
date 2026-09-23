import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmtDate, fmtMonth } from '@/lib/dates'
import { fmtNum } from '@/lib/utils'
import { axis, C, Legend, TooltipBox } from './common'

export interface TrendPoint {
  key: string // date, week start or month
  value: number | null
  ma7?: number | null
  ma30?: number | null
  band?: [number, number] | null
  n?: number // logged days in bucket
}

/**
 * Daily (or weekly/monthly averaged) values as quiet bars, the moving average as the emphasized line,
 * and the target as a band — no pass/fail colouring.
 */
export function TrendChart({ data, unit, grain, showMA30 = false, onSelect, height = 220, label }: { data: TrendPoint[]; unit: string; grain: 'day' | 'week' | 'month'; showMA30?: boolean; onSelect?: (key: string) => void; height?: number; label: string }) {
  const fmtKey = (k: string) => (grain === 'month' ? fmtMonth(k.slice(0, 7)).split(' ')[0].slice(0, 3) : fmtDate(k))
  const hasBand = data.some((d) => d.band)
  return (
    <div className="space-y-2">
      <Legend
        items={[
          { label: grain === 'day' ? `Daily ${label.toLowerCase()}` : `${grain === 'week' ? 'Weekly' : 'Monthly'} average`, color: C.bar, kind: 'bar' },
          ...(grain === 'day' ? [{ label: '7-day average', color: C.line, kind: 'line' as const }] : []),
          ...(grain === 'day' && showMA30 ? [{ label: '30-day average', color: C.ink3, kind: 'dash' as const }] : []),
          ...(hasBand ? [{ label: 'Target range', color: C.band, kind: 'band' as const }] : []),
        ]}
      />
      <div style={{ height }}>
        <ResponsiveContainer>
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
            onClick={(e) => {
              const p = (e as unknown as { activePayload?: { payload: TrendPoint }[] })?.activePayload?.[0]?.payload
              if (p && onSelect) onSelect(p.key)
            }}
          >
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="key" {...axis} tickFormatter={fmtKey} minTickGap={20} />
            <YAxis {...axis} width={44} domain={[0, 'auto']} />
            <Tooltip
              cursor={{ fill: 'var(--surface-2)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload as TrendPoint
                const title = grain === 'day' ? fmtDate(p.key, { weekday: 'short', month: 'short', day: 'numeric' }) : grain === 'week' ? `Week of ${fmtDate(p.key)}` : fmtMonth(p.key)
                return (
                  <TooltipBox
                    title={title}
                    rows={[
                      { label: grain === 'day' ? 'Logged' : 'Average', value: p.value == null ? 'not logged' : `${fmtNum(p.value)} ${unit}`, color: C.bar },
                      ...(p.ma7 != null ? [{ label: '7-day avg', value: `${fmtNum(p.ma7)} ${unit}`, color: C.line }] : []),
                      ...(showMA30 && p.ma30 != null ? [{ label: '30-day avg', value: `${fmtNum(p.ma30)} ${unit}` }] : []),
                      ...(p.band ? [{ label: 'Target', value: `${fmtNum(p.band[0])}–${fmtNum(p.band[1])}` }] : []),
                      ...(p.n != null && grain !== 'day' ? [{ label: 'Days logged', value: p.n }] : []),
                    ]}
                  />
                )
              }}
            />
            {hasBand && <Area dataKey="band" stroke="none" fill={C.band} fillOpacity={1} isAnimationActive={false} activeDot={false} connectNulls type="stepAfter" />}
            <Bar dataKey="value" fill={C.bar} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} style={{ cursor: onSelect ? 'pointer' : undefined }} />
            {grain === 'day' && <Line dataKey="ma7" stroke={C.line} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />}
            {grain === 'day' && showMA30 && <Line dataKey="ma30" stroke={C.ink3} strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls isAnimationActive={false} />}
            {grain !== 'day' && <Line dataKey="value" stroke={C.line} strokeWidth={2} dot={{ r: 2.5, fill: C.line, strokeWidth: 0 }} connectNulls isAnimationActive={false} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
