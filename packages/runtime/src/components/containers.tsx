import { flexStyle } from '../styles.ts'
import { cssColor } from '../theme.ts'
import { type Renderer, rootAttributes } from './types.ts'

export const ScreenRenderer: Renderer = (p) => (
  <div
    {...rootAttributes(p, 'Screen')}
    className="rx-screen"
    style={{
      ...p.style,
      ...flexStyle(p.props, 'column'),
      minHeight: '100%',
      overflowY: p.props.scroll === false ? 'hidden' : 'auto',
      color: 'var(--rx-text)',
    }}
  >
    {p.children}
  </div>
)

export const RowRenderer: Renderer = (p) => (
  <div {...rootAttributes(p, 'Row')} style={{ ...flexStyle(p.props, 'row'), ...p.style }}>
    {p.children}
  </div>
)

export const ColumnRenderer: Renderer = (p) => (
  <div {...rootAttributes(p, 'Column')} style={{ ...flexStyle(p.props, 'column'), ...p.style }}>
    {p.children}
  </div>
)

export const BoxRenderer: Renderer = (p) => (
  // biome-ignore lint/a11y/noStaticElementInteractions: a box can be made clickable by blocks
  // biome-ignore lint/a11y/useKeyWithClickEvents: same
  <div
    {...rootAttributes(p, 'Box')}
    style={{ ...flexStyle(p.props, 'column'), ...p.style }}
    onClick={p.design ? undefined : () => p.emit('click')}
  >
    {p.children}
  </div>
)

const GRID_ALIGN = { start: 'start', center: 'center', end: 'end', stretch: 'stretch' } as const

export const GridRenderer: Renderer = (p) => (
  <div
    {...rootAttributes(p, 'Grid')}
    style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${Math.max(1, Math.round(Number(p.props.columns) || 1))}, minmax(0, 1fr))`,
      gap: Number(p.props.gap) || 0,
      alignItems: GRID_ALIGN[p.props.alignItems as keyof typeof GRID_ALIGN] ?? 'stretch',
      ...p.style,
    }}
  >
    {p.children}
  </div>
)

export const SpacerRenderer: Renderer = (p) => (
  <div
    {...rootAttributes(p, 'Spacer')}
    aria-hidden="true"
    className={p.design ? 'rx-spacer-design' : undefined}
    style={{ flexShrink: 0, ...p.style }}
  />
)

export const DividerRenderer: Renderer = (p) => {
  const vertical = p.props.vertical === true
  const thickness = Math.max(1, Number(p.props.thickness) || 1)
  return (
    <hr
      {...rootAttributes(p, 'Divider')}
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      style={{
        margin: 0,
        border: 0,
        flexShrink: 0,
        alignSelf: 'stretch',
        background: cssColor(p.props.color) ?? 'var(--rx-border)',
        ...(vertical ? { width: thickness, minHeight: 16 } : { height: thickness }),
        ...p.style,
      }}
    />
  )
}
