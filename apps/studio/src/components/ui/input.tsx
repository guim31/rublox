import type { InputHTMLAttributes, Ref, SelectHTMLAttributes } from 'react'
import { cn } from '../../lib/cn.ts'

const FIELD =
  'h-control w-full min-w-0 rounded-ui border border-border bg-surface px-2.5 text-ui text-text placeholder:text-muted outline-none transition-[border,box-shadow] hover:border-border-strong focus:border-primary focus:ring-3 focus:ring-primary/20 disabled:opacity-50'

export function Input({
  className,
  ref,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} className={cn(FIELD, className)} {...rest} />
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(FIELD, 'cursor-pointer pr-7', className)} {...rest}>
      {children}
    </select>
  )
}

export const fieldClass = FIELD
