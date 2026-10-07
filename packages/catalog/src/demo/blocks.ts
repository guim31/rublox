import type { BlocklyJson } from '@rublox/schema'

/** Small builders of saved Blockly stacks, to write the demo app's blocks as data. */

export const text = (value: string): BlocklyJson => ({ type: 'text', fields: { TEXT: value } })
export const num = (value: number): BlocklyJson => ({ type: 'math_number', fields: { NUM: value } })
export const bool = (value: boolean): BlocklyJson => ({
  type: 'logic_boolean',
  fields: { BOOL: value ? 'TRUE' : 'FALSE' },
})
export const eventValue = (arg: string): BlocklyJson => ({
  type: 'rx_event_value',
  fields: { ARG: arg },
})
export const variable = (id: string): BlocklyJson => ({
  type: 'variables_get',
  fields: { VAR: { id } },
})

export function join(...parts: BlocklyJson[]): BlocklyJson {
  return {
    type: 'text_join',
    extraState: { itemCount: parts.length },
    inputs: Object.fromEntries(parts.map((part, i) => [`ADD${i}`, { block: part }])),
  }
}

/** Statements one after the other. */
export function chain(blocks: BlocklyJson[]): BlocklyJson | undefined {
  const [first, ...rest] = blocks
  if (!first) return undefined
  const next = chain(rest)
  return next ? { ...first, next: { block: next } } : first
}

let y = 0

/** "when <component> <event>": a top block, placed under the previous one. */
export function on(
  type: string,
  event: string,
  component: string,
  body: BlocklyJson[],
): BlocklyJson {
  y += 160
  const first = chain(body)
  return {
    type: `rx_${type}_on_${event}`,
    x: 20,
    y,
    fields: { COMPONENT: component },
    ...(first ? { inputs: { DO: { block: first } } } : {}),
  }
}

export function set(type: string, component: string, prop: string, value: BlocklyJson) {
  return {
    type: `rx_${type}_set`,
    fields: { COMPONENT: component, PROP: prop },
    inputs: { VALUE: { block: value } },
  } satisfies BlocklyJson
}

export function get(type: string, component: string, prop: string): BlocklyJson {
  return { type: `rx_${type}_get`, fields: { COMPONENT: component, PROP: prop } }
}

export function call(
  type: string,
  component: string,
  method: string,
  args: BlocklyJson[] = [],
): BlocklyJson {
  return {
    type: `rx_${type}_call_${method}`,
    fields: { COMPONENT: component },
    inputs: Object.fromEntries(args.map((arg, i) => [`ARG${i}`, { block: arg }])),
  }
}

export const toast = (message: BlocklyJson): BlocklyJson => ({
  type: 'rx_ui_toast',
  inputs: { MESSAGE: { block: message } },
})

export const log = (value: BlocklyJson): BlocklyJson => ({
  type: 'rx_log',
  inputs: { VALUE: { block: value } },
})

export const openScreen = (screen: string): BlocklyJson => ({
  type: 'rx_screen_open',
  fields: { SCREEN: screen },
})

export function stacks(...tops: BlocklyJson[]): Record<string, BlocklyJson> {
  return Object.fromEntries(tops.map((top, i) => [`s${i + 1}`, { ...top, id: `s${i + 1}` }]))
}
