import { useState } from 'react'
import { useAppState } from './store'
import { todayStr } from './engine/dates'
import type { Tab, ViewProps } from './ui/common'
import { Today } from './views/Today'
import { Workout } from './views/Workout'
import { Body } from './views/Body'
import { Food } from './views/Food'
import { Cycle } from './views/Cycle'
import { Coach } from './views/Coach'
import { CheckIn } from './views/CheckIn'
import { Knee } from './views/Knee'
import { Settings } from './views/Settings'

const NAV: { tab: Tab; label: string; ico: string }[] = [
  { tab: 'today', label: 'Today', ico: '◎' },
  { tab: 'workout', label: 'Train', ico: '▲' },
  { tab: 'body', label: 'Body', ico: '⧗' },
  { tab: 'food', label: 'Food', ico: '◐' },
  { tab: 'cycle', label: 'Cycle', ico: '◌' },
  { tab: 'checkin', label: 'Weekly', ico: '▦' },
  { tab: 'coach', label: 'Coach', ico: '✦' },
]

export default function App() {
  const [state, update] = useAppState()
  const [tab, setTab] = useState<Tab>('today')
  const today = todayStr()
  const go = (t: Tab) => {
    setTab(t)
    window.scrollTo({ top: 0 })
  }
  const props: ViewProps = { state, update, today, go }

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>Lower-Body Hourglass</h1>
          <div className="sub">Build the bottom · keep the top small</div>
        </div>
        <div className="row">
          <button className="btn ghost sm" onClick={() => go('knee')}>Knees</button>
          <button className="btn ghost sm" onClick={() => go('settings')} aria-label="Settings">⚙</button>
        </div>
      </header>
      <main>
        {tab === 'today' && <Today {...props} />}
        {tab === 'workout' && <Workout {...props} />}
        {tab === 'body' && <Body {...props} />}
        {tab === 'food' && <Food {...props} />}
        {tab === 'cycle' && <Cycle {...props} />}
        {tab === 'coach' && <Coach {...props} />}
        {tab === 'checkin' && <CheckIn {...props} />}
        {tab === 'knee' && <Knee {...props} />}
        {tab === 'settings' && <Settings {...props} />}
      </main>
      <nav className="tabs">
        <div className="inner">
          {NAV.map((n) => (
            <button key={n.tab} className={tab === n.tab ? 'on' : ''} onClick={() => go(n.tab)}>
              <span className="ico" aria-hidden>{n.ico}</span>
              {n.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
