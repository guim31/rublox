import type { CSSProperties } from 'react'
import { cssColor } from './theme.ts'

type Props = Record<string, unknown>

/** `'auto'`, `'fill'`, pixels or a percentage, as CSS for a size along the parent's axis. */
function size(value: unknown): string | number | undefined {
  if (value === 'auto' || value === undefined) return undefined
  if (value === 'fill') return '100%'
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.endsWith('%')) return value
  return undefined
}

function spacing(value: unknown): string | number | undefined {
  if (typeof value === 'number') return value
  if (Array.isArray(value) && value.length === 4)
    return value.map((v) => `${Number(v) || 0}px`).join(' ')
  return undefined
}

const SHADOWS: Record<string, string> = {
  small: '0 1px 3px rgba(20, 16, 50, 0.16)',
  medium: '0 4px 12px rgba(20, 16, 50, 0.18)',
  large: '0 12px 32px rgba(20, 16, 50, 0.24)',
}

const ALIGN: Record<string, CSSProperties['alignSelf']> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
}

/**
 * The style of the common properties (SPEC § 4.4). In design mode an invisible component
 * stays on the canvas, faded, so that it can still be selected. `own` holds the values set
 * on the component itself, to tell an explicit radius from the default one.
 */
export function commonStyle(props: Props, design: boolean, own: Props = {}): CSSProperties {
  const style: CSSProperties = { boxSizing: 'border-box', minWidth: 0 }
  const width = size(props.width)
  const height = size(props.height)
  if (width !== undefined) style.width = width
  if (height !== undefined) style.height = height
  if (props.width === 'fill') style.alignSelf = 'stretch'
  if (props.grow === true) style.flexGrow = 1
  if (typeof props.alignSelf === 'string' && ALIGN[props.alignSelf]) {
    style.alignSelf = ALIGN[props.alignSelf]
  }
  const margin = spacing(props.margin)
  const padding = spacing(props.padding)
  if (margin) style.margin = margin
  if (padding) style.padding = padding
  const background = cssColor(props.background)
  if (background) style.background = background
  if (typeof props.borderWidth === 'number' && props.borderWidth > 0) {
    style.border = `${props.borderWidth}px solid ${cssColor(props.borderColor) ?? 'var(--rx-border)'}`
  }
  // A rounded component follows the theme's corners unless its own radius was set (§ 4.1).
  if (typeof props.radius === 'number' && props.radius > 0)
    style.borderRadius = 'radius' in own ? props.radius : 'var(--rx-radius)'
  if (typeof props.shadow === 'string' && SHADOWS[props.shadow])
    style.boxShadow = SHADOWS[props.shadow]
  if (typeof props.opacity === 'number' && props.opacity < 100) style.opacity = props.opacity / 100
  if (props.visible === false) {
    if (design) style.opacity = 0.35
    else style.display = 'none'
  }
  return style
}

const JUSTIFY: Record<string, CSSProperties['justifyContent']> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
}

/** Flex layout of a container (Screen, Row, Column). */
export function flexStyle(props: Props, direction: 'row' | 'column'): CSSProperties {
  return {
    display: 'flex',
    flexDirection: direction,
    gap: typeof props.gap === 'number' ? props.gap : undefined,
    alignItems: ALIGN[String(props.alignItems)] ?? 'stretch',
    justifyContent: JUSTIFY[String(props.justify)] ?? 'flex-start',
    flexWrap: props.wrap === true ? 'wrap' : 'nowrap',
  }
}
