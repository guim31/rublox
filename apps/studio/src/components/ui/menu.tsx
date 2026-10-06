import { DropdownMenu } from 'radix-ui'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn.ts'

export const Menu = DropdownMenu.Root
export const MenuTrigger = DropdownMenu.Trigger

export function MenuContent({
  children,
  align = 'end',
}: {
  children: ReactNode
  align?: 'start' | 'end' | 'center'
}) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={6}
        className="z-50 min-w-48 rounded-ui-lg border border-border bg-surface p-1 shadow-2 rx-anim-in"
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  )
}

export function MenuItem({
  children,
  icon,
  onSelect,
  danger,
  disabled,
  shortcut,
}: {
  children: ReactNode
  icon?: ReactNode
  onSelect?: () => void
  danger?: boolean
  disabled?: boolean
  shortcut?: ReactNode
}) {
  return (
    <DropdownMenu.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        'flex h-control cursor-pointer select-none items-center gap-2.5 rounded-[calc(var(--radius)-2px)] px-2.5 text-ui outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-surface-2 data-[disabled]:opacity-45',
        danger && 'text-danger',
      )}
    >
      <span className="grid w-4 place-items-center text-muted">{icon}</span>
      <span className="flex-1">{children}</span>
      {shortcut ? <span className="text-ui-sm text-muted">{shortcut}</span> : null}
    </DropdownMenu.Item>
  )
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-border" />
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <DropdownMenu.Label className="px-2.5 py-1.5 text-ui-sm text-muted">
      {children}
    </DropdownMenu.Label>
  )
}
