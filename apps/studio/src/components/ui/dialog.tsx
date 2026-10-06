import { X } from 'lucide-react'
import { Dialog as Radix } from 'radix-ui'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn.ts'

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <Radix.Root open={open} onOpenChange={onOpenChange}>
      <Radix.Portal>
        <Radix.Overlay className="fixed inset-0 z-40 bg-overlay rx-anim-in" />
        <Radix.Content
          className={cn(
            'fixed top-1/2 left-1/2 z-50 w-[min(92vw,460px)] -translate-x-1/2 -translate-y-1/2 rounded-ui-lg border border-border bg-surface p-5 junior:p-7 shadow-3 animate-[rx-pop_180ms_ease-out]',
            className,
          )}
          aria-describedby={description ? undefined : undefined}
        >
          <Radix.Title className="pr-8 text-ui-lg font-strong">{title}</Radix.Title>
          {description ? (
            <Radix.Description className="mt-1 text-muted">{description}</Radix.Description>
          ) : (
            <Radix.Description className="sr-only">{title}</Radix.Description>
          )}
          <div className="mt-4">{children}</div>
          <Radix.Close
            className="absolute top-3 right-3 grid size-control-sm place-items-center rounded-ui text-muted hover:bg-surface-2 hover:text-text"
            aria-label={t('common.close')}
          >
            <X size={18} />
          </Radix.Close>
        </Radix.Content>
      </Radix.Portal>
    </Radix.Root>
  )
}
