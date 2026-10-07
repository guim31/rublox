import { COMPONENTS, type ComponentDef } from '@rublox/catalog'

/**
 * The block types a recipe may use, without loading Blockly (the server checks what the AI
 * proposes). A test in this package checks that Blockly registers each of them.
 */
export const GENERAL_BLOCK_TYPES: readonly string[] = [
  // Rublox
  'rx_app_start',
  'rx_forever',
  'rx_wait',
  'rx_log',
  'rx_screen_open',
  'rx_screen_back',
  'rx_ui_alert',
  'rx_ui_toast',
  'rx_ui_confirm',
  'rx_ui_prompt',
  'rx_event_value',
  'rx_app_call',
  'rx_app_call_value',
  // Control
  'controls_if',
  'controls_repeat_ext',
  'controls_whileUntil',
  'controls_for',
  'controls_forEach',
  'controls_flow_statements',
  // Logic
  'logic_compare',
  'logic_operation',
  'logic_negate',
  'logic_boolean',
  'logic_null',
  'logic_ternary',
  // Maths
  'math_number',
  'math_arithmetic',
  'math_random_int',
  'math_single',
  'math_round',
  'math_modulo',
  'math_number_property',
  'math_constrain',
  'math_random_float',
  'math_on_list',
  'math_change',
  // Text
  'text',
  'text_join',
  'text_length',
  'text_isEmpty',
  'text_indexOf',
  'text_charAt',
  'text_getSubstring',
  'text_changeCase',
  'text_trim',
  'text_replace',
  // Lists
  'lists_create_empty',
  'lists_create_with',
  'lists_repeat',
  'lists_length',
  'lists_isEmpty',
  'lists_indexOf',
  'lists_getIndex',
  'lists_setIndex',
  'lists_getSublist',
  'lists_split',
  'lists_sort',
  // Colours
  'colour_picker',
  'colour_random',
  'colour_rgb',
  'colour_blend',
  // Variables and functions
  'variables_get',
  'variables_set',
  'procedures_defnoreturn',
  'procedures_defreturn',
  'procedures_callnoreturn',
  'procedures_callreturn',
  'procedures_ifreturn',
]

export function propertyKeysOf(def: ComponentDef, access: 'get' | 'set'): string[] {
  return Object.entries(def.props)
    .filter(([, prop]) => prop.blocks === 'get-set' || prop.blocks === access)
    .map(([key]) => key)
}

/** What a component block is: `rx_Button_on_click` → the Button, its `click` event. */
export type ComponentBlock =
  | { def: ComponentDef; kind: 'event'; name: string }
  | { def: ComponentDef; kind: 'get' | 'set' }
  | { def: ComponentDef; kind: 'method'; name: string }

const componentBlocks = new Map<string, ComponentBlock>()
for (const def of COMPONENTS) {
  for (const name of Object.keys(def.events)) {
    componentBlocks.set(`rx_${def.type}_on_${name}`, { def, kind: 'event', name })
  }
  if (propertyKeysOf(def, 'get').length)
    componentBlocks.set(`rx_${def.type}_get`, { def, kind: 'get' })
  if (propertyKeysOf(def, 'set').length)
    componentBlocks.set(`rx_${def.type}_set`, { def, kind: 'set' })
  for (const name of Object.keys(def.methods)) {
    componentBlocks.set(`rx_${def.type}_call_${name}`, { def, kind: 'method', name })
  }
}

export function componentBlock(type: string): ComponentBlock | undefined {
  return componentBlocks.get(type)
}

const general = new Set(GENERAL_BLOCK_TYPES)

/** Whether a recipe may use this block type. */
export function isKnownBlockType(type: string): boolean {
  return general.has(type) || componentBlocks.has(type)
}

/** Every block type a recipe may use. */
export function knownBlockTypes(): string[] {
  return [...GENERAL_BLOCK_TYPES, ...componentBlocks.keys()]
}
