import { useMemo, useState } from 'react'
import { weeklyScorecard, plannedVolume } from '../engine/scorecard'
import { reviewPlan } from '../engine/adjust'
import { kneeSessions, resolveSlot } from '../engine/knee'
import { DAY_PLANS, WEEKLY_TARGETS } from '../data/program'
import { MEASUREMENT_META } from '../data/baseline'
import { addDays, formatDate } from '../engine/dates'
import { cycleStatus, PHASE_LABEL } from '../engine/cycle'
import type { LowerMuscle, MeasurementKey, WeeklyCheckin } from '../engine/types'
import { Num, Rating, Seg, type ViewProps } from '../ui/common'

const MUSCLES: { m: LowerMuscle; label: string }[] = [
  { m: 'gluteMax', label: 'Glute max' },
  { m: 'upperGlute', label: 'Upper / side glutes' },
  { m: 'hamstrings', label: 'Hamstrings' },
  { m: 'quads', label: 'Quads' },
  { m: 'adductors', label: 'Adductors' },
]

export function CheckIn(props: ViewProps) {
  const [tab, setTab] = useState<'score' | 'checkin' | 'review'>('score')
  return (
    <>
      <h2>Weekly</h2>
      <Seg value={tab} onChange={setTab} options={[{ v: 'score', label: 'Scorecard' }, { v: 'checkin', label: 'Check-in' }, { v: 'review', label: 'Plan review' }]} />
      {tab === 'score' && <Score {...props} />}
      {tab === 'checkin' && <CheckInForm {...props} onDone={() => setTab('review')} />}
      {tab === 'review' && <Review {...props} />}
    </>
  )
}

function Score({ state, today }: ViewProps) {
  const [offset, setOffset] = useState(0)
  const day = addDays(today, -7 * offset)
  const card = useMemo(() => weeklyScorecard(state.sessions, state.kneeCheckins, day), [state, day])
  const planned = useMemo(() => {
    const slots = state.profile.schedule.flatMap((t) => DAY_PLANS[t].slots.map((s) => {
      const r = resolveSlot(s, state.substitutions, kneeSessions(state), state.preferences)
      return { exerciseId: r.exercise.id, sets: s.sets }
    }))
    return plannedVolume(slots)
  }, [state])

  return (
    <>
      <div className="card">
        <div className="row between">
          <h3 style={{ margin: 0 }}>Lower-body scorecard</h3>
          <div className="row">
            <button className="btn ghost sm" onClick={() => setOffset((o) => o + 1)}>‹ Prev</button>
            <span className="small">Week of {formatDate(card.weekOf)}</span>
            <button className="btn ghost sm" disabled={offset === 0} onClick={() => setOffset((o) => o - 1)}>Next ›</button>
          </div>
        </div>
        <p className="tiny muted">Effective sets = logged sets finished within 4 reps of failure. Secondary muscles count as half (or less).</p>
        {MUSCLES.map(({ m, label }) => {
          const [lo, hi] = WEEKLY_TARGETS[m]
          const v = card.sets[m]
          const max = hi * 1.2
          return (
            <div key={m} style={{ margin: '10px 0' }}>
              <div className="row between small">
                <strong>{label}</strong>
                <span>{v.toFixed(1)} effective sets <span className="muted">(target {lo}–{hi})</span></span>
              </div>
              <div className={`bar ${card.coverage[m] === 'on' ? 'good' : card.coverage[m] === 'above' ? 'warn' : ''}`}>
                <i style={{ width: `${Math.min(100, (v / max) * 100)}%` }} />
                <b style={{ left: `${(lo / max) * 100}%` }} />
              </div>
            </div>
          )
        })}
        <div className="grid3 collapse" style={{ marginTop: 12 }}>
          <div className="stat"><div className="v">{card.shoulder.status}</div><div className="l">Shoulders ({card.shoulder.directSets} direct delt sets)</div></div>
          <div className="stat"><div className="v">{card.deepCoreSessions} / 3</div><div className="l">Deep-core sessions</div></div>
          <div className="stat"><div className="v">{card.knee}</div><div className="l">Knee tolerance</div></div>
        </div>
        <p className="small" style={{ marginTop: 10 }}>{card.lowerWidthNote}</p>
      </div>

      <div className="card flat">
        <h3>Lower-Body Width Engine</h3>
        <p className="tiny muted">Audits the program itself (planned weekly sets with your current exercise choices) for the muscles that add visual fullness around the pelvis and thighs. Bone width can't change; muscular width can.</p>
        <table className="data">
          <thead><tr><th>Muscle</th><th>Width role</th><th className="num">Planned</th><th>Status</th></tr></thead>
          <tbody>
            {MUSCLES.map(({ m, label }) => {
              const [lo, hi] = WEEKLY_TARGETS[m]
              const v = planned[m]
              const ok = v >= lo && v <= hi
              return (
                <tr key={m}>
                  <td>{label}</td>
                  <td className="tiny">{ROLE[m]}</td>
                  <td className="num">{v.toFixed(1)}</td>
                  <td><span className={`pill ${ok ? 'good' : 'warn'}`}>{v < lo ? 'low' : v > hi ? 'high' : 'on target'}</span></td>
                </tr>
              )
            })}
            <tr><td>Deltoids / traps</td><td className="tiny">Avoid — widens the top</td><td className="num">{(planned.deltoids + planned.traps).toFixed(1)}</td><td><span className={`pill ${planned.deltoids + planned.traps <= 1 ? 'good' : 'bad'}`}>{planned.deltoids + planned.traps <= 1 ? 'minimal' : 'review'}</span></td></tr>
          </tbody>
        </table>
      </div>
    </>
  )
}

const ROLE: Record<LowerMuscle, string> = {
  gluteMax: 'Projection + rear/side fullness',
  upperGlute: 'Upper-hip width from the front',
  hamstrings: 'Back-of-thigh fullness',
  quads: 'Front/outer thigh width',
  adductors: 'Inner-thigh fullness',
}

const BODY_KEYS: MeasurementKey[] = ['weight', 'waistCirc', 'waistWidth', 'highHipWidth', 'hipWidth', 'hipCirc', 'upperThighCirc', 'shoulderWidth']

function CheckInForm({ state, update, today, onDone }: ViewProps & { onDone: () => void }) {
  const last = [...state.checkins].sort((a, b) => a.date.localeCompare(b.date)).pop()
  const [c, setC] = useState<WeeklyCheckin>({
    date: today, body: {}, gluteStrength: 'same', lowerPerformance: 'same', completion: 100, soreness: 2, fatigue: 2, kneeSymptoms: 0,
    coreControl: 3, coreSessions: 3, calorieAdherence: 4, proteinHit: 6, hunger: 3, carbsAroundTraining: true,
    steps: last?.steps ?? state.profile.stepTarget, sleepHours: last?.sleepHours ?? 7, stress: 3,
  })
  const set = (patch: Partial<WeeklyCheckin>) => setC((x) => ({ ...x, ...patch }))
  const phase = cycleStatus(state.cycle, today)
  const tri = (v: WeeklyCheckin['gluteStrength'], f: (v: WeeklyCheckin['gluteStrength']) => void) => (
    <Seg value={v} onChange={f} options={[{ v: 'down', label: '↓ Down' }, { v: 'same', label: '↔ Same' }, { v: 'up', label: '↑ Up' }]} />
  )

  const save = () => {
    const body = Object.fromEntries(Object.entries(c.body).filter(([, v]) => typeof v === 'number'))
    update((s) => ({
      ...s,
      checkins: [...s.checkins.filter((x) => x.date !== today), { ...c, body }],
      measurements: Object.keys(body).length ? [...s.measurements.filter((m) => m.date !== today), { date: today, values: { ...(s.measurements.find((m) => m.date === today)?.values ?? {}), ...body } }] : s.measurements,
      kneeCheckins: c.kneeSymptoms > 0 ? [...s.kneeCheckins, { date: today, score: c.kneeSymptoms, swelling: false, instability: false, notes: 'weekly check-in' }] : s.kneeCheckins,
    }))
    onDone()
  }

  return (
    <div className="card">
      <h3>Weekly check-in</h3>
      {state.cycle.enabled && phase.retentionWindow && <div className="note warn small">You're in a water-retention window ({PHASE_LABEL[phase.phase]}). Log measurements anyway — the review will account for it.</div>}
      <h4>Body</h4>
      <div className="grid2">
        {BODY_KEYS.map((k) => (
          <Num key={k} label={k === 'weight' ? 'Average weight (lb)' : MEASUREMENT_META[k].label} value={c.body[k]} step={k === 'weight' ? 0.1 : 0.25} onChange={(v) => set({ body: { ...c.body, [k]: v } })} />
        ))}
      </div>
      <h4>Training</h4>
      <div className="field"><span>Glute strength</span>{tri(c.gluteStrength, (v) => set({ gluteStrength: v }))}</div>
      <div className="field"><span>Lower-body performance</span>{tri(c.lowerPerformance, (v) => set({ lowerPerformance: v }))}</div>
      <Num label="Workout completion (%)" value={c.completion} step={5} onChange={(v) => set({ completion: v ?? 0 })} />
      <Rating label="Soreness" value={c.soreness} onChange={(v) => set({ soreness: v })} />
      <Rating label="Fatigue" value={c.fatigue} onChange={(v) => set({ fatigue: v })} />
      <Rating label="Knee symptoms this week (0–5)" value={c.kneeSymptoms} min={0} max={5} onChange={(v) => set({ kneeSymptoms: v })} />
      <h4>Core</h4>
      <Rating label="Deep-core control" value={c.coreControl} onChange={(v) => set({ coreControl: v })} />
      <Rating label="Core sessions completed" value={c.coreSessions} min={0} max={5} onChange={(v) => set({ coreSessions: v })} />
      <h4>Nutrition</h4>
      <Rating label="Calorie adherence" value={c.calorieAdherence} onChange={(v) => set({ calorieAdherence: v })} />
      <Rating label="Days protein target hit" value={c.proteinHit} min={0} max={7} onChange={(v) => set({ proteinHit: v })} />
      <Rating label="Hunger" value={c.hunger} onChange={(v) => set({ hunger: v })} />
      <label className="row small"><input type="checkbox" checked={c.carbsAroundTraining} onChange={(e) => set({ carbsAroundTraining: e.target.checked })} /> Had carbs before & after lower-body sessions</label>
      <h4>Lifestyle</h4>
      <div className="grid2">
        <Num label="Average steps" value={c.steps} step={500} onChange={(v) => set({ steps: v ?? 0 })} />
        <Num label="Average sleep (h)" value={c.sleepHours} step={0.5} onChange={(v) => set({ sleepHours: v ?? 0 })} />
      </div>
      <Rating label="Stress" value={c.stress} onChange={(v) => set({ stress: v })} />
      <label className="row small"><input type="checkbox" checked={!!c.shoulderLooksBigger} onChange={(e) => set({ shoulderLooksBigger: e.target.checked })} /> My shoulders look bigger / broader</label>
      <label className="field"><span>Notes</span><textarea value={c.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} /></label>
      <button className="btn primary" onClick={save}>Save check-in</button>
    </div>
  )
}

function Review({ state, today }: ViewProps) {
  const r = useMemo(() => reviewPlan(state, today), [state, today])
  const tone = r.verdict === 'working' ? 'good' : r.verdict === 'shoulders' || r.verdict === 'waistUp' ? 'warn' : 'info'
  return (
    <>
      <div className={`card`}>
        <h3>Plan review</h3>
        <div className={`note ${tone}`}><strong>{r.headline}</strong></div>
        {r.actions.length > 0 && <ul className="small">{r.actions.map((a) => <li key={a}>{a}</li>)}</ul>}
        {r.checklist.length > 0 && (
          <table className="data">
            <tbody>
              {r.checklist.map((i) => (
                <tr key={i.factor}>
                  <td className="small"><strong>{i.factor}</strong><div className="tiny muted">{i.detail}</div></td>
                  <td><span className={`pill ${i.status === 'ok' ? 'good' : i.status === 'check' ? 'warn' : ''}`}>{i.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="card flat small">
        <strong>How the review decides</strong>
        <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
          <li>Waist ↓, glutes/thighs ↔ or ↑, strength ↑, shoulders ↔ → keep going. No calorie cuts, no exercise changes.</li>
          <li>Shoulders ↑ → immediate upper-body audit and freeze.</li>
          <li>Lower body flat → work through progression, volume, effort, selection, protein, calories, carbs, sleep, recovery and consistency — in that order. Volume isn't automatically increased.</li>
          <li>Thigh growth is judged against waist and hips, not treated as a problem.</li>
          <li>The program is kept stable for at least 4–6 weeks so changes can be measured.</li>
        </ul>
      </div>
    </>
  )
}
