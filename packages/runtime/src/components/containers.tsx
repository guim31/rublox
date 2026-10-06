import { flexStyle } from '../styles.ts'
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
