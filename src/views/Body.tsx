import { useEffect, useMemo, useState } from 'react'
import { MEASUREMENT_META, PRIORITY_KEYS, EXTRA_BASELINE } from '../data/baseline'
import { latestValues, proportionReport, RATIOS, ratioSeries, ratioValue, series } from '../engine/proportions'
import { cycleStatus, PHASE_LABEL } from '../engine/cycle'
import { formatDate } from '../engine/dates'
import type { MeasurementKey, Measurements } from '../engine/types'
import { deletePhoto, listPhotos, savePhoto, type Photo, type PhotoView } from '../photos'
import { uid } from '../store'
import { Num, Seg, Spark, type ViewProps } from '../ui/common'
import { fmtIn, signed } from '../ui/format'

export function Body(props: ViewProps) {
  const [tab, setTab] = useState<'dash' | 'log' | 'photos'>('dash')
  return (
    <>
      <h2>Body & proportions</h2>
      <Seg value={tab} onChange={setTab} options={[{ v: 'dash', label: 'Proportions' }, { v: 'log', label: 'Log measurements' }, { v: 'photos', label: 'Photos' }]} />
      {tab === 'dash' && <Dashboard {...props} />}
      {tab === 'log' && <LogMeasurements {...props} onDone={() => setTab('dash')} />}
      {tab === 'photos' && <Photos {...props} />}
    </>
  )
}

const LEVELS: { label: string; key: MeasurementKey; circ?: MeasurementKey }[] = [
  { label: 'Shoulders', key: 'shoulderWidth' },
  { label: 'Waist', key: 'waistWidth', circ: 'waistCirc' },
  { label: 'High hip', key: 'highHipWidth', circ: 'highHipCirc' },
  { label: 'Hip / glutes', key: 'hipWidth', circ: 'hipCirc' },
  { label: 'Upper thigh', key: 'thighWidth', circ: 'upperThighCirc' },
]

function Dashboard({ state }: ViewProps) {
  const current = useMemo(() => latestValues(state.baseline, state.measurements), [state.baseline, state.measurements])
  const report = useMemo(() => proportionReport(state.baseline.values, current), [state.baseline, current])
  const base = state.baseline.values
  const maxW = Math.max(...LEVELS.map((l) => Math.max(base[l.key] ?? 0, current[l.key] ?? 0) * (l.key === 'thighWidth' ? 2 : 1)))

  return (
    <>
      <div className="card">
        <h3>Front-view silhouette</h3>
        <p className="tiny muted">Light bar = baseline width, dark line = current. Thigh shown as both legs.</p>
        <div className="silhouette">
          {LEVELS.map((l) => {
            const k = l.key === 'thighWidth' ? 2 : 1
            const b = (base[l.key] ?? 0) * k
            const c = (current[l.key] ?? 0) * k
            return (
              <div className="lvl" key={l.key}>
                <span>{l.label}</span>
                <div style={{ position: 'relative' }}>
                  <div className="shape" style={{ width: `${(b / maxW) * 100}%` }} />
                  <div className="shape now" style={{ width: `${(c / maxW) * 100}%` }} />
                </div>
                <span className="small" style={{ textAlign: 'right' }}>{fmtIn(current[l.key])}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="card accent">
        <h3>Proportion analysis</h3>
        {report.lines.map((l) => <p key={l} className="small">{l}</p>)}
        <p className="tiny muted">Descriptive only — these are not beauty scores. Exercise can add muscle around the pelvis and thighs; it can't change bone width.</p>
      </div>

      <div className="card">
        <h3>Ratios</h3>
        {RATIOS.map((r) => {
          const b = ratioValue(base, r)
          const c = ratioValue(current, r)
          const pts = ratioSeries(state.baseline, state.measurements, r).map((p) => p.value)
          const delta = b && c ? c - b : 0
          const towardGoal = r.goal === 'up' ? delta > 0.005 : delta < -0.005
          return (
            <div key={r.id} style={{ marginBottom: 12 }}>
              <div className="row between">
                <span className="small"><strong>{r.label}</strong> <span className="muted">({r.formula})</span></span>
                <span className="small">
                  {b?.toFixed(2)} → <strong>{c?.toFixed(2)}</strong>{' '}
                  {Math.abs(delta) > 0.005 && <span className={`pill ${towardGoal ? 'good' : 'warn'}`}>{delta > 0 ? '+' : ''}{delta.toFixed(2)}</span>}
                </span>
              </div>
              <Spark points={pts} baseline={b ?? undefined} />
            </div>
          )
        })}
        <p className="tiny muted">Shoulder ÷ hip falling means the lower body is gaining width relative to the shoulders.</p>
      </div>

      <div className="card">
        <h3>Priority measurements</h3>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Site</th><th className="num">Baseline</th><th className="num">Now</th><th className="num">Change</th><th>Goal</th></tr></thead>
            <tbody>
              {PRIORITY_KEYS.map((k) => {
                const d = report.deltas[k] ?? 0
                const meta = MEASUREMENT_META[k]
                const ok = meta.want === 'increase' ? d >= 0 : meta.want === 'decrease' ? d <= 0 : Math.abs(d) < 0.25
                return (
                  <tr key={k}>
                    <td>{meta.label}</td>
                    <td className="num">{fmtIn(base[k])}</td>
                    <td className="num">{fmtIn(current[k])}</td>
                    <td className="num">{d ? <span className={`pill ${ok ? 'good' : 'warn'}`}>{signed(d)}</span> : '—'}</td>
                    <td className="small muted">{meta.want}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card flat">
        <h4>Trends</h4>
        {(['waistCirc', 'hipCirc', 'upperThighCirc', 'hipWidth', 'shoulderWidth', 'weight'] as MeasurementKey[]).map((k) => {
          const s = series(state.baseline, state.measurements, k)
          return (
            <div key={k}>
              <div className="small"><strong>{MEASUREMENT_META[k].label}</strong> <span className="muted">{s.map((p) => p.value).join(' → ') || '—'}</span></div>
              <Spark points={s.map((p) => p.value)} baseline={state.baseline.values[k]} />
            </div>
          )
        })}
        <p className="tiny muted">
          Other baseline references: upper thighs together {EXTRA_BASELINE.upperThighsTogether} in, mid-thighs together {EXTRA_BASELINE.midThighsTogether} in, torso ~{EXTRA_BASELINE.torsoLength}, inside leg ~{EXTRA_BASELINE.insideLeg} in, height 5'6".
        </p>
      </div>

      {state.measurements.length > 0 && (
        <div className="card flat">
          <h4>History</h4>
          {[...state.measurements].sort((a, b) => b.date.localeCompare(a.date)).map((m) => {
            const ph = cycleStatus(state.cycle, m.date)
            return (
              <div key={m.date} className="small row between" style={{ padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
                <span>{formatDate(m.date)} {state.cycle.enabled && ph.phase !== 'unknown' && <span className={`pill ${ph.retentionWindow ? 'warn' : ''}`}>{PHASE_LABEL[ph.phase]}</span>}</span>
                <span className="muted">{Object.keys(m.values).length} sites</span>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function LogMeasurements({ state, update, today, onDone }: ViewProps & { onDone: () => void }) {
  const existing = state.measurements.find((m) => m.date === today)
  const [date, setDate] = useState(today)
  const [vals, setVals] = useState<Measurements>(existing?.values ?? {})
  const [showAll, setShowAll] = useState(false)
  const phase = cycleStatus(state.cycle, date)
  const keys = showAll ? (Object.keys(MEASUREMENT_META) as MeasurementKey[]) : [...PRIORITY_KEYS, 'weight' as MeasurementKey]

  const save = () => {
    const clean = Object.fromEntries(Object.entries(vals).filter(([, v]) => typeof v === 'number' && !Number.isNaN(v))) as Measurements
    update((s) => ({ ...s, measurements: [...s.measurements.filter((m) => m.date !== date), { date, values: clean }] }))
    onDone()
  }

  return (
    <div className="card">
      <h3>Log measurements</h3>
      <div className="note small">
        Measure consistently: same time of day (morning, before eating), relaxed posture, tape level and snug but not compressing, same spot each time. For front widths, use the same photo distance/height or calipers.
      </div>
      {state.cycle.enabled && phase.phase !== 'unknown' && (
        <div className={`note small ${phase.retentionWindow ? 'warn' : 'good'}`}>
          Cycle: {PHASE_LABEL[phase.phase]}. {phase.retentionWindow ? 'Water retention may inflate waist/lower stomach and weight — log it, but compare trends against the same phase.' : phase.measurementWindow ? 'Good window for official measurements.' : 'Fine to measure.'}
        </div>
      )}
      <label className="field"><span>Date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      <div className="grid2">
        {keys.map((k) => (
          <Num
            key={k}
            label={`${MEASUREMENT_META[k].label}${k === 'weight' ? '' : ` (base ${state.baseline.values[k] ?? '—'})`}`}
            value={vals[k]}
            step={k === 'weight' ? 0.1 : 0.25}
            onChange={(v) => setVals((x) => ({ ...x, [k]: v }))}
          />
        ))}
      </div>
      <button className="btn ghost sm" onClick={() => setShowAll((s) => !s)}>{showAll ? 'Priority sites only' : 'Show all sites'}</button>
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn primary" onClick={save}>Save</button>
      </div>
    </div>
  )
}

const VIEWS: PhotoView[] = ['front', 'side', 'back']

function Photos({ state, today }: ViewProps) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [view, setView] = useState<PhotoView>('front')
  const [err, setErr] = useState<string | null>(null)

  const refresh = () =>
    listPhotos().then((p) => setPhotos(p.sort((a, b) => b.date.localeCompare(a.date)))).catch(() => setErr('Photo storage is unavailable in this browser.'))
  useEffect(() => { refresh() }, [])
  const urls = useMemo(() => Object.fromEntries(photos.map((p) => [p.id, URL.createObjectURL(p.blob)])), [photos])
  useEffect(() => () => Object.values(urls).forEach((u) => URL.revokeObjectURL(u)), [urls])

  const add = async (file: File) => {
    await savePhoto({ id: uid(), date: today, view, blob: file })
    refresh()
  }

  const byView = photos.filter((p) => p.view === view)
  const first = byView[byView.length - 1]
  const latest = byView[0]
  const phase = cycleStatus(state.cycle, today)

  return (
    <>
      <div className="card flat small">
        <strong>Consistency checklist</strong>
        <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
          <li>Same distance from the camera (mark the floor) and the same camera height (~hip height, on a tripod or shelf).</li>
          <li>Same lighting and time of day where possible; same clothing type.</li>
          <li>Same pose: relaxed, feet hip-width, arms slightly away from the body. Front, side and back.</li>
          {state.cycle.enabled && <li>Take "official" photos in the same cycle phase (follicular is ideal). {phase.measurementWindow ? 'Today is in that window.' : ''}</li>}
        </ul>
        <p className="tiny muted" style={{ marginBottom: 0 }}>Photos stay on this device. They are never analysed or scored.</p>
      </div>
      {err && <div className="note bad">{err}</div>}
      <div className="row between" style={{ margin: '8px 0' }}>
        <Seg value={view} onChange={setView} options={VIEWS.map((v) => ({ v, label: v[0].toUpperCase() + v.slice(1) }))} />
        <label className="btn primary sm">
          Add {view} photo
          <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && add(e.target.files[0])} />
        </label>
      </div>
      {first && latest && first.id !== latest.id && (
        <div className="card">
          <h3>First vs latest ({view})</h3>
          <div className="grid2">
            {[first, latest].map((p) => (
              <figure key={p.id} style={{ margin: 0 }}>
                <img src={urls[p.id]} alt={`${p.view} ${p.date}`} style={{ width: '100%', borderRadius: 10 }} />
                <figcaption className="tiny muted">{formatDate(p.date)}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}
      <div className="photos">
        {byView.map((p) => (
          <figure key={p.id}>
            <img src={urls[p.id]} alt={`${p.view} ${p.date}`} />
            <figcaption className="row between">
              {formatDate(p.date)}
              <button className="btn ghost sm" onClick={() => deletePhoto(p.id).then(refresh)}>Delete</button>
            </figcaption>
          </figure>
        ))}
      </div>
      {!byView.length && <p className="small muted">No {view} photos yet.</p>}
    </>
  )
}
