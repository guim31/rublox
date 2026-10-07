import type { Locale } from '@rublox/schema'
import type { CSSProperties, ReactElement, ReactNode } from 'react'

export type RendererProps = {
  id: string
  /** The component's name (`Bouton1`), for accessibility and tests. */
  name: string
  /** Every property, defaults resolved. */
  props: Record<string, unknown>
  /** Style of the common properties, to put on the root element. */
  style: CSSProperties
  /** Drawn on the editor canvas: no event, inputs read-only. */
  design: boolean
  children?: ReactNode
  emit: (event: string) => void
  /** A value changed by the user (typing in a text input). */
  setValue: (prop: string, value: unknown) => void
  /** URL of an image property: a project asset id or an https: address. */
  assetUrl: (value: string) => string | undefined
  locale: Locale
  /**
   * The running object behind a component that draws itself (a game scene's `World`), in a
   * running app only.
   */
  live?: unknown
}

/**
 * Draws one component type. The root element must carry `data-rx-id` (the editor finds
 * components by it) and the common `style`.
 */
export type Renderer = (props: RendererProps) => ReactElement

export function rootAttributes(p: RendererProps, type: string) {
  return { 'data-rx-id': p.id, 'data-rx-type': type, 'data-rx-name': p.name }
}
