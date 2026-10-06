import type { Locale, UiMode } from '@rublox/schema'
import { Button } from './components/button.ts'
import { Column } from './components/column.ts'
import { Image } from './components/image.ts'
import { Row } from './components/row.ts'
import { Screen } from './components/screen.ts'
import { Text } from './components/text.ts'
import { TextInput } from './components/text-input.ts'
import {
  CATEGORY_ORDER,
  type ComponentCategory,
  type ComponentDef,
  type ComponentStrings,
  type Localized,
  type PropDef,
} from './define.ts'

/** Every component type, in palette order within each category. */
export const COMPONENTS: readonly ComponentDef[] = [
  Screen,
  Column,
  Row,
  Button,
  Text,
  TextInput,
  Image,
]

export const SCREEN_TYPE = 'Screen'

const byType = new Map(COMPONENTS.map((def) => [def.type, def]))

export function getComponentDef(type: string): ComponentDef | undefined {
  return byType.get(type)
}

export function isLocalized<T>(value: unknown): value is Localized<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'fr' in value &&
    'en' in value
  )
}

export function resolveDefault(def: PropDef, locale: Locale): unknown {
  return isLocalized(def.default) ? def.default[locale] : def.default
}

/** Every property of a component: its own values over the catalog defaults. */
export function resolveProps(
  type: string,
  props: Record<string, unknown>,
  locale: Locale,
): Record<string, unknown> {
  const def = getComponentDef(type)
  if (!def) return { ...props }
  const result: Record<string, unknown> = {}
  for (const [key, propDef] of Object.entries(def.props)) {
    result[key] = key in props ? props[key] : resolveDefault(propDef, locale)
  }
  return result
}

/** Only the values that differ from the defaults (what a project stores). */
export function stripDefaults(
  type: string,
  props: Record<string, unknown>,
): Record<string, unknown> {
  const def = getComponentDef(type)
  if (!def) return { ...props }
  return Object.fromEntries(
    Object.entries(props).filter(([key, value]) => {
      const propDef = def.props[key]
      if (!propDef || propDef.state) return false
      if (isLocalized(propDef.default)) return true
      return JSON.stringify(value) !== JSON.stringify(propDef.default)
    }),
  )
}

export function componentStrings(type: string, locale: Locale): ComponentStrings | undefined {
  return getComponentDef(type)?.strings[locale]
}

export function componentLabel(type: string, locale: Locale): string {
  return componentStrings(type, locale)?.label ?? type
}

export function propLabel(type: string, key: string, locale: Locale): string {
  return componentStrings(type, locale)?.props[key] ?? key
}

export function enumLabel(type: string, key: string, value: string, locale: Locale): string {
  return componentStrings(type, locale)?.enums[key]?.[value] ?? value
}

export type PaletteCategory = {
  category: ComponentCategory
  components: ComponentDef[]
}

/** Palette content for a mode: Junior only gets components marked `junior`. */
export function paletteFor(mode: UiMode): PaletteCategory[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    components: COMPONENTS.filter(
      (def) => def.palette && def.category === category && (mode === 'studio' || def.junior),
    ),
  })).filter((entry) => entry.components.length > 0)
}

export const CATEGORY_LABELS: Localized<Record<ComponentCategory, string>> = {
  fr: {
    layout: 'Disposition',
    base: 'Base',
    input: 'Saisie',
    display: 'Affichage',
    lists: 'Listes',
    media: 'Médias',
    maps: 'Cartes et graphiques',
    sensors: 'Capteurs',
    device: 'Appareil',
    data: 'Données',
    game: 'Jeu',
  },
  en: {
    layout: 'Layout',
    base: 'Basics',
    input: 'Input',
    display: 'Display',
    lists: 'Lists',
    media: 'Media',
    maps: 'Maps and charts',
    sensors: 'Sensors',
    device: 'Device',
    data: 'Data',
    game: 'Game',
  },
}
