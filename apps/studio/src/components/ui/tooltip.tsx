import { Tooltip as Radix } from 'radix-ui'
import type { ReactNode } from 'react'
import { Kbd } from './kbd.tsx'

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <Radix.Provider delayDuration={350} skipDelayDuration={200}>
      {children}
    </Radix.Provider>
  )
}

export function Tooltip({
  content,
  shortcut,
  side = 'bottom',
  children,
}: {
  content: ReactNode
  shortcut?: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  children: ReactNode
}) {
  return (
    <Radix.Root>
      <Radix.Trigger asChild>{children}</Radix.Trigger>
      <Radix.Portal>
        <Radix.Content
          side={side}
          sideOffset={6}
          className="z-50 flex max-w-72 items-center gap-2 rounded-md bg-text px-2 py-1 text-ui-sm text-bg shadow-2 rx-anim-in"
        >
          {content}
          {shortcut ? (
            <Kbd className="border-transparent bg-white/15 text-inherit">{shortcut}</Kbd>
          ) : null}
        </Radix.Content>
      </Radix.Portal>
    </Radix.Root>
  )
}
