import type { BlocklyJson } from '@rublox/schema'

/** Small builders of Blockly JSON, to write demo projects as data. */

export const num = (value: number): BlocklyJson => ({ type: 'math_number', fields: { NUM: value } })
export const text = (value: string): BlocklyJson => ({ type: 'text', fields: { TEXT: value } })
export const random = (from: number, to: number): BlocklyJson => ({
  type: 'math_random_int',
  inputs: { FROM: { block: num(from) }, TO: { block: num(to) } },
})
export const variable = (id: string): BlocklyJson => ({
  type: 'variables_get',
  fields: { VAR: { id } },
})
export const join = (a: BlocklyJson, b: BlocklyJson): BlocklyJson => ({
  type: 'text_join',
  extraState: { itemCount: 2 },
  inputs: { ADD0: { block: a }, ADD1: { block: b } },
})
/** "<name> of the event", read inside an event block. */
export const eventValue = (name: string): BlocklyJson => ({
  type: 'rx_event_value',
  fields: { ARG: name },
})

/** Chains statements: each one's `next` is the following one. */
export function chain(...blocks: BlocklyJson[]): BlocklyJson {
  const [first, ...rest] = blocks
  if (!first) throw new Error('empty chain')
  return rest.length ? { ...first, next: { block: chain(...rest) } } : first
}

export const setVar = (id: string, value: BlocklyJson): BlocklyJson => ({
  type: 'variables_set',
  fields: { VAR: { id } },
  inputs: { VALUE: { block: value } },
})
export const changeVar = (id: string, delta: number): BlocklyJson => ({
  type: 'math_change',
  fields: { VAR: { id } },
  inputs: { DELTA: { block: num(delta) } },
})
export const set = (
  type: string,
  component: string,
  prop: string,
  value: BlocklyJson,
): BlocklyJson => ({
  type: `rx_${type}_set`,
  fields: { COMPONENT: component, PROP: prop },
  inputs: { VALUE: { block: value } },
})
export const call = (
  type: string,
  component: string,
  method: string,
  args: BlocklyJson[] = [],
): BlocklyJson => ({
  type: `rx_${type}_call_${method}`,
  fields: { COMPONENT: component },
  ...(args.length
    ? { inputs: Object.fromEntries(args.map((value, index) => [`ARG${index}`, { block: value }])) }
    : {}),
})
export const on = (
  type: string,
  component: string,
  event: string,
  body: BlocklyJson,
  at: { x: number; y: number },
  filter?: string,
): BlocklyJson => ({
  type: `rx_${type}_on_${event}`,
  id: `${component}-${event}`,
  ...at,
  fields: { COMPONENT: component, ...(filter ? { FILTER: filter } : {}) },
  inputs: { DO: { block: body } },
})
