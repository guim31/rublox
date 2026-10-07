import { COMPONENTS, ICON_NAMES } from '@rublox/catalog'
import { propertyKeysOf } from './blocks.ts'

/**
 * What the AI assistant needs to write a recipe (`AppSpec`): the components of the catalog
 * with their properties, events and methods, and the blocks with their fields and inputs.
 * Generated from the catalog, in English, always in the same order (it is the cached part of
 * the prompt).
 */
export function catalogReference(): string {
  const lines: string[] = []
  lines.push('## Components')
  lines.push(
    'Format: Type (visible|invisible[, container]) — description. Properties: name:kind=default. Events (args). Methods(args) -> result.',
  )
  for (const def of COMPONENTS) {
    if (!def.palette) continue
    const strings = def.strings.en
    const flags = [def.visible ? 'visible' : 'invisible']
    if (def.container) flags.push('container')
    if (def.parents) flags.push(`only inside ${def.parents.join('/')}`)
    if (def.accepts) flags.push(`accepts ${def.accepts.join('/')}`)
    lines.push('')
    lines.push(`### ${def.type} (${flags.join(', ')}) — ${strings.description}`)
    const props = Object.entries(def.props)
      .filter(([, prop]) => !prop.state)
      .map(([key, prop]) => {
        const kind = prop.kind === 'enum' ? `enum(${prop.values?.join('|')})` : prop.kind
        const value =
          prop.default && typeof prop.default === 'object' && 'en' in prop.default
            ? (prop.default as { en: unknown }).en
            : prop.default
        return `${key}:${kind}=${JSON.stringify(value)}`
      })
    lines.push(`Properties: ${props.join(', ')}`)
    const state = Object.entries(def.props)
      .filter(([, prop]) => prop.state)
      .map(([key]) => key)
    if (state.length) lines.push(`Read-only state (blocks only): ${state.join(', ')}`)
    const events = Object.entries(def.events).map(([name, info]) => {
      const args = Object.keys(info.args)
      const filter = info.filter
        ? ` FILTER=${info.filter.kind === 'component' ? `a ${info.filter.componentType} or "*"` : `"*"|${info.filter.values.join('|')}`}`
        : ''
      return `${name}${args.length ? `(${args.join(', ')})` : ''}${filter}`
    })
    if (events.length) lines.push(`Events: ${events.join(', ')}`)
    const methods = Object.entries(def.methods).map(([name, info]) => {
      const args = Object.entries(info.args).map(
        ([arg, argDef]) =>
          `${arg}:${argDef.kind === 'component' ? `${argDef.componentType} (a field)` : argDef.kind}`,
      )
      return `${name}(${args.join(', ')})${info.returns ? ` -> ${info.returns}` : ''}`
    })
    if (methods.length) lines.push(`Methods: ${methods.join(', ')}`)
    const gets = propertyKeysOf(def, 'get')
    const sets = propertyKeysOf(def, 'set')
    if (gets.length) lines.push(`Readable by blocks: ${gets.join(', ')}`)
    if (sets.length) lines.push(`Writable by blocks: ${sets.join(', ')}`)
  }
  lines.push('')
  lines.push(`Icon names (icon properties, navIcon): ${ICON_NAMES.join(', ')}`)
  lines.push('')
  lines.push(BLOCKS_REFERENCE)
  return lines.join('\n')
}

const BLOCKS_REFERENCE = `## Blocks (Blockly JSON)
Each stack is one top block: { "type": …, "fields": {…}, "inputs": { NAME: { "block": {…} } }, "next": { "block": {…} } }.
Statements chain with "next". Value inputs take one block. Lists are 1-based.
Component, screen and variable fields hold the NAME (or key) of the component, screen or variable.

Component blocks (Type = the component type):
- rx_<Type>_on_<event>: fields COMPONENT (+ FILTER when the event has one); statement input DO. A top block.
- rx_<Type>_get: fields COMPONENT, PROP (a readable property). Value.
- rx_<Type>_set: fields COMPONENT, PROP (a writable property); input VALUE. Statement.
- rx_<Type>_call_<method>: field COMPONENT; inputs ARG0, ARG1… in the method's order (a component argument is a field ARGn holding a name). Statement, or value when the method returns something.
- rx_event_value: field ARG (one of the args of the enclosing event). Value, only inside that event.

General blocks:
- rx_app_start (app workspace only): statement input DO. Runs when the app starts.
- rx_forever: statement input DO (endless loop, safe). rx_wait: input SECONDS (number).
- rx_log: input VALUE (console). rx_ui_alert, rx_ui_toast: input MESSAGE. rx_ui_confirm (-> boolean), rx_ui_prompt (-> text): input MESSAGE.
- rx_screen_open: field SCREEN (a screen name). rx_screen_back.
- controls_if: inputs IF0, DO0 (…IFn, DOn), ELSE; extraState { "elseIfCount": n, "hasElse": true }.
- controls_repeat_ext: inputs TIMES, DO. controls_whileUntil: field MODE WHILE|UNTIL, inputs BOOL, DO.
- controls_for: field VAR, inputs FROM, TO, BY, DO. controls_forEach: field VAR, inputs LIST, DO. controls_flow_statements: field FLOW BREAK|CONTINUE.
- logic_compare: field OP EQ|NEQ|LT|LTE|GT|GTE, inputs A, B. logic_operation: field OP AND|OR, inputs A, B. logic_negate: input BOOL. logic_boolean: field BOOL TRUE|FALSE. logic_ternary: inputs IF, THEN, ELSE.
- math_number: field NUM. math_arithmetic: field OP ADD|MINUS|MULTIPLY|DIVIDE|POWER, inputs A, B. math_random_int: inputs FROM, TO. math_round: field OP ROUND|ROUNDUP|ROUNDDOWN, input NUM. math_modulo: inputs DIVIDEND, DIVISOR. math_single: field OP ROOT|ABS|NEG, input NUM. math_change: field VAR, input DELTA.
- text: field TEXT. text_join: extraState { "itemCount": n }, inputs ADD0…ADDn-1. text_length, text_isEmpty: input VALUE. text_changeCase: field CASE UPPERCASE|LOWERCASE|TITLECASE, input TEXT. text_trim: field MODE BOTH, input TEXT.
- lists_create_empty. lists_create_with: extraState { "itemCount": n }, inputs ADD0…. lists_length, lists_isEmpty: input VALUE. lists_getIndex: fields MODE GET|REMOVE, WHERE FROM_START|FROM_END|FIRST|LAST|RANDOM, inputs VALUE (the list), AT. lists_setIndex: fields MODE SET|INSERT, WHERE FROM_START|LAST…, inputs LIST, AT, TO. lists_indexOf: field END FIRST, inputs VALUE, FIND. lists_split: field MODE SPLIT|JOIN, inputs INPUT, DELIM.
- colour_picker: field COLOUR "#rrggbb". colour_random.
- variables_get: field VAR. variables_set: field VAR, input VALUE.
- procedures_defnoreturn / procedures_defreturn (app workspace for shared functions): field NAME, extraState { "params": [{ "name": "x" }] }, input STACK (and RETURN for defreturn). In a screen, call a shared function with rx_app_call (field FUNCTION, extraState { "params": [...] }, inputs ARG0…) or rx_app_call_value.`
