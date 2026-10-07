import { AppIcon } from '../icons.tsx'
import { cssColor } from '../theme.ts'
import { type Renderer, rootAttributes } from './types.ts'

export const IconRenderer: Renderer = (p) => {
  const label = String(p.props.label ?? '')
  const size = Number(p.props.size) || 32
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: an icon can be made clickable by blocks
    // biome-ignore lint/a11y/useKeyWithClickEvents: same
    <div
      {...rootAttributes(p, 'Icon')}
      className="rx-icon"
      style={{ color: cssColor(p.props.color) ?? 'var(--rx-primary)', ...p.style }}
      onClick={p.design ? undefined : () => p.emit('click')}
    >
      <AppIcon
        name={String(p.props.icon ?? '')}
        size={size}
        strokeWidth={Number(p.props.strokeWidth) || 2}
        label={label}
      />
    </div>
  )
}
