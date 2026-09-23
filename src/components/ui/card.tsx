import type { HTMLAttributes, ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-3xl border border-border bg-surface p-4 sm:p-5', className)} {...props} />
}

export function CardHeader({ title, subtitle, action, className }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-3 flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="text-[13px] font-semibold tracking-wide text-ink-2 uppercase">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-ink-3">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

/** Expandable section (used for long-term data so it never crowds the screen). */
export function Section({ title, subtitle, children, defaultOpen = false, className }: { title: ReactNode; subtitle?: ReactNode; children: ReactNode; defaultOpen?: boolean; className?: string }) {
  return (
    <details open={defaultOpen} className={cn('group rounded-3xl border border-border bg-surface', className)}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <div className="font-display text-lg leading-tight">{title}</div>
          {subtitle && <div className="mt-0.5 text-sm text-ink-3">{subtitle}</div>}
        </div>
        <ChevronDown className="size-5 shrink-0 text-ink-3 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-4 px-4 pb-5 sm:px-5">{children}</div>
    </details>
  )
}

export function Pill({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'sage' | 'amber'; className?: string }) {
  const tones = {
    neutral: 'bg-surface-2 text-ink-2',
    accent: 'bg-accent-soft text-accent',
    sage: 'bg-sage-soft text-sage',
    amber: 'bg-amber-soft text-amber',
  }
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', tones[tone], className)}>{children}</span>
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-ink-3">{children}</p>
}
