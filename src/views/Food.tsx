import { useMemo, useState } from 'react'
import { buildToday, dayTypeFor } from '../engine/plan'
import { applyCycle, averageTargets, dayKind, dayTargets, GOAL_LABEL } from '../engine/nutrition'
import { cycleGuidance, cycleStatus, readiness } from '../engine/cycle'
import { addDays, formatDate } from '../engine/dates'
import { DAY_TYPE_LABEL } from '../data/program'
import type { FoodItem } from '../engine/types'
import { uid } from '../store'
import type { ViewProps } from '../ui/common'

/** Rough macros for quick-add. Edit after adding if your portion differs. */
const QUICK: Omit<FoodItem, 'id' | 'meal'>[] = [
  { name: 'Cottage-cheese protein pancakes (3) + berries + syrup', kcal: 450, protein: 35, carbs: 55, fat: 9 },
  { name: 'Overnight oats with whey + banana', kcal: 480, protein: 35, carbs: 65, fat: 9 },
  { name: 'Skyr (200 g) + granola + honey', kcal: 380, protein: 25, carbs: 55, fat: 6 },
  { name: '3 eggs + sourdough + feta', kcal: 450, protein: 27, carbs: 35, fat: 22 },
  { name: 'Chicken rice bowl with garlic yogurt sauce', kcal: 620, protein: 45, carbs: 75, fat: 14 },
  { name: 'Carnitas burrito bowl', kcal: 700, protein: 42, carbs: 80, fat: 22 },
  { name: 'Turkey pesto sandwich', kcal: 520, protein: 35, carbs: 50, fat: 18 },
  { name: 'Chicken pasta arrabbiata + parmesan', kcal: 680, protein: 45, carbs: 85, fat: 15 },
  { name: 'Salmon, lemon orzo, roasted veg', kcal: 650, protein: 40, carbs: 60, fat: 25 },
  { name: 'Greek yogurt + banana + honey (pre-workout)', kcal: 280, protein: 20, carbs: 45, fat: 2 },
  { name: 'Protein shake', kcal: 140, protein: 25, carbs: 4, fat: 2 },
  { name: 'Bagel + turkey + light cream cheese', kcal: 400, protein: 25, carbs: 55, fat: 8 },
  { name: 'Dessert: ice cream (1 cup)', kcal: 280, protein: 5, carbs: 32, fat: 14 },
  { name: 'Restaurant meal (estimate)', kcal: 900, protein: 40, carbs: 90, fat: 40 },
]

export function Food({ state, update, today, go }: ViewProps) {
  const plan = useMemo(() => buildToday(state, today), [state, today])
  const items = state.food[today] ?? []
  const [meal, setMeal] = useState(plan.meals.find((m) => m.name !== 'Workout')?.name ?? 'Meal')
  const [custom, setCustom] = useState({ name: '', kcal: '', protein: '', carbs: '', fat: '' })
  const tot = items.reduce((a, f) => ({ kcal: a.kcal + f.kcal, protein: a.protein + f.protein, carbs: a.carbs + f.carbs, fat: a.fat + f.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 })
  const t = plan.macros
  const add = (f: Omit<FoodItem, 'id' | 'meal'>) => update((s) => ({ ...s, food: { ...s.food, [today]: [...(s.food[today] ?? []), { ...f, id: uid(), meal }] } }))
  const remove = (id: string) => update((s) => ({ ...s, food: { ...s.food, [today]: (s.food[today] ?? []).filter((f) => f.id !== id) } }))

  const avg = averageTargets(state.profile)
  const week = avg
    ? Array.from({ length: 7 }, (_, i) => {
        const d = addDays(today, i)
        const type = dayTypeFor(state, d)
        const cs = cycleStatus(state.cycle, d)
        const g = cycleGuidance(cs, readiness(undefined))
        return { d, type, m: applyCycle(dayTargets(avg, state.profile.schedule, type), g.kcalDelta, g.carbDeltaG) }
      })
    : []

  return (
    <>
      <h2>Nutrition</h2>
      {!t ? (
        <div className="note warn">Add weight and age in <button className="btn ghost sm" onClick={() => go('settings')}>Settings</button> to calculate targets.</div>
      ) : (
        <div className="card accent">
          <div className="row between">
            <span className="eyebrow">{dayKind(plan.day.type) === 'lower' ? 'Lower-body day · highest carbs' : dayKind(plan.day.type) === 'upper' ? 'Upper maintenance day' : 'Rest / recovery day'}</span>
            <span className="pill">{GOAL_LABEL[state.profile.goalMode]}</span>
          </div>
          {(['kcal', 'protein', 'carbs', 'fat'] as const).map((k) => (
            <div key={k} style={{ margin: '8px 0' }}>
              <div className="row between small"><strong>{k === 'kcal' ? 'Calories' : k[0].toUpperCase() + k.slice(1) + ' (g)'}</strong><span>{Math.round(tot[k])} / {t[k]}</span></div>
              <div className={`bar ${tot[k] >= t[k] * 0.9 ? 'good' : ''}`}><i style={{ width: `${Math.min(100, (tot[k] / t[k]) * 100)}%` }} /></div>
            </div>
          ))}
          {plan.cycleGuide.kcalDelta > 0 && <p className="tiny muted">{plan.cycleGuide.nutrition}</p>}
          <p className="tiny muted">Protein stays the same every day. Carbs shift toward glute/leg days; weekly calories stay balanced.</p>
        </div>
      )}

      <div className="card">
        <h3>Meal timing</h3>
        <label className="field">
          <span>What time are you training?</span>
          <input type="time" value={state.profile.trainingTime} onChange={(e) => update((s) => ({ ...s, profile: { ...s.profile, trainingTime: e.target.value } }))} />
        </label>
        {plan.meals.map((m) => (
          <div key={m.name} className={`note ${m.name === 'Workout' ? 'info' : ''}`}>
            <div className="row between"><strong>{m.time} · {m.name}</strong>
              {t && m.name !== 'Workout' && <span className="tiny muted">~P {Math.round(t.protein * m.share.protein)} · C {Math.round(t.carbs * m.share.carbs)} · F {Math.round(t.fat * m.share.fat)} g</span>}
            </div>
            <div className="small">{m.focus}</div>
            {m.ideas.length > 0 && <details><summary>Ideas</summary><ul className="small" style={{ margin: 0 }}>{m.ideas.map((i) => <li key={i}>{i}</li>)}</ul></details>}
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Log food</h3>
        <label className="field">
          <span>Meal</span>
          <select value={meal} onChange={(e) => setMeal(e.target.value)}>
            {plan.meals.filter((m) => m.name !== 'Workout').map((m) => <option key={m.name}>{m.name}</option>)}
            <option>Snack</option>
          </select>
        </label>
        <details open>
          <summary>Quick add</summary>
          <div className="chips">
            {QUICK.map((q) => <button key={q.name} className="chip" onClick={() => add(q)}>{q.name} · {q.kcal}</button>)}
          </div>
        </details>
        <div className="divider" />
        <div className="grid2">
          <label className="field"><span>Food</span><input type="text" value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} /></label>
          <label className="field"><span>kcal</span><input type="number" value={custom.kcal} onChange={(e) => setCustom({ ...custom, kcal: e.target.value })} /></label>
        </div>
        <div className="grid3">
          <label className="field"><span>Protein g</span><input type="number" value={custom.protein} onChange={(e) => setCustom({ ...custom, protein: e.target.value })} /></label>
          <label className="field"><span>Carbs g</span><input type="number" value={custom.carbs} onChange={(e) => setCustom({ ...custom, carbs: e.target.value })} /></label>
          <label className="field"><span>Fat g</span><input type="number" value={custom.fat} onChange={(e) => setCustom({ ...custom, fat: e.target.value })} /></label>
        </div>
        <button className="btn primary" disabled={!custom.name} onClick={() => {
          add({ name: custom.name, kcal: +custom.kcal || 0, protein: +custom.protein || 0, carbs: +custom.carbs || 0, fat: +custom.fat || 0 })
          setCustom({ name: '', kcal: '', protein: '', carbs: '', fat: '' })
        }}>Add</button>

        {items.length > 0 && (
          <table className="data" style={{ marginTop: 10 }}>
            <thead><tr><th>Food</th><th className="num">kcal</th><th className="num">P</th><th className="num">C</th><th className="num">F</th><th /></tr></thead>
            <tbody>
              {items.map((f) => (
                <tr key={f.id}>
                  <td><div>{f.name}</div><div className="tiny muted">{f.meal}</div></td>
                  <td className="num">{f.kcal}</td><td className="num">{f.protein}</td><td className="num">{f.carbs}</td><td className="num">{f.fat}</td>
                  <td><button className="btn ghost sm" onClick={() => remove(f.id)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {week.length > 0 && (
        <div className="card flat">
          <h4>Week ahead</h4>
          <table className="data">
            <thead><tr><th>Day</th><th>Session</th><th className="num">kcal</th><th className="num">C</th><th className="num">F</th></tr></thead>
            <tbody>
              {week.map((w) => (
                <tr key={w.d}><td>{formatDate(w.d)}</td><td className="small">{DAY_TYPE_LABEL[w.type]}</td><td className="num">{w.m.kcal}</td><td className="num">{w.m.carbs}</td><td className="num">{w.m.fat}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="tiny muted">Protein: {avg?.protein} g every day. Restaurant meals, sauces and desserts all fit — the weekly balance matters most.</p>
        </div>
      )}
    </>
  )
}
