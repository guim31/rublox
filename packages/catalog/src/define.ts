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
 * - `images`: a list of images, each an asset id, an `https:` address or an emoji (the
 *   costumes of a sprite)
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
  | 'images'

export type SizeValue = 'auto' | 'fill' | number | `${number}%`
export type SpacingValue = number | [number, number, number, number]

type PropOptions<T> = {
  /** A `{ fr, en }` default is written into the component when it is created. */
  default: T | Localized<T>
  group: PropGroup
  /** Shown in Junior without opening "More options". */
  junior?: boolean
  blocks?: BlockAccess
  /**
   * Set by the component while the app runs (a position, "available"): never in the
   * inspector nor in the project, readable by blocks (`blocks: 'get'` by default).
   */
  state?: boolean
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
  /** Set while the app runs, never stored (see `PropOptions.state`). */
  state: boolean
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
  const state = options.state ?? false
  return {
    kind,
    default: options.default,
    group: options.group,
    junior: options.junior ?? false,
    blocks: options.blocks ?? (state ? 'get' : 'none'),
    state,
  }
}

/** The images of an `images` value: kept strings, at most 100 of them. */
function imageList(value: unknown): string[] | undefined {
  if (typeof value === 'string') return value.trim() ? [value.trim()] : []
  if (!Array.isArray(value)) return undefined
  const items = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
  return items.filter((item) => item !== '').slice(0, 100)
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

  /** A list of images: asset ids, `https:` addresses or emoji. */
  images(options: PropOptions<string[]>): PropDef<string[]> {
    return {
      ...defaults('images', options),
      assetKind: 'image',
      coerce: imageList,
    }
  },
}

/**
 * A value passed to an event handler or a method. `component` is a component of the screen
 * of type `componentType`, chosen in a dropdown (a method argument) or received (an event
 * argument). `default` fills the toolbox's shadow block.
 */
export type ArgDef = {
  kind: PropKind | 'component'
  componentType?: string
  default?: unknown
}

/** An argument of an event or a method: `arg('number')`, `arg('number', { default: 10 })`. */
export function arg(
  kind: ArgDef['kind'],
  options: { componentType?: string; default?: unknown } = {},
): ArgDef {
  return { kind, ...options }
}

/**
 * Narrows which occurrences of an event a handler receives, chosen in a dropdown of the
 * event block (its `%2`): another component of `componentType` ("when Pomme touches
 * Panier"), or one of `values` ("…touches the bottom edge"). The generated code passes the
 * choice before the handler, `null` meaning "any": `Pomme.onHit(Panier, async (…) => …)`.
 */
export type EventFilter =
  | { kind: 'component'; componentType: string }
  | { kind: 'enum'; values: readonly string[] }

export type EventDef = {
  junior: boolean
  /**
   * Values the event carries (the item clicked, the new value…). The handler receives them
   * as one object, `event`, and the "value of the event" block reads them. Their labels are
   * in `strings.args`.
   */
  args: Record<string, ArgDef>
  filter?: EventFilter
  /**
   * A handler still running when the event comes again is not started a second time (the
   * frames of a game loop).
   */
  skipIfBusy?: boolean
}

export function event(
  options: {
    junior?: boolean
    args?: Record<string, ArgDef>
    filter?: EventFilter
    skipIfBusy?: boolean
  } = {},
): EventDef {
  return {
    junior: options.junior ?? false,
    args: options.args ?? {},
    ...(options.filter ? { filter: options.filter } : {}),
    ...(options.skipIfBusy ? { skipIfBusy: true } : {}),
  }
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
  /** Labels of event arguments: `{ item: 'élément' }` (required for each one). */
  args?: Record<string, string>
  /** Labels of event filter choices, by event, with `any`: `{ edge: { any: 'un bord', … } }`. */
  filters?: Record<string, Record<string, string>>
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
  /** A container that only accepts these child types. */
  accepts?: readonly string[]
  /** Only placed inside a container of one of these types (a sprite in a game scene). */
  parents?: readonly string[]
  /**
   * A container whose children are placed freely, by their `x` and `y` properties, instead
   * of in a flex layout (the game scene).
   */
  freeLayout?: boolean
  /**
   * Instances can be copied while the app runs (a sprite's clones). Its event handlers
   * receive the instance that fired first, under the component's name, so that the same
   * blocks drive the original and every clone.
   */
  clonable?: boolean
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
