import { forwardRef, useEffect, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export const inputClass =
  'h-11 w-full rounded-2xl border border-border bg-surface px-3.5 text-base text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none sm:text-sm'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(inputClass, className)} {...p} />
})

export function Textarea({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputClass, 'h-auto min-h-20 py-2.5', className)} {...p} />
}

export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputClass, 'appearance-none pr-8', className)} {...p}>
      {children}
    </select>
  )
}

export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-sm font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  )
}

/** Numeric input that stores `null` for empty. Keeps its own text so partial input like "0." survives. */
export function NumInput({ value, onChange, step = 'any', className, ...p }: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: number | null | undefined; onChange: (v: number | null) => void }) {
  const [text, setText] = useState(value == null ? '' : String(value))
  useEffect(() => {
    const cur = text === '' ? null : Number(text)
    if (cur !== (value ?? null)) setText(value == null ? '' : String(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <Input
      type="number"
      inputMode="decimal"
      step={step}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        const v = e.target.value === '' ? null : Number(e.target.value)
        if (v == null || !Number.isNaN(v)) onChange(v)
      }}
      onFocus={(e) => e.target.select()}
      className={className}
      {...p}
    />
  )
}
