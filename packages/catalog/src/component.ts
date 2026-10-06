import { COMMON_STRINGS, commonProps } from './common.ts'
import type { ComponentDef, ComponentInput, Localized, PropDef } from './define.ts'

/**
 * Declares a component type. Visible components receive the common properties (visible,
 * dimensions, margins, background, border…) and their labels; `commonDefaults` and
 * `omitCommon` adjust them. Everything else (palette, inspector, blocks, rendering, help)
 * is derived from the result.
 */
export function defineComponent(input: ComponentInput): ComponentDef {
  const { commonDefaults = {}, omitCommon = [], palette = true, ...rest } = input
  const common: Record<string, PropDef> = {}
  if (input.visible) {
    for (const [key, def] of Object.entries(commonProps())) {
      if (omitCommon.includes(key)) continue
      common[key] = key in commonDefaults ? { ...def, default: commonDefaults[key] } : def
    }
  }
  const strings = Object.fromEntries(
    Object.entries(input.strings).map(([locale, own]) => {
      const shared = COMMON_STRINGS[locale as keyof typeof COMMON_STRINGS]
      return [
        locale,
        {
          ...own,
          props: { ...pick(shared.props, Object.keys(common)), ...own.props },
          enums: { ...pick(shared.enums, Object.keys(common)), ...own.enums },
        },
      ]
    }),
  ) as ComponentDef['strings']
  return {
    ...rest,
    palette,
    events: input.events ?? {},
    methods: input.methods ?? {},
    props: { ...common, ...input.props },
    strings,
  }
}

function pick<T>(record: Record<string, T>, keys: string[]): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => keys.includes(key)))
}

/** Container strings live in `COMMON_STRINGS` too: this picks them for a component. */
export function containerStrings(): Localized<{
  props: Record<string, string>
  enums: Record<string, Record<string, string>>
}> {
  const keys = ['gap', 'alignItems', 'justify', 'wrap']
  return {
    fr: { props: pick(COMMON_STRINGS.fr.props, keys), enums: pick(COMMON_STRINGS.fr.enums, keys) },
    en: { props: pick(COMMON_STRINGS.en.props, keys), enums: pick(COMMON_STRINGS.en.enums, keys) },
  }
}
