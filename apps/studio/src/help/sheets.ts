import { CATEGORY_COLORS } from '@rublox/blocks/colors'
import { COMPONENTS, getComponentDef } from '@rublox/catalog'
import { format, messages } from '@rublox/i18n'
import type { Locale } from '@rublox/schema'

type BlockCategory = keyof typeof CATEGORY_COLORS

/** A help sheet ready to draw. */
export type Sheet = {
  id: string
  title: string
  text: string
  example?: string
  category: BlockCategory
  categoryLabel: string
}

/** The toolbox category of a general block, from its type. */
function categoryOf(type: string): BlockCategory {
  if (/^rx_\w+_on_\w+$/.test(type) || type === 'rx_app_start') return 'events'
  if (/^rx_[A-Z]\w*_(get|set|call_\w+)$/.test(type)) return 'components'
  if (type === 'rx_forever' || type === 'rx_wait' || type.startsWith('controls_')) return 'control'
  if (type.startsWith('rx_screen')) return 'screens'
  if (type.startsWith('rx_ui')) return 'interface'
  if (type === 'rx_log') return 'debug'
  if (type.startsWith('logic_')) return 'logic'
  if (type === 'math_change' || type.startsWith('variables_')) return 'variables'
  if (type.startsWith('math_')) return 'math'
  if (type === 'text' || type.startsWith('text_')) return 'text'
  if (type.startsWith('lists_')) return 'lists'
  if (type.startsWith('colour_')) return 'colour'
  if (type.startsWith('procedures_')) return 'functions'
  return 'debug'
}

const CATEGORY_KEYS: Record<BlockCategory, string> = {
  events: 'components',
  components: 'components',
  control: 'control',
  logic: 'logic',
  math: 'math',
  text: 'text',
  lists: 'lists',
  variables: 'variables',
  functions: 'functions',
  screens: 'screens',
  interface: 'interface',
  debug: 'debug',
  colour: 'colors',
}

function categoryLabel(category: BlockCategory, locale: Locale): string {
  const labels = messages[locale].blocks.categories as Record<string, string>
  return labels[CATEGORY_KEYS[category]] ?? category
}

/** The sheet of a component block (`rx_Button_on_click`…), from the catalog. */
function componentBlockSheet(type: string, locale: Locale): Sheet | undefined {
  const match = /^rx_([A-Z]\w*?)_(on|get|set|call)(?:_(\w+))?$/.exec(type)
  if (!match) return undefined
  const [, componentType = '', kind, member = ''] = match
  const def = getComponentDef(componentType)
  if (!def) return undefined
  const strings = def.strings[locale]
  const sheets = messages[locale].studio.componentSheets
  const name = strings.label
  const blocks = messages[locale].blocks
  const title =
    kind === 'on'
      ? format((strings.events[member] ?? member).replace('%1', '{{name}}'), { name })
      : kind === 'call'
        ? (strings.methods[member] ?? member).replace('%1', name).replace(/%\d/g, '…')
        : (kind === 'set' ? blocks.set : blocks.get)
            .replace('%1', '…')
            .replace('%2', name)
            .replace('%3', '…')
  const lead = format(
    kind === 'on'
      ? sheets.event
      : kind === 'call'
        ? sheets.method
        : kind === 'set'
          ? sheets.set
          : sheets.get,
    { name },
  )
  const category = categoryOf(type)
  return {
    id: type,
    title,
    text: `${lead} ${strings.help}`,
    example: strings.example,
    category,
    categoryLabel: categoryLabel(category, locale),
  }
}

/** The sheet of any block type, or `undefined` when there is none. */
export function blockSheet(type: string, locale: Locale): Sheet | undefined {
  const own = (
    messages[locale].studio.blockSheets as Record<
      string,
      { title: string; text: string; example: string }
    >
  )[type]
  if (own) {
    const category = categoryOf(type)
    return { id: type, ...own, category, categoryLabel: categoryLabel(category, locale) }
  }
  return componentBlockSheet(type, locale)
}

/** Every general block sheet, in toolbox order. */
export function allBlockSheets(locale: Locale): Sheet[] {
  return Object.keys(messages[locale].studio.blockSheets)
    .map((type) => blockSheet(type, locale))
    .filter((sheet): sheet is Sheet => Boolean(sheet))
}

/** Component sheets: what it is, an example, and its blocks. */
export function componentSheets(locale: Locale) {
  return COMPONENTS.filter((def) => def.palette).map((def) => ({
    type: def.type,
    label: def.strings[locale].label,
    text: def.strings[locale].help,
    example: def.strings[locale].example,
    events: Object.keys(def.events).map((event) => `rx_${def.type}_on_${event}`),
  }))
}

export function categoryColor(category: BlockCategory): string {
  return CATEGORY_COLORS[category]
}
