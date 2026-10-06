import type { Locale } from '@rublox/schema'
import type { ReactNode } from 'react'
import type { Overlay } from '../engine.ts'

export type OverlayProps = { overlay: Overlay; locale: Locale }

/** Full-screen panels a behavior can open over the app (`ctx.overlay(kind)`). */
export const OVERLAYS: Record<string, (props: OverlayProps) => ReactNode> = {}
