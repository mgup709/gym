import { useMemo, useState } from 'react'
import { kneeMemory, kneeSessions, kneeSummary, KNEE_SCALE } from '../engine/knee'
import { formatDate } from '../engine/dates'
import type { Preference } from '../engine/types'
import { KneeScale, Seg, type ViewProps } from '../ui/common'

const TOL_PILL = { untested: '', good: 'good', monitor: 'warn', avoid: 'bad' } as const

export function Knee({ state, update, today }: ViewProps) {
  const [score, setScore] = useState<number | undefined>(undefined)
  const [swelling, setSwelling] = useState(false)
  const [instability, setInstability] = useState(false)
  const [notes, setNotes] = useState('')
  const summary = kneeSummary(state.kneeCheckins, state.sessions, today)
  const memory = useMemo(() => kneeMemory(kneeSessions(state), state.preferences), [state])
  const recent = [...state.kneeCheckins].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7)

  const save = () => {
    if (score === undefined) return
    update((s) => ({ ...s, kneeCheckins: [...s.kneeCheckins, { date: today, score, swelling, instability, notes: notes || undefined }] }))
    setScore(undefined); setSwelling(false); setInstability(false); setNotes('')
  }
  const setPref = (id: string, p: Preference) => update((s) => ({ ...s, preferences: { ...s.preferences, [id]: p } }))

  return (
    <>
      <h2>Knees</h2>
      <div className={`note ${summary.status === 'good' ? 'good' : summary.status === 'mild' ? 'warn' : 'bad'}`}>{summary.message}</div>
      {summary.seeProfessional && <div className="note bad">{summary.seeProfessional}</div>}

      <div className="card">
        <h3>Knee check-in</h3>
        <p className="tiny muted">How do your knees feel right now (walking, stairs, sitting to standing)?</p>
        <KneeScale value={score} onChange={setScore} />
        {score !== undefined && <p className="small">{KNEE_SCALE[score]}</p>}
        <label className="row small"><input type="checkbox" checked={swelling} onChange={(e) => setSwelling(e.target.checked)} /> Visible swelling</label>
        <label className="row small"><input type="checkbox" checked={instability} onChange={(e) => setInstability(e.target.checked)} /> Knee feels unstable / gives way / locks</label>
        <label className="field"><span>Notes (what aggravated it?)</span><input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        <button className="btn primary" disabled={score === undefined} onClick={save}>Save</button>
        <p className="tiny muted">The app doesn't diagnose. Swelling, instability, locking, or pain that is significant, persistent or worsening should be assessed by a physiotherapist or doctor.</p>
        {recent.length > 0 && (
          <div className="small" style={{ marginTop: 8 }}>
            {recent.map((k, i) => (
              <div key={i} className="row between"><span>{formatDate(k.date)}</span><span>{k.score}/5{k.swelling ? ' · swelling' : ''}{k.instability ? ' · instability' : ''}</span></div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3>Knee-tolerance memory</h3>
        <p className="tiny muted">Built from the knee response you log after each exercise. When two movements train the same thing, the one with the lower knee score and higher preference wins. "Avoid" movements are automatically replaced.</p>
        {memory.map((m) => (
          <div key={m.exercise.id} className="note" style={{ marginBottom: 8 }}>
            <div className="row between">
              <strong>{m.exercise.name}</strong>
              <span className="row">
                {m.tolerance === 'avoid' && (
                  <button className="btn ghost sm" title="Allow this movement back into the program — use a lighter load and shorter range" onClick={() => update((s) => ({ ...s, kneeResets: { ...s.kneeResets, [m.exercise.id]: today } }))}>Retest</button>
                )}
                <span className={`pill ${TOL_PILL[m.tolerance]}`}>{m.tolerance}</span>
              </span>
            </div>
            <div className="tiny">
              Glute stimulus: <strong>{m.gluteStimulus}</strong> · Quad stimulus: <strong>{m.quadStimulus}</strong> · Knee demand: <strong>{m.exercise.kneeDemand}</strong>
              {m.avgKnee !== null && <> · Knee response: <strong>{m.avgKnee.toFixed(1)}/5</strong> avg, last {m.lastKnee} ({m.sessions} sessions)</>}
            </div>
            <div className="row" style={{ marginTop: 4 }}>
              <span className="tiny muted">Your preference:</span>
              <Seg value={m.preference} onChange={(p) => setPref(m.exercise.id, p)} options={[{ v: 'low', label: 'Low' }, { v: 'neutral', label: 'Neutral' }, { v: 'high', label: 'High' }]} />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
