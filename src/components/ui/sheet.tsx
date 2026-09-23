import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Bottom sheet on phones, centered dialog on larger screens. */
export function Sheet({ open, onClose, title, children, footer, className }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; className?: string }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="anim-fade absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cn('anim-sheet relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-surface shadow-2xl sm:rounded-3xl', className)}>
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
          <div className="min-w-0 font-display text-xl leading-tight">{title}</div>
          <button onClick={onClose} className="-mr-2 rounded-full p-2 text-ink-3 hover:bg-surface-2" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="pb-safe border-t border-border px-5 pt-3 pb-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
