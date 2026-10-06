import type { Locale } from '@rublox/schema'

export type Localized<T = string> = Record<Locale, T>

export type PropGroup = 'content' | 'style' | 'layout' | 'advanced'
export const PROP_GROUPS: readonly PropGroup[] = ['content', 'style', 'layout', 'advanced']

/** Which blocks a property gets: read it, write it, both, or none. */
export type BlockAccess = 'get-set' | 'get' | 'set' | 'none'

/**
 * Value kinds. They pick the inspector editor, the block shape (`check`) and how a value
 * written by the generated code is validated.
 *
 * - `size`: `'auto'`, `'fill'`, a number of pixels or a percentage string (`'50%'`)
 * - `spacing`: one number, or `[top, right, bottom, left]`
 * - `color`: `''` (none), `#rrggbb`, `#rrggbbaa`, or a theme token (`@primary`, `@text`…)
 * - `asset`: an asset id of the project, or an `https:` address
 */
export type PropKind =
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'color'
  | 'size'
  | 'spacing'
  | 'asset'
  | 'icon'

export type SizeValue = 'auto' | 'fill' | number | `${number}%`
export type SpacingValue = number | [number, number, number, number]

type PropOptions<T> = {
  /** A `{ fr, en }` default is written into the component when it is created. */
  default: T | Localized<T>
  group: PropGroup
  /** Shown in Junior without opening "More options". */
  junior?: boolean
  blocks?: BlockAccess
}

export type PropDef<T = unknown> = {
  kind: PropKind
  default: T | Localized<T>
  group: PropGroup
  junior: boolean
  blocks: BlockAccess
  /** Enum values. */
  values?: readonly string[]
  min?: number
  max?: number
  step?: number
  /** Several lines in the inspector (string). */
  multiline?: boolean
  /** Asset kind accepted (asset). */
  assetKind?: 'image' | 'sound' | 'video' | 'lottie'
  /** Turns any value into a valid one, or `undefined` when it cannot. */
  coerce: (value: unknown) => T | undefined
}

export const COLOR_TOKENS = [
  'primary',
  'secondary',
  'background',
  'surface',
  'text',
  'muted',
  'border',
  'danger',
  'success',
] as const
export type ColorToken = (typeof COLOR_TOKENS)[number]

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const PERCENT = /^(\d+(?:\.\d+)?)%$/

function finite(value: unknown): number | undefined {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined
}

function clamp(n: number, min?: number, max?: number): number {
  return Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, n))
}

function defaults<T>(kind: PropKind, options: PropOptions<T>) {
  return {
    kind,
    default: options.default,
    group: options.group,
    junior: options.junior ?? false,
    blocks: options.blocks ?? 'none',
  }
}

/** Property builders, used in `defineComponent({ props })`. */
export const prop = {
  string(options: PropOptions<string> & { multiline?: boolean }): PropDef<string> {
    return {
      ...defaults('string', options),
      multiline: options.multiline ?? false,
      coerce: (value) => {
        if (value === null || value === undefined) return ''
        if (typeof value === 'number')
          return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(10)))
        if (typeof value === 'boolean') return String(value)
        if (typeof value === 'string') return value
        try {
          return JSON.stringify(value)
        } catch {
          return String(value)
        }
      },
    }
  },

  number(
    options: PropOptions<number> & {
      min?: number
      max?: number
      step?: number
    },
  ): PropDef<number> {
    return {
      ...defaults('number', options),
      min: options.min,
      max: options.max,
      step: options.step,
      coerce: (value) => {
        const n = finite(value)
        return n === undefined ? undefined : clamp(n, options.min, options.max)
      },
    }
  },

  boolean(options: PropOptions<boolean>): PropDef<boolean> {
    return {
      ...defaults('boolean', options),
      coerce: (value) => {
        if (value === 'false' || value === '0') return false
        return Boolean(value)
      },
    }
  },

  enum<const V extends readonly string[]>(
    values: V,
    options: PropOptions<V[number]>,
  ): PropDef<V[number]> {
    return {
      ...defaults('enum', options),
      values,
      coerce: (value) =>
        typeof value === 'string' && values.includes(value) ? (value as V[number]) : undefined,
    }
  },

  color(options: PropOptions<string>): PropDef<string> {
    return {
      ...defaults('color', options),
      coerce: (value) => {
        if (value === null || value === undefined || value === '') return ''
        if (typeof value !== 'string') return undefined
        const v = value.trim()
        if (HEX.test(v)) return v.toLowerCase()
        if (v.startsWith('@') && (COLOR_TOKENS as readonly string[]).includes(v.slice(1))) return v
        if (/^(rgb|hsl)a?\([\d\s.,%/-]+\)$/i.test(v) || /^[a-z]+$/i.test(v)) return v
        return undefined
      },
    }
  },

  size(options: PropOptions<SizeValue>): PropDef<SizeValue> {
    return {
      ...defaults('size', options),
      coerce: (value) => {
        if (value === 'auto' || value === 'fill') return value
        if (typeof value === 'string' && PERCENT.test(value.trim())) {
          return value.trim() as `${number}%`
        }
        const n = finite(value)
        return n === undefined ? undefined : Math.max(0, n)
      },
    }
  },

  spacing(options: PropOptions<SpacingValue>): PropDef<SpacingValue> {
    return {
      ...defaults('spacing', options),
      coerce: (value) => {
        const n = finite(value)
        if (n !== undefined) return Math.max(0, n)
        if (Array.isArray(value) && value.length === 4) {
          const sides = value.map(finite)
          if (sides.every((side) => side !== undefined)) {
            return sides.map((side) => Math.max(0, side as number)) as SpacingValue
          }
        }
        return undefined
      },
    }
  },

  asset(
    options: PropOptions<string> & {
      assetKind: NonNullable<PropDef['assetKind']>
    },
  ): PropDef<string> {
    return {
      ...defaults('asset', options),
      assetKind: options.assetKind,
      coerce: (value) => (typeof value === 'string' ? value : value == null ? '' : undefined),
    }
  },

  icon(options: PropOptions<string>): PropDef<string> {
    return {
      ...defaults('icon', options),
      coerce: (value) => (typeof value === 'string' ? value : value == null ? '' : undefined),
    }
  },
}

export type ArgDef = { kind: PropKind }

export type EventDef = {
  junior: boolean
  /** Values passed to the handler, in order. */
  args: Record<string, ArgDef>
}

export function event(options: { junior?: boolean; args?: Record<string, ArgDef> } = {}): EventDef {
  return { junior: options.junior ?? false, args: options.args ?? {} }
}

export type MethodDef = {
  junior: boolean
  args: Record<string, ArgDef>
  /** Kind of the returned value; absent for a statement block. */
  returns?: PropKind
  /** Returns a promise: the generated code awaits it. */
  async: boolean
}

export function method(
  options: {
    junior?: boolean
    args?: Record<string, ArgDef>
    returns?: PropKind
    async?: boolean
  } = {},
): MethodDef {
  return {
    junior: options.junior ?? false,
    args: options.args ?? {},
    returns: options.returns,
    async: options.async ?? false,
  }
}

export type ComponentCategory =
  | 'layout'
  | 'base'
  | 'input'
  | 'display'
  | 'lists'
  | 'media'
  | 'maps'
  | 'sensors'
  | 'device'
  | 'data'
  | 'game'

export const CATEGORY_ORDER: readonly ComponentCategory[] = [
  'layout',
  'base',
  'input',
  'display',
  'lists',
  'media',
  'maps',
  'sensors',
  'device',
  'data',
  'game',
]

/** Texts of one component in one language. Every key below must exist in both languages. */
export type ComponentStrings = {
  /** Shown in the palette and the inspector: "Champ de texte". */
  label: string
  /** Start of default names, a valid identifier: "Champ" gives Champ1, Champ2… */
  prefix: string
  /** One line, in the palette tooltip. */
  description: string
  /** Help sheet. */
  help: string
  /** A short usage example, shown under the help. */
  example: string
  props: Record<string, string>
  /** Block text for each event: `%1` is the component. */
  events: Record<string, string>
  /** Block text for each method: `%1` is the component, then one `%n` per argument. */
  methods: Record<string, string>
  /** Labels of enum values: `{ variant: { filled: 'Plein', … } }`. */
  enums: Record<string, Record<string, string>>
}

export type ComponentDef = {
  type: string
  category: ComponentCategory
  /** A lucide icon name, for the palette and the layers. */
  icon: string
  /** Visible on screen (otherwise listed under it, like a timer). */
  visible: boolean
  container: boolean
  /** Offered in Junior's palette. */
  junior: boolean
  /** Shown in the palette (the screen root is not). */
  palette: boolean
  props: Record<string, PropDef>
  events: Record<string, EventDef>
  methods: Record<string, MethodDef>
  strings: Localized<ComponentStrings>
}

export type ComponentInput = Omit<ComponentDef, 'palette' | 'methods' | 'events'> & {
  palette?: boolean
  events?: Record<string, EventDef>
  methods?: Record<string, MethodDef>
  /** Overrides the defaults of common properties: `{ padding: 12 }`. */
  commonDefaults?: Partial<Record<string, unknown>>
  /** Common properties to leave out. */
  omitCommon?: readonly string[]
}
