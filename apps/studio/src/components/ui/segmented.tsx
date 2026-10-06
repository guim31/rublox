import { ToggleGroup } from 'radix-ui'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn.ts'

export type SegmentedOption<T extends string> = {
  value: T
  label: ReactNode
  title?: string
  icon?: ReactNode
}

/** A group of mutually exclusive choices (arrow keys move between them). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = 'md',
  className,
}: {
  value: T
  onChange: (value: T) => void
  options: SegmentedOption<T>[]
  label: string
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next as T)
      }}
      aria-label={label}
      className={cn('inline-flex items-center gap-0.5 rounded-ui bg-surface-2 p-0.5', className)}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          title={option.title}
          aria-label={option.title}
          className={cn(
            'inline-flex items-center justify-center gap-1.5 rounded-[calc(var(--radius)-2px)] px-2.5 font-strong text-muted transition-colors hover:text-text data-[state=on]:bg-surface data-[state=on]:text-text data-[state=on]:shadow-1',
            size === 'sm'
              ? 'h-[calc(var(--h-control-sm)-4px)] text-ui-sm'
              : 'h-[calc(var(--h-control)-4px)] text-ui',
          )}
        >
          {option.icon}
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}
