import type { ReactNode } from 'react'
import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels'
import { cn } from '../../lib/cn.ts'

/** A resizable group whose layout is remembered in this browser (SPEC § 5.3). */
export function PanelGroup({
  id,
  orientation = 'horizontal',
  children,
  className,
}: {
  id: string
  orientation?: 'horizontal' | 'vertical'
  children: ReactNode
  className?: string
}) {
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: `rublox:${id}`,
    storage: localStorage,
  })
  return (
    <Group
      id={id}
      orientation={orientation}
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
      className={cn('min-h-0 min-w-0', className)}
    >
      {children}
    </Group>
  )
}

export { Panel }

export function ResizeHandle({
  orientation = 'horizontal',
}: {
  orientation?: 'horizontal' | 'vertical'
}) {
  return (
    <Separator
      className={cn(
        'group relative shrink-0 bg-border outline-none transition-colors data-[separator=hover]:bg-primary/60 data-[separator=active]:bg-primary focus-visible:bg-primary',
        orientation === 'horizontal' ? 'w-px' : 'h-px',
      )}
    />
  )
}
