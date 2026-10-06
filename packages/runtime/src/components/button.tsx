import { useRef } from 'react'
import { cssColor } from '../theme.ts'
import { type Renderer, rootAttributes } from './types.ts'

const LONG_PRESS_MS = 500

export const ButtonRenderer: Renderer = (p) => {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const longPressed = useRef(false)
  const color = cssColor(p.props.color) ?? 'var(--rx-primary)'
  const variant = p.props.variant
  const filled = variant === 'filled'
  const text = cssColor(p.props.textColor) ?? (filled ? 'var(--rx-on-primary)' : color)
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
