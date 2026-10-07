import { messages } from '@rublox/i18n'
import { cssColor } from '../theme.ts'
import { boundItems } from './bound.ts'
import { type Renderer, type RendererProps, rootAttributes } from './types.ts'

type Point = { label: string; value: number }

/** The points: the rows of the bound table (J5), or the component's own list. */
export function chartPoints(p: RendererProps): Point[] {
  const bound = boundItems(p, ['label', 'value'])
  const items: { label?: unknown; value?: unknown }[] = bound
    ? bound.map((item) => item.fields)
    : Array.isArray(p.props.points)
      ? (p.props.points as { label?: unknown; value?: unknown }[])
      : []
  return items.slice(0, 200).map((item) => {
    const value = Number(String(item?.value ?? '').replace(',', '.'))
    return { label: String(item?.label ?? ''), value: Number.isFinite(value) ? value : 0 }
  })
}

/** Slices of a pie: the chosen colour first, then the theme's and a few more. */
const PALETTE = [
  'var(--rx-chart)',
  'var(--rx-secondary)',
  '#16a37f',
  '#f2b705',
  '#3a86ff',
  '#a259d9',
  '#e85d75',
  '#6c757d',
]

const W = 320
const H = 200
const PAD = { top: 22, right: 10, bottom: 30, left: 10 }

function format(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '')
}

/** Bars, a line or a pie, drawn in SVG (no chart library: a few kilobytes, SPEC § 7). */
export const ChartRenderer: Renderer = (p) => {
  const points = chartPoints(p)
  const kind = String(p.props.chartType ?? 'bar')
  const color = cssColor(p.props.color) ?? 'var(--rx-primary)'
  const showValues = p.props.showValues !== false
  const title = String(p.props.title ?? '')
  const click = (index: number) => {
    if (p.design) return
    const point = points[index]
    if (point) p.emit('pointClick', { index: index + 1, label: point.label, value: point.value })
  }
  const label = title || messages[p.locale].runtime.data.chart
  return (
    <figure
      {...rootAttributes(p, 'Chart')}
      className="rx-chart"
      style={{ ['--rx-chart' as string]: color, ...p.style }}
    >
      {title ? <figcaption className="rx-chart-title">{title}</figcaption> : null}
      {points.length === 0 ? (
        <p className="rx-list-empty">{messages[p.locale].catalog.runtime.noItems}</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
          {kind === 'pie' ? (
            <Pie points={points} showValues={showValues} onClick={click} />
          ) : (
            <Axes points={points} kind={kind} showValues={showValues} onClick={click} />
          )}
        </svg>
      )}
      {/* The values, for screen readers. */}
      <table className="rx-sr-only">
        <tbody>
          {points.map((point, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: labels may repeat
            <tr key={i}>
              <th>{point.label}</th>
              <td>{format(point.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

/** Each point with its position and a stable key (labels may repeat). */
function withKeys(points: Point[]) {
  return points.map((point, i) => ({ point, i, key: `${i}:${point.label}` }))
}

function Axes({
  points,
  kind,
  showValues,
  onClick,
}: {
  points: Point[]
  kind: string
  showValues: boolean
  onClick: (index: number) => void
}) {
  const values = points.map((point) => point.value)
  const max = Math.max(0, ...values)
  const min = Math.min(0, ...values)
  const span = max - min || 1
  const width = W - PAD.left - PAD.right
  const height = H - PAD.top - PAD.bottom
  const step = width / points.length
  const y = (value: number) => PAD.top + ((max - value) / span) * height
  const zero = y(0)
  const center = (i: number) => PAD.left + step * i + step / 2
  const labelEvery = Math.ceil(points.length / 12)
  return (
    <g>
      <line
        x1={PAD.left}
        x2={W - PAD.right}
        y1={zero}
        y2={zero}
        stroke="var(--rx-border)"
        strokeWidth={1}
      />
      {kind === 'line' ? (
        <polyline
          points={points.map((point, i) => `${center(i)},${y(point.value)}`).join(' ')}
          fill="none"
          stroke="var(--rx-chart)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : null}
      {withKeys(points).map(({ point, i, key }) => {
        const top = Math.min(y(point.value), zero)
        const barHeight = Math.max(1, Math.abs(y(point.value) - zero))
        return (
          // biome-ignore lint/a11y/noStaticElementInteractions: SVG shapes; a table gives the values to screen readers
          <g key={key} className="rx-chart-point" onClick={() => onClick(i)}>
            {kind === 'line' ? (
              <circle cx={center(i)} cy={y(point.value)} r={4} fill="var(--rx-chart)" />
            ) : (
              <rect
                x={center(i) - (step * 0.7) / 2}
                y={top}
                width={step * 0.7}
                height={barHeight}
                rx={Math.min(4, step * 0.1)}
                fill="var(--rx-chart)"
              />
            )}
            {/* A larger, invisible target for a finger. */}
            <rect
              x={center(i) - step / 2}
              y={PAD.top}
              width={step}
              height={height}
              fill="transparent"
            />
            {showValues ? (
              <text x={center(i)} y={top - 5} textAnchor="middle" className="rx-chart-value">
                {format(point.value)}
              </text>
            ) : null}
            {i % labelEvery === 0 ? (
              <text x={center(i)} y={H - 10} textAnchor="middle" className="rx-chart-label">
                {point.label.slice(0, 10)}
              </text>
            ) : null}
          </g>
        )
      })}
    </g>
  )
}

function Pie({
  points,
  showValues,
  onClick,
}: {
  points: Point[]
  showValues: boolean
  onClick: (index: number) => void
}) {
  const total = points.reduce((sum, point) => sum + Math.max(0, point.value), 0) || 1
  const cx = W / 2
  const cy = H / 2
  const r = H / 2 - 12
  let angle = -Math.PI / 2
  return (
    <g>
      {withKeys(points).map(({ point, i, key }) => {
        const share = Math.max(0, point.value) / total
        const start = angle
        const end = angle + share * Math.PI * 2
        angle = end
        const large = end - start > Math.PI ? 1 : 0
        const x1 = cx + r * Math.cos(start)
        const y1 = cy + r * Math.sin(start)
        const x2 = cx + r * Math.cos(end)
        const y2 = cy + r * Math.sin(end)
        const middle = (start + end) / 2
        const path =
          share >= 0.9999
            ? `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`
            : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`
        return (
          // biome-ignore lint/a11y/noStaticElementInteractions: SVG shapes; a table gives the values to screen readers
          <g key={key} className="rx-chart-point" onClick={() => onClick(i)}>
            <path
              d={path}
              fill={PALETTE[i % PALETTE.length]}
              stroke="var(--rx-surface)"
              strokeWidth={1.5}
            />
            {share > 0.06 ? (
              <text
                x={cx + r * 0.62 * Math.cos(middle)}
                y={cy + r * 0.62 * Math.sin(middle)}
                textAnchor="middle"
                dominantBaseline="middle"
                className="rx-chart-slice"
              >
                {point.label.slice(0, 8)}
                {showValues ? ` ${format(point.value)}` : ''}
              </text>
            ) : null}
          </g>
        )
      })}
    </g>
  )
}
