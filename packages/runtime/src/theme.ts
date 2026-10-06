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
    '--rx-on-primary': '#ffffff',
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
