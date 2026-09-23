import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { db } from './db'
import { todayISO, nowHM } from './dates'
import { periodStarts, cycleInfo } from './cycle'
import type { ISODate, Settings } from './types'

export function useSettings(): Settings | undefined {
  return useLiveQuery(() => db.settings.get('profile'), [])
}

/** Today's date; refreshes when the app comes back to the foreground or a minute ticks over midnight. */
export function useToday(): ISODate {
  const [d, setD] = useState(todayISO)
  useEffect(() => {
    const tick = () => setD(todayISO())
    const id = setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])
  return d
}

export function useNow(): string {
  const [t, setT] = useState(nowHM)
  useEffect(() => {
    const id = setInterval(() => setT(nowHM()), 30_000)
    return () => clearInterval(id)
  }, [])
  return t
}

export function useCycle(date: ISODate, settings: Settings | undefined) {
  const days = useLiveQuery(() => db.cycle.toArray(), [])
  if (!settings || !days) return null
  return cycleInfo(date, periodStarts(days, settings), settings)
}

// ── Hash router ──────────────────────────────────────────
export interface Route {
  path: string[]
  query: URLSearchParams
}

function parse(): Route {
  const h = location.hash.replace(/^#\/?/, '')
  const [p, q] = h.split('?')
  return { path: p ? p.split('/') : ['today'], query: new URLSearchParams(q ?? '') }
}

let current = parse()
const listeners = new Set<() => void>()
window.addEventListener('hashchange', () => {
  current = parse()
  listeners.forEach((l) => l())
})

export function useRoute(): Route {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f)
      return () => listeners.delete(f)
    },
    () => current,
  )
}

export function navigate(to: string, replace = false) {
  const hash = `#/${to.replace(/^\//, '')}`
  if (replace) history.replaceState(null, '', hash)
  else history.pushState(null, '', hash)
  current = parse()
  listeners.forEach((l) => l())
  window.scrollTo({ top: 0 })
}

// ── Theme ────────────────────────────────────────────────
export function applyTheme(theme: Settings['theme']) {
  try {
    localStorage.setItem('taper-theme', JSON.stringify(theme))
  } catch {
    /* ignore */
  }
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  document.querySelector('meta[name="theme-color"]:not([media])')?.setAttribute('content', dark ? '#131211' : '#f7f5f2')
}
