import { useLiveQuery } from 'dexie-react-hooks'
import { Dumbbell, LineChart, Settings as Cog, Sun, UtensilsCrossed } from 'lucide-react'
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { Toaster } from '@/components/ui/toast'
import { db, requestPersistence } from '@/lib/db'
import { applyTheme, navigate, useRoute, useSettings } from '@/lib/hooks'
import { ensureSeeded } from '@/lib/seed'
import { cn } from '@/lib/utils'
import { isCheckInDue } from '@/lib/checkin'
import { FoodView } from '@/views/Food'
import { SetupView } from '@/views/Setup'
import { TodayView } from '@/views/Today'
import { useToday } from '@/lib/hooks'

// Chart-heavy screens load on demand so Today and Food open instantly.
const WorkoutView = lazy(() => import('@/views/Workout').then((m) => ({ default: m.WorkoutView })))
const ProgressView = lazy(() => import('@/views/Progress').then((m) => ({ default: m.ProgressView })))
const CheckInView = lazy(() => import('@/views/CheckIn').then((m) => ({ default: m.CheckInView })))
const SettingsView = lazy(() => import('@/views/Settings').then((m) => ({ default: m.SettingsView })))

const TABS: { key: string; label: string; icon: ReactNode }[] = [
  { key: 'today', label: 'Today', icon: <Sun className="size-5" /> },
  { key: 'food', label: 'Food', icon: <UtensilsCrossed className="size-5" /> },
  { key: 'workout', label: 'Workout', icon: <Dumbbell className="size-5" /> },
  { key: 'progress', label: 'Progress', icon: <LineChart className="size-5" /> },
  { key: 'settings', label: 'Settings', icon: <Cog className="size-5" /> },
]

export default function App() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    ensureSeeded()
      .then(() => setReady(true))
      .catch((e) => setError(String(e)))
    requestPersistence()
  }, [])
  const settings = useSettings()
  const route = useRoute()
  const today = useToday()
  const measurements = useLiveQuery(() => db.measurements.toArray(), [])
  useEffect(() => {
    if (settings) applyTheme(settings.theme)
  }, [settings?.theme]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!settings?.notifications.browser || !measurements || !('Notification' in window) || Notification.permission !== 'granted') return
    if (!isCheckInDue(settings, measurements, today)) return
    try {
      if (localStorage.getItem('taper-notified') === today) return
      localStorage.setItem('taper-notified', today)
      new Notification('Weekly check-in', { body: 'Measurements and this week’s recommendation — about 2 minutes.', icon: './icons/icon-192.png' })
    } catch {
      /* ignore */
    }
  }, [settings, measurements, today])

  if (error)
    return (
      <div className="mx-auto max-w-md p-6 text-sm">
        <p className="font-medium">The app couldn't open its local database.</p>
        <p className="mt-2 text-ink-3">{error}</p>
        <p className="mt-2 text-ink-3">Private browsing can block storage — try a normal window.</p>
      </div>
    )
  if (!ready || !settings) return null
  if (!settings.setupDone) return <SetupView settings={settings} />

  const tab = route.path[0]
  // The weekly check-in shows as a small dot on Progress — never as a prompt on Today.
  const due = settings.notifications.weeklyCheckIn && measurements ? isCheckInDue(settings, measurements, today) : false

  let view: ReactNode
  switch (tab) {
    case 'food':
      view = <FoodView />
      break
    case 'workout':
      view = <WorkoutView />
      break
    case 'progress':
      view = <ProgressView />
      break
    case 'checkin':
      view = <CheckInView />
      break
    case 'settings':
      view = <SettingsView />
      break
    default:
      view = <TodayView />
  }
  const activeTab = tab === 'checkin' ? 'progress' : TABS.some((t) => t.key === tab) ? tab : 'today'

  return (
    <div className="pt-safe min-h-dvh">
      <main className="mx-auto max-w-xl px-4 pb-[calc(96px+env(safe-area-inset-bottom))]"><Suspense fallback={null}>{view}</Suspense></main>
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/90 backdrop-blur-lg">
        <div className="mx-auto grid max-w-xl grid-cols-5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => navigate(t.key)}
              className={cn('relative flex flex-col items-center gap-0.5 pt-2.5 pb-2 text-[11px] font-medium transition-colors', activeTab === t.key ? 'text-accent' : 'text-ink-3')}
              aria-current={activeTab === t.key ? 'page' : undefined}
            >
              {t.icon}
              {t.label}
              {t.key === 'progress' && due && <span className="absolute top-2 left-1/2 ml-2.5 size-2 rounded-full bg-accent" aria-label="Weekly check-in due" />}
            </button>
          ))}
        </div>
      </nav>
      <Toaster />
    </div>
  )
}
