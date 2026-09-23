import { useCallback, useEffect, useState } from 'react'
import { BASELINE } from './data/baseline'
import { DEFAULT_SCHEDULE } from './data/program'
import type { AppState } from './engine/types'

const KEY = 'lbd-hourglass-v1'

export const DEFAULT_STATE: AppState = {
  version: 1,
  profile: {
    heightIn: 66,
    goalMode: 'recomp',
    trainingTime: '17:00',
    stepTarget: 8000,
    schedule: DEFAULT_SCHEDULE,
  },
  baseline: BASELINE,
  measurements: [],
  sessions: [],
  kneeCheckins: [],
  preferences: {},
  substitutions: {},
  food: {},
  steps: {},
  checkins: [],
  cycle: { enabled: true, periodStarts: [], cycleLength: 28, periodLength: 5, hormonalContraception: false, symptoms: {} },
  coreLevels: {},
  kneeResets: {},
  coach: [],
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_STATE
    const parsed = JSON.parse(raw) as Partial<AppState>
    return {
      ...DEFAULT_STATE,
      ...parsed,
      profile: { ...DEFAULT_STATE.profile, ...parsed.profile },
      cycle: { ...DEFAULT_STATE.cycle, ...parsed.cycle },
    }
  } catch {
    return DEFAULT_STATE
  }
}

export type Update = (fn: (s: AppState) => AppState) => void

export function useAppState(): [AppState, Update] {
  const [state, setState] = useState<AppState>(load)
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* storage unavailable — state lives in memory for this visit */
    }
  }, [state])
  const update = useCallback<Update>((fn) => setState((s) => fn(s)), [])
  return [state, update]
}

export function exportState(state: AppState): string {
  const { profile, ...rest } = state
  // Never export the API key.
  return JSON.stringify({ ...rest, profile: { ...profile, apiKey: undefined } }, null, 2)
}

export function importState(json: string, current: AppState): AppState {
  const parsed = JSON.parse(json) as Partial<AppState>
  return {
    ...DEFAULT_STATE,
    ...parsed,
    profile: { ...DEFAULT_STATE.profile, ...parsed.profile, apiKey: current.profile.apiKey },
    cycle: { ...DEFAULT_STATE.cycle, ...parsed.cycle },
  }
}

export const uid = () => Math.random().toString(36).slice(2, 10)
