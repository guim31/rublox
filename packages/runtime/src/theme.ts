import type { Theme } from '@rublox/schema'

export type Scheme = 'light' | 'dark'

/** CSS variables of an app theme, in light or dark. Components refer to `var(--rx-…)`. */
export function themeVariables(theme: Theme, scheme: Scheme): Record<string, string> {
  const dark = scheme === 'dark'
  const customBackground = theme.background.toLowerCase() !== '#ffffff'
  return {
    '--rx-primary': theme.primary,
    '--rx-secondary': theme.secondary,
    '--rx-background': dark ? (customBackground ? theme.background : '#121219') : theme.background,
    '--rx-surface': dark ? '#1d1c27' : '#f4f3f9',
    '--rx-text': dark ? '#f2f1f8' : '#1b1a24',
    '--rx-muted': dark ? '#a9a6bd' : '#615e74',
    '--rx-border': dark ? '#3a3850' : '#d4d1e2',
    '--rx-danger': dark ? '#ff7a6b' : '#d23c2c',
    '--rx-success': dark ? '#4fd18b' : '#1c8a4f',
    '--rx-on-primary': textOn(theme.primary),
    '--rx-on-secondary': textOn(theme.secondary),
    // The primary color as text (outline buttons, links): readable on the background.
    '--rx-primary-text': readableOn(
      theme.primary,
      dark ? (customBackground ? theme.background : '#121219') : theme.background,
    ),
    '--rx-radius': `${theme.radius}px`,
    '--rx-font': FONTS[theme.font],
  }
}

const FONTS: Record<Theme['font'], string> = {
  system: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  rounded: 'ui-rounded, "Nunito Variable", Nunito, system-ui, sans-serif',
  serif: 'ui-serif, Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, "JetBrains Mono Variable", Menlo, Consolas, monospace',
}

/** The scheme an app shows: its own setting, or the device's when it says `auto`. */
export function resolveScheme(theme: Theme, prefersDark: boolean, override?: Scheme): Scheme {
  if (override) return override
  if (theme.scheme === 'auto') return prefersDark ? 'dark' : 'light'
  return theme.scheme
}

/** `@primary` → `var(--rx-primary)`; other colors pass through; `''` means none. */
export function cssColor(value: unknown): string | undefined {
  if (typeof value !== 'string' || value === '') return undefined
  if (value.startsWith('@')) return `var(--rx-${value.slice(1)})`
  return value
}

/** `#rgb` or `#rrggbb` → [r, g, b] (0–255), or null for anything else (a CSS variable…). */
export function parseHex(color: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())
  if (!match?.[1]) return null
  const hex = match[1].length === 3 ? [...match[1]].map((c) => c + c).join('') : match[1]
  return [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
}

function luminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number) => {
    const c = value / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG contrast ratio of two colors (1 to 21). */
export function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (high + 0.05) / (low + 0.05)
}

const LIGHT_TEXT = '#ffffff'
const DARK_TEXT = '#1b1a24'

/**
 * The text color for a background (SPEC § 5.1, WCAG 1.4.3): white, or near black when that
 * reads better (a yellow or light green button). Not a hex color: white.
 */
export function textOn(background: string): string {
  const rgb = parseHex(background)
  if (!rgb) return LIGHT_TEXT
  return contrast(rgb, [255, 255, 255]) >= contrast(rgb, parseHex(DARK_TEXT) ?? [0, 0, 0])
    ? LIGHT_TEXT
    : DARK_TEXT
}

/**
 * `color` as text on `background`: unchanged when it already reads well (4.5:1), else mixed
 * step by step towards white (dark background) or black (light background) until it does.
 */
export function readableOn(color: string, background: string): string {
  const rgb = parseHex(color)
  const bg = parseHex(background)
  if (!rgb || !bg) return color
  const towards = luminance(bg) < 0.18 ? 255 : 0
  for (let step = 0; step <= 10; step++) {
    const mixed = rgb.map((c) => Math.round(c + ((towards - c) * step) / 10)) as [
      number,
      number,
      number,
    ]
    if (contrast(mixed, bg) >= 4.5) {
      return step === 0 ? color : `#${mixed.map((c) => c.toString(16).padStart(2, '0')).join('')}`
    }
  }
  return towards ? LIGHT_TEXT : '#000000'
}
