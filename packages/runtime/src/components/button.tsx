import { useRef } from 'react'
import { cssColor, textOn } from '../theme.ts'
import { type Renderer, rootAttributes } from './types.ts'

const LONG_PRESS_MS = 500

/** The text on a fill of a theme color, worked out with the theme (`themeVariables`). */
const ON_THEME: Record<string, string> = {
  'var(--rx-primary)': 'var(--rx-on-primary)',
  'var(--rx-secondary)': 'var(--rx-on-secondary)',
}

export const ButtonRenderer: Renderer = (p) => {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const longPressed = useRef(false)
  const own = cssColor(p.props.color)
  const color = own ?? 'var(--rx-primary)'
  const variant = p.props.variant
  const filled = variant === 'filled'
  // Readable by default (WCAG 1.4.3): white or near black on the fill; as text, the primary
  // made readable on the background. A text color chosen in the inspector wins.
  const text =
    cssColor(p.props.textColor) ??
    (filled
      ? (ON_THEME[color] ?? textOn(color))
      : color === 'var(--rx-primary)'
        ? 'var(--rx-primary-text)'
        : color)
  const disabled = p.props.disabled === true
  return (
    <button
      {...rootAttributes(p, 'Button')}
      type="button"
      className="rx-button"
      disabled={disabled && !p.design}
      aria-disabled={disabled || undefined}
      style={{
        background: filled ? color : 'transparent',
        color: text,
        border: variant === 'outline' ? `2px solid ${color}` : '2px solid transparent',
        fontSize: Number(p.props.fontSize) || 16,
        ...p.style,
        opacity: disabled ? 0.5 : p.style.opacity,
      }}
      onClick={() => {
        if (p.design) return
        if (longPressed.current) {
          longPressed.current = false
          return
        }
        p.emit('click')
      }}
      onPointerDown={() => {
        if (p.design) return
        longPressed.current = false
        timer.current = setTimeout(() => {
          longPressed.current = true
          p.emit('longPress')
        }, LONG_PRESS_MS)
      }}
      onPointerUp={() => clearTimeout(timer.current)}
      onPointerLeave={() => clearTimeout(timer.current)}
    >
      {String(p.props.text ?? '')}
    </button>
  )
}
