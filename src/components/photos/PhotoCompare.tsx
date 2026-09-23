import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Empty } from '@/components/ui/card'
import { Segmented } from '@/components/ui/controls'
import { Select } from '@/components/ui/input'
import { fmtDate } from '@/lib/dates'
import { db } from '@/lib/db'
import type { PhotoAngle } from '@/lib/types'
import { ANGLES } from './PhotoCapture'
import { usePhotoURL } from './usePhotoURL'

type Mode = 'side' | 'swipe' | 'overlay'

/** Private photo comparison — side-by-side, swipe, or transparent overlay. No scoring of any kind. */
export function PhotoCompare() {
  const photos = useLiveQuery(() => db.photos.orderBy('date').toArray(), [])
  const [angle, setAngle] = useState<PhotoAngle>('front')
  const [mode, setMode] = useState<Mode>('side')
  const [a, setA] = useState<string>('')
  const [b, setB] = useState<string>('')
  const [pos, setPos] = useState(50)

  const ofAngle = useMemo(() => (photos ?? []).filter((p) => p.angle === angle), [photos, angle])
  const dates = ofAngle.map((p) => p.date)
  const left = ofAngle.find((p) => p.date === a) ?? ofAngle[0]
  const right = ofAngle.find((p) => p.date === b) ?? ofAngle[ofAngle.length - 1]
  const lu = usePhotoURL(left?.blob)
  const ru = usePhotoURL(right?.blob)

  if (!photos) return null
  if (photos.length === 0) return <Empty>Photos you add in the weekly check-in appear here. They stay on this device.</Empty>

  const lastMonth = (() => {
    if (!right) return undefined
    const target = new Date(right.date)
    target.setDate(target.getDate() - 28)
    const t = target.toISOString().slice(0, 10)
    return [...ofAngle].reverse().find((p) => p.date <= t)
  })()

  const label = (p?: { date: string; cycleDay?: number | null }) => (p ? `${fmtDate(p.date, { month: 'short', day: 'numeric', year: 'numeric' })}${p.cycleDay ? ` · cycle day ${p.cycleDay}` : ''}` : '')

  return (
    <div className="space-y-3">
      <Segmented size="sm" value={angle} onChange={setAngle} options={ANGLES.map((x) => ({ value: x.value, label: x.label }))} />
      {ofAngle.length < 2 ? (
        <Empty>Two photos of this angle are needed to compare.</Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Select value={left?.date} onChange={(e) => setA(e.target.value)}>
              {dates.map((d) => (
                <option key={d} value={d}>
                  {fmtDate(d, { month: 'short', day: 'numeric', year: 'numeric' })}
                </option>
              ))}
            </Select>
            <Select value={right?.date} onChange={(e) => setB(e.target.value)}>
              {dates.map((d) => (
                <option key={d} value={d}>
                  {fmtDate(d, { month: 'short', day: 'numeric', year: 'numeric' })}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button className="rounded-full bg-surface-2 px-3 py-1" onClick={() => { setA(ofAngle[0].date); setB(ofAngle[ofAngle.length - 1].date) }}>
              Baseline vs current
            </button>
            {lastMonth && (
              <button className="rounded-full bg-surface-2 px-3 py-1" onClick={() => { setA(lastMonth.date); setB(ofAngle[ofAngle.length - 1].date) }}>
                Last month vs current
              </button>
            )}
          </div>
          <Segmented size="sm" value={mode} onChange={setMode} options={[{ value: 'side', label: 'Side by side' }, { value: 'swipe', label: 'Swipe' }, { value: 'overlay', label: 'Overlay' }]} />
          {mode === 'side' && (
            <div className="grid grid-cols-2 gap-2">
              {[left, right].map((p, i) => (
                <figure key={i}>
                  <img src={(i === 0 ? lu : ru) ?? ''} alt="" className="aspect-[3/4] w-full rounded-2xl bg-surface-2 object-cover" />
                  <figcaption className="mt-1 text-center text-xs text-ink-3">{label(p)}</figcaption>
                </figure>
              ))}
            </div>
          )}
          {mode !== 'side' && lu && ru && (
            <div className="space-y-2">
              <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-2xl bg-surface-2 select-none">
                <img src={lu} alt="" className="absolute inset-0 size-full object-cover" />
                {mode === 'swipe' ? (
                  <>
                    <img src={ru} alt="" className="absolute inset-0 size-full object-cover" style={{ clipPath: `inset(0 0 0 ${pos}%)` }} />
                    <div className="absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${pos}%` }} />
                  </>
                ) : (
                  <img src={ru} alt="" className="absolute inset-0 size-full object-cover" style={{ opacity: pos / 100 }} />
                )}
              </div>
              <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-label={mode === 'swipe' ? 'Swipe position' : 'Overlay opacity'} />
              <div className="flex justify-between text-xs text-ink-3">
                <span>{label(left)}</span>
                <span>{label(right)}</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
