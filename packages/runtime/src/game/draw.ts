import { cssColor } from '../theme.ts'

/**
 * How scene bodies look, shared by the editor canvas (React, `design`) and the running game
 * (written straight to the DOM by `World`, never through React at each frame).
 */

type Values = Record<string, unknown>

export function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** The costume shown: an image URL, or a text drawn as a glyph (an emoji). */
export type Costume = { kind: 'image'; src: string } | { kind: 'glyph'; text: string }

export function costumeOf(
  values: Values,
  assetUrl: (value: string) => string | undefined,
): Costume | null {
  const list = Array.isArray(values.costumes) ? (values.costumes as unknown[]) : []
  if (!list.length) return null
  const index = Math.round(num(values.costume, 1)) - 1
  const value = String(list[((index % list.length) + list.length) % list.length] ?? '')
  if (!value) return null
  const src = assetUrl(value)
  return src ? { kind: 'image', src } : { kind: 'glyph', text: value }
}

/** Size and place of a sprite: its center at (x, y), turned by `rotation` degrees. */
export function spriteStyle(values: Values): {
  width: string
  height: string
  transform: string
  fontSize: string
} {
  const w = num(values.width, 64)
  const h = num(values.height, 64)
  return {
    width: `${w}px`,
    height: `${h}px`,
    transform: `translate(${num(values.x) - w / 2}px, ${num(values.y) - h / 2}px) rotate(${num(values.rotation)}deg)`,
    fontSize: `${Math.min(w, h) * 0.82}px`,
  }
}

const ANCHOR: Record<string, string> = { left: '0', center: '-50%', right: '-100%' }

export function sceneTextStyle(values: Values): {
  transform: string
  fontSize: string
  color: string
  fontWeight: string
  textAlign: string
  textShadow: string
} {
  const align = String(values.align ?? 'center')
  const outline = values.outline !== false
  return {
    transform: `translate(${num(values.x)}px, ${num(values.y)}px) translate(${ANCHOR[align] ?? '-50%'}, -50%) rotate(${num(values.rotation)}deg)`,
    fontSize: `${num(values.fontSize, 28)}px`,
    color: cssColor(values.color) ?? '#1b1a24',
    fontWeight: values.bold === false ? '500' : '800',
    textAlign: align,
    textShadow: outline ? '0 0 3px rgba(255,255,255,0.95), 0 0 6px rgba(255,255,255,0.7)' : 'none',
  }
}

export function joystickStyle(values: Values): {
  width: string
  height: string
  transform: string
  color: string
} {
  const size = num(values.size, 120)
  return {
    width: `${size}px`,
    height: `${size}px`,
    transform: `translate(${num(values.x) - size / 2}px, ${num(values.y) - size / 2}px)`,
    color: cssColor(values.color) ?? '#5b4bff',
  }
}

/** Position of the joystick's knob for a direction in [-1, 1]. */
export function knobTransform(values: Values): string {
  const size = num(values.size, 120)
  const reach = size * 0.32
  return `translate(-50%, -50%) translate(${num(values.dx) * reach}px, ${num(values.dy) * reach}px)`
}

/** Scale and offset that fit a `width × height` stage into a box, centered (letterboxed). */
export function fitStage(
  box: { width: number; height: number },
  stage: { width: number; height: number },
): { scale: number; x: number; y: number } {
  const scale = Math.max(0.01, Math.min(box.width / stage.width, box.height / stage.height) || 0.01)
  return {
    scale,
    x: (box.width - stage.width * scale) / 2,
    y: (box.height - stage.height * scale) / 2,
  }
}
