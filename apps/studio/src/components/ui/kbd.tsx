import type { ReactNode } from 'react'
import { cn } from '../../lib/cn.ts'

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/** `Mod+K` → `⌘K` on a Mac, `Ctrl+K` elsewhere. */
export function shortcutLabel(shortcut: string): string {
  return shortcut.replace('Mod', isMac ? '⌘' : 'Ctrl').replace('Shift', isMac ? '⇧' : 'Maj')
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 items-center rounded border border-border bg-surface-2 px-1.5 font-mono text-[11px] text-muted',
        className,
      )}
    >
      {typeof children === 'string' ? shortcutLabel(children) : children}
    </kbd>
  )
}
