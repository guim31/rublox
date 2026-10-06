import type { ReactNode } from 'react'
import { cn } from '../../lib/cn.ts'

/** A labelled form field with an optional hint and error, wired for screen readers. */
export function Field({
  id,
  label,
  hint,
  error,
  children,
  className,
}: {
  id: string
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-ui-sm font-strong">
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-ui-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-ui-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** `aria-describedby` for an input inside `Field`. */
export function describedBy(id: string, hint?: unknown, error?: unknown): string | undefined {
  const ids = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean)
  return ids.length ? ids.join(' ') : undefined
}

/** A titled block of a settings page. */
export function Section({
  title,
  description,
  children,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  actions?: ReactNode
}) {
  return (
    <section className="rounded-ui-lg border border-border bg-surface p-5 shadow-1 junior:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-ui-lg font-strong">{title}</h2>
          {description ? <p className="mt-0.5 text-ui-sm text-muted">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  )
}

/** A small rounded label (role, status). */
export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger'
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-ui-sm font-strong',
        tone === 'neutral' && 'bg-surface-2 text-muted',
        tone === 'primary' && 'bg-primary-soft text-primary-text',
        tone === 'success' && 'bg-mint-soft text-text',
        tone === 'warning' && 'bg-yellow-soft text-text',
        tone === 'danger' && 'bg-coral-soft text-text',
      )}
    >
      {children}
    </span>
  )
}
