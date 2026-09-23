import { useState } from 'react'
import { cycleGuidance, cycleStatus, kneeByPhase, observedCycleLength, PHASE_LABEL, readiness, type Phase } from '../engine/cycle'
import { addDays, daysBetween, formatDate } from '../engine/dates'
import type { CycleSymptoms } from '../engine/types'
import { Rating, Seg, type ViewProps } from '../ui/common'

const DEFAULT_SYMPTOMS: CycleSymptoms = { energy: 3, cramps: 0, bloating: 0, sleep: 3, mood: 3, bleeding: 'none' }
const READY_PILL = { good: 'good', reduced: 'warn', low: 'bad' } as const
const PHASE_ORDER: Phase[] = ['menstrual', 'follicular', 'ovulatory', 'earlyLuteal', 'lateLuteal']

export function Cycle({ state, update, today }: ViewProps) {
  const c = state.cycle
  const status = cycleStatus(c, today)
  const sym = c.symptoms[today] ?? DEFAULT_SYMPTOMS
  const ready = readiness(c.symptoms[today])
  const guide = cycleGuidance(status, ready)
  const [newStart, setNewStart] = useState(today)
  const setCycle = (patch: Partial<typeof c>) => update((s) => ({ ...s, cycle: { ...s.cycle, ...patch } }))
  const setSym = (patch: Partial<CycleSymptoms>) => setCycle({ symptoms: { ...c.symptoms, [today]: { ...sym, ...patch } } })

  const kneeEntries = [
    ...state.kneeCheckins.map((k) => ({ date: k.date, score: k.score })),
    ...state.sessions.flatMap((s) => s.exercises.filter((e) => typeof e.knee === 'number').map((e) => ({ date: s.date, score: e.knee! }))),
  ]
  const kp = kneeByPhase(c, kneeEntries)

  if (!c.enabled) {
    return (
      <>
        <h2>Cycle sync</h2>
        <div className="card">
          <p className="small">Cycle sync is off.</p>
          <button className="btn primary" onClick={() => setCycle({ enabled: true })}>Turn on</button>
        </div>
      </>
    )
  }

  // Timeline of the current cycle.
  const len = status.cycleLength
  const day = status.cycleDay ?? 0
  const ov = len - 14

  return (
    <>
      <h2>Cycle sync</h2>
      <div className="card accent">
        <div className="row between">
          <span className="eyebrow">Today</span>
          <span className={`pill ${READY_PILL[ready]}`}>Readiness: {ready}</span>
        </div>
        <div className="big">{PHASE_LABEL[status.phase]}</div>
        {status.cycleDay && <p className="small muted">Day {status.cycleDay} of ~{len}{status.nextPeriod ? ` · next period ~${formatDate(status.nextPeriod)}` : ''}</p>}
        {status.phase !== 'unknown' && !c.hormonalContraception && (
          <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', margin: '8px 0', position: 'relative' }}>
            <div style={{ flex: c.periodLength, background: 'var(--bad)' }} title="Menstrual" />
            <div style={{ flex: Math.max(1, ov - 2 - c.periodLength), background: 'var(--good)' }} title="Follicular" />
            <div style={{ flex: 3, background: 'var(--info)' }} title="Ovulatory" />
            <div style={{ flex: Math.max(1, len - 6 - (ov + 1)), background: 'var(--warn)' }} title="Early luteal" />
            <div style={{ flex: 6, background: 'var(--accent)' }} title="Late luteal" />
            {day > 0 && <div style={{ position: 'absolute', left: `${Math.min(100, ((day - 0.5) / len) * 100)}%`, top: -3, bottom: -3, width: 3, background: 'var(--text)', borderRadius: 2 }} />}
          </div>
        )}
        <h4>Training</h4><p className="small">{guide.training}</p>
        {guide.knee && <p className="small"><strong>Knee:</strong> {guide.knee}</p>}
        <h4>Nutrition</h4><p className="small">{guide.nutrition}</p>
        <h4>Measurements & photos</h4><p className="small">{guide.measurement}</p>
      </div>

      <div className="card">
        <h3>Log today's symptoms</h3>
        <p className="tiny muted">Symptoms — not the calendar — decide whether today's progression is held.</p>
        <Rating label="Energy" value={sym.energy} onChange={(v) => setSym({ energy: v })} />
        <Rating label="Cramps (0 none – 3 strong)" value={sym.cramps} min={0} max={3} onChange={(v) => setSym({ cramps: v })} />
        <Rating label="Bloating (0–3)" value={sym.bloating} min={0} max={3} onChange={(v) => setSym({ bloating: v })} />
        <Rating label="Sleep quality" value={sym.sleep} onChange={(v) => setSym({ sleep: v })} />
        <Rating label="Mood" value={sym.mood} onChange={(v) => setSym({ mood: v })} />
        <div className="field">
          <span>Bleeding</span>
          <Seg value={sym.bleeding ?? 'none'} onChange={(v) => setSym({ bleeding: v })} options={(['none', 'spotting', 'light', 'medium', 'heavy'] as const).map((v) => ({ v, label: v }))} />
        </div>
        {sym.bleeding && sym.bleeding !== 'none' && sym.bleeding !== 'spotting' && !c.periodStarts.some((d) => daysBetween(d, today) >= 0 && daysBetween(d, today) < 10) && (
          <button className="btn sm primary" onClick={() => setCycle({ periodStarts: [...c.periodStarts, today].sort() })}>Mark today as period day 1</button>
        )}
      </div>

      <div className="card">
        <h3>Period starts</h3>
        <div className="row">
          <input type="date" value={newStart} onChange={(e) => setNewStart(e.target.value)} style={{ maxWidth: 180 }} />
          <button className="btn sm primary" onClick={() => !c.periodStarts.includes(newStart) && setCycle({ periodStarts: [...c.periodStarts, newStart].sort() })}>Add</button>
        </div>
        <div className="small" style={{ marginTop: 8 }}>
          {[...c.periodStarts].reverse().map((d, i, arr) => (
            <div key={d} className="row between" style={{ padding: '3px 0' }}>
              <span>{formatDate(d)}{arr[i + 1] ? <span className="muted"> · {daysBetween(arr[i + 1], d)}-day cycle</span> : ''}</span>
              <button className="btn ghost sm" onClick={() => setCycle({ periodStarts: c.periodStarts.filter((x) => x !== d) })}>Remove</button>
            </div>
          ))}
          {!c.periodStarts.length && <p className="muted">Add your most recent period start to estimate phases.</p>}
        </div>
        <p className="tiny muted">Average cycle from your log: {observedCycleLength(c)} days. Predictions: ovulation ≈ day {len - 14}; next period ≈ {status.nextPeriod ? formatDate(status.nextPeriod) : '—'}; next good measurement window ≈ {c.periodStarts.length ? formatDate(addDays(status.nextPeriod ?? today, c.periodLength + 1)) : '—'}.</p>
      </div>

      {Object.keys(kp).length > 0 && (
        <div className="card">
          <h3>Knee response by phase</h3>
          <p className="tiny muted">If knee scores cluster in one phase, it's worth knowing — adjust knee-dominant work in that window.</p>
          <table className="data">
            <thead><tr><th>Phase</th><th className="num">Avg knee (0–5)</th><th className="num">Entries</th></tr></thead>
            <tbody>
              {PHASE_ORDER.filter((p) => kp[p]).map((p) => (
                <tr key={p}><td>{PHASE_LABEL[p]}</td><td className="num">{kp[p]!.avg.toFixed(1)}</td><td className="num">{kp[p]!.n}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card flat">
        <h3>Settings</h3>
        <div className="grid2">
          <label className="field"><span>Typical cycle length (days)</span><input type="number" value={c.cycleLength} onChange={(e) => setCycle({ cycleLength: Number(e.target.value) || 28 })} /></label>
          <label className="field"><span>Period length (days)</span><input type="number" value={c.periodLength} onChange={(e) => setCycle({ periodLength: Number(e.target.value) || 5 })} /></label>
        </div>
        <label className="row small"><input type="checkbox" checked={c.hormonalContraception} onChange={(e) => setCycle({ hormonalContraception: e.target.checked })} /> I use hormonal contraception (switches to symptom-only mode)</label>
        <button className="btn ghost sm" onClick={() => setCycle({ enabled: false })}>Turn cycle sync off</button>
        <div className="note small">
          <strong>How this works:</strong> research doesn't support rigid phase-based programming, so the training plan stays the same all month. What changes: (1) symptoms can hold progression for a day, (2) a small calorie bump in the luteal phase when energy use and hunger rise, (3) measurements in water-retention windows are flagged so you don't misread your waist trend, (4) knee scores are compared by phase. Irregular cycles, very heavy bleeding or severe pain are worth discussing with a doctor.
        </div>
      </div>
    </>
  )
}
