import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-colors active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 select-none',
  {
    variants: {
      variant: {
        default: 'bg-accent text-accent-ink hover:opacity-90',
        secondary: 'bg-surface-2 text-ink hover:bg-border',
        outline: 'border border-border bg-surface text-ink hover:bg-surface-2',
        ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
        soft: 'bg-accent-soft text-accent hover:opacity-90',
        sage: 'bg-sage-soft text-sage hover:opacity-90',
      },
      size: {
        default: 'h-11 px-5 text-sm',
        sm: 'h-9 px-3.5 text-sm',
        xs: 'h-7 px-2.5 text-xs',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10',
        'icon-sm': 'h-8 w-8',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export function Button({ className, variant, size, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
