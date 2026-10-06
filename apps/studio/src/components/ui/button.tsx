import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { cn } from '../../lib/cn.ts'
import { Tooltip } from './tooltip.tsx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'
type Size = 'md' | 'sm' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover shadow-1',
  secondary:
    'bg-surface text-text border border-border hover:bg-surface-2 hover:border-border-strong',
  ghost: 'text-text hover:bg-surface-2',
  soft: 'bg-primary-soft text-primary-text hover:brightness-95 dark:hover:brightness-125',
  danger: 'bg-danger text-white hover:brightness-110',
}

const SIZES: Record<Size, string> = {
  sm: 'h-control-sm px-2.5 text-ui-sm gap-1.5',
  md: 'h-control px-3 junior:px-4 text-ui gap-2',
  lg: 'h-[calc(var(--h-control)+8px)] px-5 text-ui-lg gap-2',
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  ref?: Ref<HTMLButtonElement>
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-ui font-strong transition-[background,color,border,filter,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  shortcut?: string
  variant?: Variant
  size?: Size
  active?: boolean
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right'
  ref?: Ref<HTMLButtonElement>
}

/** A square button with an icon only: its label is the accessible name and the tooltip. */
export function IconButton({
  label,
  shortcut,
  variant = 'ghost',
  size = 'md',
  active,
  tooltipSide,
  className,
  children,
  ...rest
}: IconButtonProps) {
  return (
    <Tooltip content={label} shortcut={shortcut} side={tooltipSide}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-ui transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40',
          VARIANTS[variant],
          size === 'sm' ? 'size-control-sm' : 'size-control',
          active && 'bg-primary-soft text-primary-text',
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    </Tooltip>
  )
}
