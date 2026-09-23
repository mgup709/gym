import { useRef, useState } from 'react'
import { DAY_PLANS } from '../data/program'
import { averageTargets, bmr, GOAL_LABEL } from '../engine/nutrition'
import type { DayType, GoalMode } from '../engine/types'
import { DEFAULT_STATE, exportState, importState } from '../store'
import { Num, type ViewProps } from '../ui/common'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function Settings({ state, update }: ViewProps) {
  const p = state.profile
  const setP = (patch: Partial<typeof p>) => update((s) => ({ ...s, profile: { ...s.profile, ...patch } }))
  const [showKey, setShowKey] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const avg = averageTargets(p)
  const lowerDays = p.schedule.filter((t) => DAY_PLANS[t].isLowerBody).length

  const download = () => {
    const blob = new Blob([exportState(state)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `hourglass-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <>
      <h2>Settings</h2>
      <div className="card">
        <h3>Profile</h3>
        <div className="grid2">
          <Num label="Body weight (lb)" value={p.weightLb} step={0.5} onChange={(v) => setP({ weightLb: v })} />
          <Num label="Age" value={p.age} step={1} onChange={(v) => setP({ age: v })} />
          <Num label="Height (in)" value={p.heightIn} step={0.5} onChange={(v) => setP({ heightIn: v ?? 66 })} />
          <Num label="Daily step target" value={p.stepTarget} step={500} onChange={(v) => setP({ stepTarget: v ?? 8000 })} />
        </div>
        <label className="field">
          <span>Nutrition goal</span>
          <select value={p.goalMode} onChange={(e) => setP({ goalMode: e.target.value as GoalMode })}>
            {(Object.keys(GOAL_LABEL) as GoalMode[]).map((g) => <option key={g} value={g}>{GOAL_LABEL[g]}</option>)}
          </select>
        </label>
        {avg && (
          <p className="small muted">
            Estimated BMR {Math.round(bmr(p)!)} kcal. Average target {avg.kcal} kcal · P {avg.protein} g · C {avg.carbs} g · F {avg.fat} g. The deficit is intentionally modest (never below ~1.2× BMR) so glute and thigh development isn't compromised.
          </p>
        )}
      </div>

      <div className="card">
        <h3>Weekly schedule</h3>
        <p className="tiny muted">Default: 3 lower-body days, 1 upper maintenance, recovery, optional, rest. Adjust to your recovery and knee tolerance. You have {lowerDays} lower-body day{lowerDays === 1 ? '' : 's'}.</p>
        {DAYS.map((d, i) => (
          <label key={d} className="field">
            <span>{d}</span>
            <select value={p.schedule[i]} onChange={(e) => setP({ schedule: p.schedule.map((x, j) => (j === i ? (e.target.value as DayType) : x)) })}>
              {(Object.keys(DAY_PLANS) as DayType[]).map((t) => <option key={t} value={t}>{DAY_PLANS[t].title}</option>)}
            </select>
          </label>
        ))}
        {lowerDays < 2 && <div className="note warn small">Fewer than 2 lower-body days will make glute/thigh targets hard to reach.</div>}
        <button className="btn ghost sm" onClick={() => setP({ schedule: DEFAULT_STATE.profile.schedule })}>Reset to default</button>
      </div>

      <div className="card">
        <h3>AI coach (optional)</h3>
        <p className="small muted">Paste an Anthropic API key to let the coach answer any question with your full data. The key is stored only in this browser and sent only to the Anthropic API. Without it, the offline coach handles common questions.</p>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input type={showKey ? 'text' : 'password'} value={p.apiKey ?? ''} placeholder="sk-ant-…" onChange={(e) => setP({ apiKey: e.target.value.trim() || undefined })} />
          <button className="btn sm" onClick={() => setShowKey((s) => !s)}>{showKey ? 'Hide' : 'Show'}</button>
        </div>
      </div>

      <div className="card">
        <h3>Baseline</h3>
        <p className="small muted">Your starting silhouette (Sept 2026) is the reference for every comparison. Record new measurements in Body → Log measurements; the baseline itself stays fixed.</p>
      </div>

      <div className="card flat">
        <h3>Data</h3>
        <p className="small muted">Everything lives on this device. Export a backup regularly (photos are not included; the API key is never exported).</p>
        <div className="row">
          <button className="btn" onClick={download}>Export backup</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>Import backup</button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            try {
              const next = importState(await f.text(), state)
              update(() => next)
            } catch {
              alert('That file could not be read as a backup.')
            }
          }} />
        </div>
      </div>
    </>
  )
}
