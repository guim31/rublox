import { getComponentDef, resolveDefault, SCREEN_TYPE } from '@rublox/catalog'
import { messages } from '@rublox/i18n'
import { APP_WORKSPACE } from '@rublox/schema'
import type * as Blockly from 'blockly/core'
import type { BlocksContext } from './context.ts'
import {
  BLOCK_TYPES,
  eventBlockType,
  getterBlockType,
  methodBlockType,
  propertyKeys,
  setterBlockType,
  shadowFor,
} from './definitions.ts'

type Item = Blockly.utils.toolbox.ToolboxItemInfo
type BlockItem = Blockly.utils.toolbox.BlockInfo

const block = (type: string, extra: Partial<BlockItem> = {}): BlockItem =>
  ({ kind: 'block', type, ...extra }) as BlockItem

const textShadow = (value = '') => ({
  shadow: { type: 'text', fields: { TEXT: value } },
})
const numberShadow = (value: number) => ({
  shadow: { type: 'math_number', fields: { NUM: value } },
})

/** Blocks of one component: its events, then a setter and a getter per property. */
function componentItems(id: string, type: string, all: boolean): Item[] {
  const def = getComponentDef(type)
  if (!def) return []
  const items: Item[] = []
  for (const [event, info] of Object.entries(def.events)) {
    if (all || info.junior) {
      items.push(block(eventBlockType(type, event), { fields: { COMPONENT: id } }))
    }
  }
  const setters = propertyKeys(def, 'set').filter((entry) => all || entry.junior)
  for (const { key } of setters) {
    const prop = def.props[key]
    const kind = prop?.kind ?? 'string'
    // Start from the default value (text size 16, opacity 100…), but never from a text.
    const initial = prop && kind !== 'string' ? resolveDefault(prop, 'en') : undefined
    const shadow = shadowFor(kind, kind === 'boolean' ? true : initial)
    items.push(
      block(setterBlockType(type), {
        fields: { COMPONENT: id, PROP: key },
        ...(shadow ? { inputs: { VALUE: { shadow } } } : {}),
      }),
    )
  }
  for (const [method, info] of Object.entries(def.methods)) {
    if (all || info.junior)
      items.push(block(methodBlockType(type, method), { fields: { COMPONENT: id } }))
  }
  const getters = propertyKeys(def, 'get').filter((entry) => all || entry.junior)
  for (const { key } of getters) {
    items.push(block(getterBlockType(type), { fields: { COMPONENT: id, PROP: key } }))
  }
  return items
}

/**
 * The toolbox of a workspace (SPEC § 4.2): the blocks of the screen's components, then the
 * general categories. Junior gets a chosen subset unless `showAll` is on.
 */
export function buildToolbox(context: BlocksContext): Blockly.utils.toolbox.ToolboxDefinition {
  const t = messages[context.locale].blocks.categories
  const samples = messages[context.locale].blocks.samples
  const all = context.mode === 'studio' || context.showAll
  const contents: Item[] = []

  if (context.workspace !== APP_WORKSPACE) {
    const components = [...context.components].sort((a, b) =>
      a.type === SCREEN_TYPE ? -1 : b.type === SCREEN_TYPE ? 1 : 0,
    )
    const categories: Item[] = components
      .map((component) => ({
        kind: 'category',
        name: component.name,
        categorystyle: 'rx_component_category',
        contents: componentItems(component.id, component.type, all),
      }))
      .filter((category) => category.contents.length > 0) as Item[]
    contents.push({
      kind: 'category',
      name: t.components,
      categorystyle: 'rx_component_category',
      expanded: 'true',
      contents: categories.length ? categories : [{ kind: 'label', text: t.noComponents } as Item],
    } as Item)
  } else {
    contents.push({
      kind: 'category',
      name: t.app,
      categorystyle: 'rx_event_category',
      contents: [block(BLOCK_TYPES.appStart)],
    } as Item)
  }

  contents.push({ kind: 'sep' } as Item)

  contents.push({
    kind: 'category',
    name: t.control,
    categorystyle: 'loop_category',
    contents: [
      block('controls_if'),
      block('controls_if', { extraState: { hasElse: true } }),
      block('controls_repeat_ext', { inputs: { TIMES: numberShadow(10) } }),
      block(BLOCK_TYPES.forever),
      block(BLOCK_TYPES.wait, { inputs: { SECONDS: numberShadow(1) } }),
      ...(all
        ? [
            block('controls_whileUntil'),
            block('controls_for', {
              inputs: {
                FROM: numberShadow(1),
                TO: numberShadow(10),
                BY: numberShadow(1),
              },
            }),
            block('controls_forEach'),
            block('controls_flow_statements'),
          ]
        : []),
    ],
  } as Item)

  contents.push({
    kind: 'category',
    name: t.logic,
    categorystyle: 'logic_category',
    contents: [
      block('logic_compare'),
      block('logic_operation'),
      block('logic_negate'),
      block('logic_boolean'),
      ...(all ? [block('logic_null'), block('logic_ternary')] : []),
    ],
  } as Item)

  contents.push({
    kind: 'category',
    name: t.math,
    categorystyle: 'math_category',
    contents: [
      block('math_number', { fields: { NUM: 0 } }),
      block('math_arithmetic', {
        inputs: { A: numberShadow(1), B: numberShadow(1) },
      }),
      block('math_random_int', {
        inputs: { FROM: numberShadow(1), TO: numberShadow(6) },
      }),
      ...(all
        ? [
            block('math_single', { inputs: { NUM: numberShadow(9) } }),
            block('math_round', { inputs: { NUM: numberShadow(3.1) } }),
            block('math_modulo', {
              inputs: { DIVIDEND: numberShadow(64), DIVISOR: numberShadow(10) },
            }),
            block('math_number_property', {
              inputs: { NUMBER_TO_CHECK: numberShadow(0) },
            }),
            block('math_constrain', {
              inputs: {
                VALUE: numberShadow(50),
                LOW: numberShadow(1),
                HIGH: numberShadow(100),
              },
            }),
            block('math_random_float'),
            block('math_on_list'),
          ]
        : []),
    ],
  } as Item)

  contents.push({
    kind: 'category',
    name: t.text,
    categorystyle: 'text_category',
    contents: [
      block('text'),
      block('text_join'),
      block('text_length', { inputs: { VALUE: textShadow('abc') } }),
      ...(all
        ? [
            block('text_isEmpty', { inputs: { VALUE: textShadow() } }),
            block('text_indexOf', { inputs: { FIND: textShadow('b') } }),
            block('text_charAt'),
            block('text_getSubstring'),
            block('text_changeCase', { inputs: { TEXT: textShadow('abc') } }),
            block('text_trim', { inputs: { TEXT: textShadow(' abc ') } }),
            block('text_replace', {
              inputs: {
                FROM: textShadow('a'),
                TO: textShadow('b'),
                TEXT: textShadow('abc'),
              },
            }),
          ]
        : []),
    ],
  } as Item)

  if (all) {
    contents.push({
      kind: 'category',
      name: t.lists,
      categorystyle: 'list_category',
      contents: [
        block('lists_create_empty'),
        block('lists_create_with'),
        block('lists_repeat', { inputs: { NUM: numberShadow(5) } }),
        block('lists_length'),
        block('lists_isEmpty'),
        block('lists_indexOf'),
        block('lists_getIndex'),
        block('lists_setIndex'),
        block('lists_getSublist'),
        block('lists_split', { inputs: { DELIM: textShadow(',') } }),
        block('lists_sort'),
      ],
    } as Item)
    contents.push({
      kind: 'category',
      name: t.colors,
      categorystyle: 'colour_category',
      contents: [
        block('colour_picker'),
        block('colour_random'),
        block('colour_rgb'),
        block('colour_blend'),
      ],
    } as Item)
  }

  contents.push({
    kind: 'category',
    name: t.variables,
    categorystyle: 'variable_category',
    custom: 'VARIABLE',
  } as Item)

  if (all) {
    contents.push({
      kind: 'category',
      name: t.functions,
      categorystyle: 'procedure_category',
      custom: 'PROCEDURE',
    } as Item)
  }

  if (context.workspace !== APP_WORKSPACE) {
    contents.push({
      kind: 'category',
      name: t.screens,
      categorystyle: 'rx_screen_category',
      contents: [
        block(BLOCK_TYPES.screenOpen, {
          fields: {
            SCREEN: context.screens.find((s) => s.id !== context.workspace)?.id ?? '',
          },
        }),
        block(BLOCK_TYPES.screenBack),
      ],
    } as Item)
  }

  contents.push({
    kind: 'category',
    name: t.interface,
    categorystyle: 'rx_interface_category',
    contents: [
      block(BLOCK_TYPES.alert, {
        inputs: { MESSAGE: textShadow(samples.alert) },
      }),
      block(BLOCK_TYPES.toast, {
        inputs: { MESSAGE: textShadow(samples.toast) },
      }),
      ...(all
        ? [
            block(BLOCK_TYPES.confirm, {
              inputs: { MESSAGE: textShadow(samples.confirm) },
            }),
            block(BLOCK_TYPES.prompt, {
              inputs: { MESSAGE: textShadow(samples.prompt) },
            }),
          ]
        : []),
    ],
  } as Item)

  contents.push({
    kind: 'category',
    name: t.debug,
    categorystyle: 'rx_debug_category',
    contents: [block(BLOCK_TYPES.log, { inputs: { VALUE: textShadow(samples.log) } })],
  } as Item)

  return { kind: 'categoryToolbox', contents }
}
