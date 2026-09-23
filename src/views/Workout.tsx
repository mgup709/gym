import { useMemo, useState } from 'react'
import { buildToday, type PlannedExercise, type CorePlanItem } from '../engine/plan'
import { substitutes, explainSubstitution, tolerance, kneeSessions } from '../engine/knee'
import { CORE_BY_ID } from '../data/core'
import { DAY_PLANS } from '../data/program'
import { uid } from '../store'
import type { AppState, CoreLog, DayType, ExerciseLog, SetLog, WorkoutSession } from '../engine/types'
import { KneeScale, Rating, Seg, type ViewProps } from '../ui/common'
import { fmtSec } from '../ui/format'
import type { Update } from '../store'

const ACTION_PILL = { start: 'info', addReps: 'accent', addLoad: 'good', hold: 'warn', reduce: 'bad' } as const
const ACTION_LABEL = { start: 'First session', addReps: 'Add reps', addLoad: 'Add load', hold: 'Hold', reduce: 'Reduce' } as const

export function Workout({ state, update, today }: ViewProps) {
  const existing = state.sessions.find((s) => s.date === today)
  const [override, setOverride] = useState<DayType | undefined>(existing?.dayType)
  const plan = useMemo(() => buildToday(state, today, override), [state, today, override])
  const session = state.sessions.find((s) => s.date === today && s.dayType === plan.day.type)

  const updSession = (fn: (s: WorkoutSession) => WorkoutSession) =>
    update((st) => {
      const cur = st.sessions.find((s) => s.date === today && s.dayType === plan.day.type) ?? {
        id: uid(), date: today, dayType: plan.day.type, exercises: [], core: [],
      }
      const next = fn(cur)
      return { ...st, sessions: [...st.sessions.filter((s) => s.id !== cur.id), next] }
    })

  const trainable = (Object.keys(DAY_PLANS) as DayType[]).filter((t) => DAY_PLANS[t].isTraining || DAY_PLANS[t].deepCore)

  return (
    <>
      <div className="row between">
        <h2>{plan.day.title}</h2>
      </div>
      <p className="muted small">{plan.day.objective}</p>
      <label className="field">
        <span>Doing a different session today?</span>
        <select value={plan.day.type} onChange={(e) => setOverride(e.target.value as DayType)}>
          {trainable.map((t) => <option key={t} value={t}>{DAY_PLANS[t].title}</option>)}
        </select>
      </label>

      {plan.knee.status !== 'good' && <div className={`note ${plan.knee.status === 'modify' ? 'bad' : 'warn'}`}>{plan.knee.message}</div>}
      {plan.knee.seeProfessional && <div className="note bad">{plan.knee.seeProfessional}</div>}
      {plan.cycleGuide.holdProgression && <div className="note warn">{plan.cycleGuide.training}</div>}

      {plan.exercises.map((pe) => (
        <ExerciseCard
          key={pe.slot.slotId}
          pe={pe}
          state={state}
          update={update}
          log={session?.exercises.find((e) => e.slotId === pe.slot.slotId)}
          onLog={(log) => updSession((s) => ({ ...s, exercises: [...s.exercises.filter((e) => e.slotId !== log.slotId), log] }))}
        />
      ))}

      {plan.core.length > 0 && (
        <div className="card">
          <h3>Deep core</h3>
          <p className="small muted">Quality over reps: progress only when the low back stays down/neutral and you can keep breathing. Exhale as you move.</p>
          {plan.core.map((c) => (
            <CoreCard
              key={c.moveId} item={c} update={update}
              log={session?.core.find((x) => x.moveId === c.moveId)}
              onLog={(log) => updSession((s) => ({ ...s, core: [...s.core.filter((x) => x.moveId !== log.moveId), log] }))}
            />
          ))}
        </div>
      )}

      {session && (
        <div className="card flat">
          <h3>Finish</h3>
          <Rating label="Overall fatigue after the session (1 fresh – 5 wiped)" value={session.fatigue ?? 3} onChange={(v) => updSession((s) => ({ ...s, fatigue: v }))} />
          <label className="field">
            <span>Notes</span>
            <textarea value={session.notes ?? ''} onChange={(e) => updSession((s) => ({ ...s, notes: e.target.value }))} />
          </label>
          <p className="tiny muted">Everything saves as you go.</p>
        </div>
      )}
    </>
  )
}

function ExerciseCard({ pe, state, update, log, onLog }: { pe: PlannedExercise; state: AppState; update: Update; log?: ExerciseLog; onLog: (l: ExerciseLog) => void }) {
  const { slot, exercise: ex, target } = pe
  const [swapOpen, setSwapOpen] = useState(false)
  const current: ExerciseLog = log && log.exerciseId === ex.id ? log : { slotId: slot.slotId, exerciseId: ex.id, sets: [], formOk: true }
  const rows = Array.from({ length: slot.sets }, (_, i) => current.sets[i])
  const tol = tolerance(kneeSessions(state), ex.id)

  const setRow = (i: number, s: SetLog | undefined) => {
    const sets = [...current.sets]
    if (s) sets[i] = s
    else sets.splice(i, 1)
    onLog({ ...current, sets: sets.filter(Boolean) })
  }

  const alts = swapOpen ? substitutes(slot, ex.id, kneeSessions(state), state.preferences).slice(0, 4) : []

  return (
    <div className="card">
      <div className="row between">
        <div>
          <h3 style={{ margin: 0 }}>{ex.name}</h3>
          <div className="small muted">Purpose: {ex.purpose}</div>
        </div>
        <span className={`pill ${ACTION_PILL[target.action]}`}>{ACTION_LABEL[target.action]}</span>
      </div>

      {pe.substitution && (
        <div className="note info small">
          <div><strong>Original:</strong> {pe.substitution.originalPurpose}</div>
          <div><strong>Why changed:</strong> {pe.substitution.why}</div>
          <div><strong>Replacement:</strong> {pe.substitution.replacement}</div>
          <div><strong>Still trains:</strong> {pe.substitution.stillTrains}</div>
          {state.substitutions[slot.slotId] && (
            <button className="btn ghost sm" onClick={() => update((s) => { const { [slot.slotId]: _, ...rest } = s.substitutions; return { ...s, substitutions: rest } })}>
              Restore default exercise
            </button>
          )}
        </div>
      )}

      <dl className="kv" style={{ marginTop: 8 }}>
        <dt>Sets × reps</dt><dd>{slot.sets} × {slot.repRange.join('–')}</dd>
        <dt>RIR</dt><dd>{target.rir.join('–')} <span className="muted tiny">(reps left in the tank)</span></dd>
        <dt>Rest</dt><dd>{fmtSec(slot.restSec)}</dd>
        <dt>Last session</dt><dd>{pe.lastText}</dd>
        <dt>Today</dt><dd>{target.weight !== null ? `${target.weight} lb` : 'choose load'} · goal {target.reps.join(' / ')}</dd>
        {pe.kneeCheck && <><dt>Knee demand</dt><dd>{cap(ex.kneeDemand)}{tol !== 'untested' ? ` · your tolerance: ${tol}` : ''}</dd></>}
      </dl>
      <p className="small" style={{ marginTop: 6 }}>{target.note}</p>
      {ex.kneeNotes && pe.kneeCheck && <p className="tiny muted">Knee: {ex.kneeNotes}</p>}
      <details>
        <summary>Form cues</summary>
        <ul className="small" style={{ margin: 0 }}>{ex.cues.map((c) => <li key={c}>{c}</li>)}</ul>
      </details>

      <table className="sets">
        <thead><tr><th>Set</th><th>lb</th><th>Reps</th><th>RIR</th><th /></tr></thead>
        <tbody>
          {rows.map((s, i) => (
            <SetRow key={i} i={i} set={s} enabled={s ? i === current.sets.length - 1 : i === current.sets.length} defaultWeight={target.weight ?? current.sets[i - 1]?.weight ?? 0} defaultReps={target.reps[i] ?? slot.repRange[0]} defaultRir={target.rir[0]} onChange={(v) => setRow(i, v)} />
          ))}
        </tbody>
      </table>

      {pe.kneeCheck && current.sets.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div className="small"><strong>Knee response</strong></div>
          <KneeScale value={current.knee} onChange={(k) => onLog({ ...current, knee: k })} />
          {(current.knee ?? 0) >= 3 && (
            <div className="note bad small">
              {current.knee === 5 ? 'Stop this exercise now.' : 'Stop or reduce range/load for the remaining sets.'} It won't be progressed next time; if it repeats, a knee-friendlier substitute will replace it automatically.
              <button className="btn sm" style={{ marginLeft: 6 }} onClick={() => setSwapOpen(true)}>Swap now</button>
            </div>
          )}
        </div>
      )}

      <div className="row between" style={{ marginTop: 10 }}>
        <label className="row small"><input type="checkbox" checked={current.formOk} onChange={(e) => onLog({ ...current, formOk: e.target.checked })} /> Form was solid</label>
        <button className="btn sm" onClick={() => setSwapOpen((o) => !o)}>{swapOpen ? 'Close' : 'Swap exercise'}</button>
      </div>

      {swapOpen && (
        <div style={{ marginTop: 8 }}>
          <p className="tiny muted">Ranked by same target muscles, knee demand, your knee history and preference. Shoulder-building movements are never offered.</p>
          {alts.map((a) => {
            const e = explainSubstitution(slot, ex.id, a.id, 'You chose it.')
            return (
              <div key={a.id} className="note">
                <div className="row between">
                  <strong>{a.name}</strong>
                  <button className="btn sm primary" onClick={() => { update((s) => ({ ...s, substitutions: { ...s.substitutions, [slot.slotId]: a.id } })); setSwapOpen(false) }}>Use this</button>
                </div>
                <div className="tiny">Still trains: {e.stillTrains}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SetRow({ i, set, enabled, defaultWeight, defaultReps, defaultRir, onChange }: { i: number; set?: SetLog; enabled: boolean; defaultWeight: number; defaultReps: number; defaultRir: number; onChange: (s: SetLog | undefined) => void }) {
  const [w, setW] = useState(set?.weight ?? defaultWeight)
  const [r, setR] = useState(set?.reps ?? defaultReps)
  const [rir, setRir] = useState(set?.rir ?? defaultRir)
  const done = !!set
  return (
    <tr className={done ? 'done' : ''}>
      <td>{i + 1}</td>
      <td><input type="number" inputMode="decimal" value={w} onChange={(e) => { setW(Number(e.target.value)); if (done) onChange({ weight: Number(e.target.value), reps: r, rir }) }} /></td>
      <td><input type="number" inputMode="numeric" value={r} onChange={(e) => { setR(Number(e.target.value)); if (done) onChange({ weight: w, reps: Number(e.target.value), rir }) }} /></td>
      <td>
        <select value={rir} onChange={(e) => { setRir(Number(e.target.value)); if (done) onChange({ weight: w, reps: r, rir: Number(e.target.value) }) }}>
          {[0, 1, 2, 3, 4, 5].map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      </td>
      <td>
        <button className={`btn sm ${done ? '' : 'primary'}`} disabled={!enabled} onClick={() => onChange(done ? undefined : { weight: w, reps: r, rir })}>{done ? 'Undo' : 'Log'}</button>
      </td>
    </tr>
  )
}

function CoreCard({ item, log, onLog, update }: { item: CorePlanItem; log?: CoreLog; onLog: (l: CoreLog) => void; update: Update }) {
  const move = CORE_BY_ID[item.moveId]
  const cur: CoreLog = { ...(log ?? { moveId: item.moveId, control: 3, breathing: 3, lumbarNeutral: true, completed: false }), level: item.level }
  const setLevel = (lvl: number) => update((s) => ({ ...s, coreLevels: { ...s.coreLevels, [item.moveId]: lvl } }))
  return (
    <div className="note" style={{ marginBottom: 10 }}>
      <div className="row between">
        <strong>{move.name}</strong>
        <span className="pill">Level {item.level + 1}/{move.levels.length}</span>
      </div>
      <div className="small">{item.levelName} · <strong>{item.prescription}</strong></div>
      <div className="tiny muted">{move.purpose}. Cue: {item.cue}</div>
      {item.note && <div className="tiny" style={{ marginTop: 4 }}><strong>{item.note}</strong></div>}
      <div className="row" style={{ marginTop: 6 }}>
        {item.level > 0 && <button className="btn ghost sm" onClick={() => setLevel(item.level - 1)}>Step back</button>}
        {item.level < move.levels.length - 1 && <button className="btn ghost sm" onClick={() => setLevel(item.level + 1)}>Level up</button>}
      </div>
      <label className="row small"><input type="checkbox" checked={cur.completed} onChange={(e) => onLog({ ...cur, completed: e.target.checked })} /> Completed</label>
      {cur.completed && (
        <div className="grid2" style={{ marginTop: 6 }}>
          <Rating label="Control" value={cur.control} onChange={(v) => onLog({ ...cur, control: v })} />
          <Rating label="Breathing quality" value={cur.breathing} onChange={(v) => onLog({ ...cur, breathing: v })} />
          <div className="field">
            <span>Low back stayed neutral?</span>
            <Seg value={cur.lumbarNeutral ? 'y' : 'n'} onChange={(v) => onLog({ ...cur, lumbarNeutral: v === 'y' })} options={[{ v: 'y', label: 'Yes' }, { v: 'n', label: 'No' }]} />
          </div>
        </div>
      )}
    </div>
  )
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)
