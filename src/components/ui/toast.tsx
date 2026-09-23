import { useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'

// Tiny toast store with an optional Undo action (every accidental log can be undone).
interface Toast {
  id: number
  text: string
  undo?: () => void | Promise<void>
}

let toasts: Toast[] = []
const subs = new Set<() => void>()
let seq = 0
const emit = () => subs.forEach((f) => f())

export function toast(text: string, undo?: Toast['undo'], ms = 5000) {
  const t = { id: ++seq, text, undo }
  toasts = [...toasts.slice(-1), t]
  emit()
  setTimeout(() => dismiss(t.id), ms)
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

export function Toaster() {
  const list = useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => toasts,
  )
  if (!list.length) return null
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-[calc(12px+env(safe-area-inset-top))] z-[60] flex flex-col items-center gap-2 px-4">
      {list.map((t) => (
        <div key={t.id} className="anim-sheet pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-bg shadow-lg">
          <span className="min-w-0 truncate">{t.text}</span>
          {t.undo && (
            <button
              className="shrink-0 font-semibold text-accent-soft underline-offset-2 hover:underline"
              onClick={async () => {
                dismiss(t.id)
                await t.undo!()
              }}
            >
              Undo
            </button>
          )}
        </div>
      ))}
    </div>,
    document.body,
  )
}
