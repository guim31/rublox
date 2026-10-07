import { Link, type LinkProps } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { buttonClasses } from './button.tsx'

/**
 * A link that looks like a button: one element, one stop of the keyboard. A `Button` inside
 * a `Link` would be two nested controls (WCAG 4.1.2).
 */
export function LinkButton({
  variant,
  size,
  icon,
  className,
  children,
  ...link
}: LinkProps & {
  variant?: Parameters<typeof buttonClasses>[0]
  size?: Parameters<typeof buttonClasses>[1]
  icon?: ReactNode
  className?: string
  children?: ReactNode
  onClick?: () => void
}) {
  return (
    <Link {...link} className={buttonClasses(variant, size, className)}>
      {icon}
      {children}
    </Link>
  )
}
