import type { ReactNode } from 'react'
import type { AppState } from '../engine/types'
import type { Update } from '../store'

export type Tab = 'today' | 'workout' | 'body' | 'food' | 'cycle' | 'coach' | 'checkin' | 'knee' | 'settings'

export interface ViewProps {
  state: AppState
  update: Update
  today: string
  go: (t: Tab) => void
}

export function Spark({ points, baseline }: { points: number[]; baseline?: number }) {
  if (points.length < 2) return <p className="tiny muted">Log more measurements to see a trend.</p>
  const w = 300
  const h = 44
  const all = baseline !== undefined ? [...points, baseline] : points
  const min = Math.min(...all)
  const max = Math.max(...all)
  const span = max - min || 1
  const x = (i: number) => 6 + (i * (w - 12)) / (points.length - 1)
  const y = (v: number) => h - 6 - ((v - min) / span) * (h - 12)
  const d = points.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="trend">
      {baseline !== undefined && <line className="base" x1={0} x2={w} y1={y(baseline)} y2={y(baseline)} />}
      <path className="line" d={d} />
      <circle cx={x(points.length - 1)} cy={y(points[points.length - 1])} r={3} />
    </svg>
  )
}

export function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: { v: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={String(o.v)} type="button" className={o.v === value ? 'on' : ''} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function KneeScale({ value, onChange }: { value?: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="knee-scale" role="radiogroup" aria-label="Knee response 0 to 5">
        {[0, 1, 2, 3, 4, 5].map((k) => (
          <button key={k} type="button" className={`k${k} ${value === k ? 'on' : ''}`} onClick={() => onChange(k)} aria-pressed={value === k}>
            {k}
          </button>
        ))}
      </div>
      <div className="knee-scale tiny muted" style={{ marginTop: 2, textAlign: 'center' }}>
        <span>none</span><span>aware</span><span>mild</span><span>moderate</span><span>significant</span><span>stop</span>
      </div>
    </div>
  )
}

export function Num({ label, value, onChange, step = 0.25, placeholder }: { label: string; value?: number; onChange: (v: number | undefined) => void; step?: number; placeholder?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      />
    </label>
  )
}

export function Rating({ label, value, onChange, min = 1, max = 5 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="field" role="group" aria-label={label}>
      <span>{label}</span>
      <Seg value={value} onChange={onChange} options={Array.from({ length: max - min + 1 }, (_, i) => ({ v: i + min, label: String(i + min) }))} />
    </div>
  )
}
