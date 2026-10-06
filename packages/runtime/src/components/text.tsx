import { cssColor } from '../theme.ts'
import { type Renderer, rootAttributes } from './types.ts'

const ALIGN = { start: 'left', center: 'center', end: 'right' } as const

export const TextRenderer: Renderer = (p) => (
  // biome-ignore lint/a11y/noStaticElementInteractions: a text can be made clickable by blocks
  // biome-ignore lint/a11y/useKeyWithClickEvents: same
  <div
    {...rootAttributes(p, 'Text')}
    className="rx-text"
    style={{
      fontSize: Number(p.props.fontSize) || 16,
      color: cssColor(p.props.color) ?? 'var(--rx-text)',
      fontWeight: p.props.bold === true ? 700 : 400,
      fontStyle: p.props.italic === true ? 'italic' : 'normal',
      textAlign: ALIGN[p.props.align as keyof typeof ALIGN] ?? 'left',
      ...p.style,
    }}
    onClick={p.design ? undefined : () => p.emit('click')}
  >
    {String(p.props.text ?? '')}
  </div>
)
