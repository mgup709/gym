import { useMemo } from 'react'
import { buildToday } from '../engine/plan'
import { nextMeal } from '../engine/nutrition'
import { PHASE_LABEL } from '../engine/cycle'
import { DAY_PLANS, DAY_TYPE_LABEL } from '../data/program'
import { CORE_BY_ID } from '../data/core'
import { addDays, formatDate } from '../engine/dates'
import { dayTypeFor } from '../engine/plan'
import type { ViewProps } from '../ui/common'

const KNEE_PILL = { good: ['good', 'Good'], mild: ['warn', 'Mild symptoms'], modify: ['bad', 'Modify today'] } as const

export function Today({ state, update, today, go }: ViewProps) {
  const plan = useMemo(() => buildToday(state, today), [state, today])
  const meal = nextMeal(plan.meals, new Date())
  const eaten = (state.food[today] ?? []).reduce((a, f) => ({ kcal: a.kcal + f.kcal, p: a.p + f.protein, c: a.c + f.carbs, f: a.f + f.fat }), { kcal: 0, p: 0, c: 0, f: 0 })
  const steps = state.steps[today] ?? 0
  const [kp, kl] = KNEE_PILL[plan.knee.status]
  const started = state.sessions.some((s) => s.date === today)

  return (
    <>
      <div className="card accent">
        <div className="row between">
          <span className="eyebrow">Today · {formatDate(today)}</span>
          {state.cycle.enabled && plan.cycle.phase !== 'unknown' && (
            <span className="pill accent" title="Cycle phase">
              {PHASE_LABEL[plan.cycle.phase]}{plan.cycle.cycleDay ? ` · day ${plan.cycle.cycleDay}` : ''}
            </span>
          )}
        </div>
        <div className="big" style={{ marginTop: 4 }}>{plan.day.title}</div>
        <p className="muted"><strong>Primary objective:</strong> {plan.day.objective}</p>
        <div className="row" style={{ marginTop: 6 }}>
          <span className={`pill ${kp}`}>Knee: {kl}</span>
          {plan.cycleGuide.holdProgression && <span className="pill warn">Hold progression today</span>}
          {plan.cycle.retentionWindow && <span className="pill info">Water-retention window</span>}
        </div>
      </div>

      <div className="actions">
        {plan.day.isTraining || plan.core.length ? (
          <button className="btn primary" onClick={() => go('workout')}>{started ? 'CONTINUE WORKOUT' : 'START WORKOUT'}</button>
        ) : null}
        <button className="btn" onClick={() => go('food')}>LOG FOOD</button>
        <button className="btn" onClick={() => go('body')}>LOG MEASUREMENTS</button>
        <button className="btn" onClick={() => go('knee')}>KNEE CHECK-IN</button>
        <button className="btn" onClick={() => go('coach')}>ASK COACH</button>
      </div>

      <div className="card">
        <h3>Nutrition</h3>
        {plan.macros ? (
          <>
            <div className="grid4">
              <Stat label="Calories" value={`${eaten.kcal} / ${plan.macros.kcal}`} />
              <Stat label="Protein (g)" value={`${eaten.p} / ${plan.macros.protein}`} />
              <Stat label="Carbs (g)" value={`${eaten.c} / ${plan.macros.carbs}`} />
              <Stat label="Fat (g)" value={`${eaten.f} / ${plan.macros.fat}`} />
            </div>
            {plan.cycleGuide.kcalDelta > 0 && <p className="tiny muted">Includes +{plan.cycleGuide.kcalDelta} kcal for your cycle phase.</p>}
          </>
        ) : (
          <p className="small">Add your weight and age in <button className="btn ghost sm" onClick={() => go('settings')}>Settings</button> to calculate calories and macros.</p>
        )}
        {meal && (
          <div className="note info">
            <strong>Next meal: {meal.name}</strong> · {meal.time}<br />
            Suggested: {meal.focus}.{meal.ideas[0] ? ` e.g. ${meal.ideas[0]}.` : ''}
          </div>
        )}
      </div>

      {plan.day.isTraining && (
        <div className="card">
          <h3>Workout</h3>
          <ol className="small" style={{ margin: 0, paddingLeft: 20 }}>
            {plan.exercises.map((e) => (
              <li key={e.slot.slotId}>
                <strong>{e.exercise.name}</strong> — {e.slot.sets}×{e.slot.repRange.join('–')}
                <span className="muted"> · {e.slot.slotPurpose}</span>
                {e.substitution && <span className="pill info" style={{ marginLeft: 6 }}>swapped</span>}
              </li>
            ))}
            {plan.core.length > 0 && <li><strong>Deep core</strong> — {plan.core.map((c) => CORE_BY_ID[c.moveId].name).join(', ')}</li>}
          </ol>
        </div>
      )}
      {!plan.day.isTraining && (
        <div className="card flat">
          <p className="small">{plan.day.objective}</p>
          {plan.core.length > 0 && <p className="small">Deep core today: {plan.core.map((c) => c.levelName).join(' · ')}</p>}
        </div>
      )}

      <div className="card">
        <div className="row between">
          <h3 style={{ margin: 0 }}>Steps</h3>
          <span className="small muted">{steps.toLocaleString()} / {state.profile.stepTarget.toLocaleString()}</span>
        </div>
        <div className={`bar ${steps >= state.profile.stepTarget ? 'good' : ''}`} style={{ margin: '8px 0' }}>
          <i style={{ width: `${Math.min(100, (steps / state.profile.stepTarget) * 100)}%` }} />
        </div>
        <input
          type="number" inputMode="numeric" placeholder="Enter today's steps" value={state.steps[today] ?? ''}
          onChange={(e) => update((s) => ({ ...s, steps: { ...s.steps, [today]: Number(e.target.value) || 0 } }))}
        />
      </div>

      <div className="card">
        <h3>Knee status</h3>
        <p className="small">{plan.knee.message}</p>
        {plan.knee.seeProfessional && <div className="note bad">{plan.knee.seeProfessional}</div>}
      </div>

      {state.cycle.enabled && plan.cycle.phase !== 'unknown' && (
        <div className="card">
          <h3>Cycle sync</h3>
          <p className="small">{plan.cycleGuide.training}</p>
          {plan.cycleGuide.knee && <p className="small">{plan.cycleGuide.knee}</p>}
          <p className="small muted">{plan.cycleGuide.measurement}</p>
          <button className="btn sm" onClick={() => go('cycle')}>Log symptoms</button>
        </div>
      )}

      <div className="card flat">
        <h4>This week</h4>
        <div className="small">
          {Array.from({ length: 7 }, (_, i) => addDays(today, i)).map((d) => {
            const t = dayTypeFor(state, d)
            return (
              <div key={d} className="row between">
                <span>{formatDate(d)}</span>
                <span className={DAY_PLANS[t].isLowerBody ? '' : 'muted'}>{DAY_TYPE_LABEL[t]}</span>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="v">{value}</div>
      <div className="l">{label}</div>
    </div>
  )
}
