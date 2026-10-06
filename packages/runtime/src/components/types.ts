import type { Locale } from '@rublox/schema'
import { type CSSProperties, type ReactElement, type ReactNode, useEffect } from 'react'

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
  /** Fires an event of the component, with its values (`{ item, index }`). */
  emit: (event: string, args?: Record<string, unknown>) => void
  /** A value changed by the user (typing in a text input). */
  setValue: (prop: string, value: unknown) => void
  /** URL of an asset property: a project asset id, an https:, blob: or data: address. */
  assetUrl: (value: string) => string | undefined
  /** Language of the app (texts the component writes itself). */
  locale: Locale
  /**
   * Gives the component's behavior something to act on (a video element, a drawing API).
   * Use `useExpose`.
   */
  expose: (handle: unknown) => void
}

/**
 * Draws one component type. The root element must carry `data-rx-id` (the editor finds
 * components by it) and the common `style`.
 */
export type Renderer = (props: RendererProps) => ReactElement

export function rootAttributes(p: RendererProps, type: string) {
  return { 'data-rx-id': p.id, 'data-rx-type': type, 'data-rx-name': p.name }
}

/** Exposes `handle` to the component's behavior while the renderer is mounted (run mode). */
export function useExpose(p: RendererProps, handle: unknown): void {
  const { expose, design } = p
  useEffect(() => {
    if (design) return
    expose(handle)
    return () => expose(null)
  }, [expose, design, handle])
}
