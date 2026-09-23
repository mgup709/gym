import type { ReactNode } from 'react'

export const C = {
  bar: 'var(--chart-bar)',
  line: 'var(--chart-line)',
  band: 'var(--chart-band)',
  grid: 'var(--chart-grid)',
  ink3: 'var(--text-3)',
  sage: 'var(--sage)',
  amber: 'var(--amber)',
}

export const axis = { stroke: C.ink3, fontSize: 11, tickLine: false, axisLine: false } as const

export function TooltipBox({ title, rows }: { title: ReactNode; rows: { label: string; value: ReactNode; color?: string }[] }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-medium text-ink">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4 text-ink-2">
          <span className="flex items-center gap-1.5">
            {r.color && <span className="inline-block size-2 rounded-full" style={{ background: r.color }} />}
            {r.label}
          </span>
          <span className="font-medium text-ink tabular-nums">{r.value}</span>
        </div>
      ))}
    </div>
  )
}

export function Legend({ items }: { items: { label: string; color: string; kind?: 'bar' | 'line' | 'band' | 'dash' | 'dot' }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          {i.kind === 'line' || i.kind === 'dash' ? (
            <span className="inline-block h-0 w-4 border-t-2" style={{ borderColor: i.color, borderStyle: i.kind === 'dash' ? 'dashed' : 'solid' }} />
          ) : i.kind === 'dot' ? (
            <span className="inline-block size-2 rounded-full" style={{ background: i.color }} />
          ) : (
            <span className="inline-block h-2.5 w-3 rounded-sm" style={{ background: i.color }} />
          )}
          {i.label}
        </span>
      ))}
    </div>
  )
}
