/**
 * A small language to write the levels of the apps to take apart (J9). The levels are data,
 * in `content/explore/<app>/niveau-<n>/` (SPEC § 6.2); writing pages of nested Blockly JSON by
 * hand would hide what each level adds, so they are written here and `generate.ts` writes the
 * JSON (a test checks that it is up to date).
 *
 * Every statement block takes an explicit id: a block keeps its id from one level to the next,
 * which is how "Show me what's new" finds what a level adds. Value blocks get an id from their
 * parent's (`<parent>/<input>`), so that a value changed in a later level keeps its id too.
 * Texts are `{ fr, en }`; a level is built in one language.
 */

export type Text = string | { fr: string; en: string }

/** A Blockly JSON block, before ids are given to its values. */
export type Block = {
  type: string
  id?: string
  fields?: Record<string, unknown>
  inputs?: Record<string, { block: Block }>
  extraState?: Record<string, unknown>
  next?: { block: Block }
  icons?: {
    comment: {
      text: Text
      pinned: boolean
      width: number
      height: number
      x?: number
      y?: number
    }
  }
  x?: number
  y?: number
}

type Value = Block

/** Puts `{ fr, en }` texts as they are: the recipe is localized when built. */
const t = (value: Text) => value

// Values

export const num = (value: number): Value => ({ type: 'math_number', fields: { NUM: value } })
export const str = (value: Text): Value => ({ type: 'text', fields: { TEXT: t(value) } })
export const bool = (value: boolean): Value => ({
  type: 'logic_boolean',
  fields: { BOOL: value ? 'TRUE' : 'FALSE' },
})
export const v = (name: string): Value => ({ type: 'variables_get', fields: { VAR: name } })
export const join = (...parts: Value[]): Value => ({
  type: 'text_join',
  extraState: { itemCount: parts.length },
  inputs: Object.fromEntries(parts.map((part, index) => [`ADD${index}`, { block: part }])),
})
type Compare = '=' | '≠' | '<' | '≤' | '>' | '≥'
const COMPARE: Record<Compare, string> = {
  '=': 'EQ',
  '≠': 'NEQ',
  '<': 'LT',
  '≤': 'LTE',
  '>': 'GT',
  '≥': 'GTE',
}
export const cmp = (a: Value, op: Compare, b: Value): Value => ({
  type: 'logic_compare',
  fields: { OP: COMPARE[op] },
  inputs: { A: { block: a }, B: { block: b } },
})
export const and = (a: Value, b: Value): Value => ({
  type: 'logic_operation',
  fields: { OP: 'AND' },
  inputs: { A: { block: a }, B: { block: b } },
})
export const or = (a: Value, b: Value): Value => ({
  type: 'logic_operation',
  fields: { OP: 'OR' },
  inputs: { A: { block: a }, B: { block: b } },
})
export const not = (a: Value): Value => ({ type: 'logic_negate', inputs: { BOOL: { block: a } } })
type Arith = '+' | '-' | '×' | '÷'
const ARITH: Record<Arith, string> = { '+': 'ADD', '-': 'MINUS', '×': 'MULTIPLY', '÷': 'DIVIDE' }
export const math = (a: Value, op: Arith, b: Value): Value => ({
  type: 'math_arithmetic',
  fields: { OP: ARITH[op] },
  inputs: { A: { block: a }, B: { block: b } },
})
export const random = (from: Value | number, to: Value | number): Value => ({
  type: 'math_random_int',
  inputs: {
    FROM: { block: typeof from === 'number' ? num(from) : from },
    TO: { block: typeof to === 'number' ? num(to) : to },
  },
})
export const round = (value: Value): Value => ({
  type: 'math_round',
  fields: { OP: 'ROUND' },
  inputs: { NUM: { block: value } },
})
/** A number kept between `low` and `high`. */
export const between = (value: Value, low: number, high: number): Value => ({
  type: 'math_constrain',
  inputs: { VALUE: { block: value }, LOW: { block: num(low) }, HIGH: { block: num(high) } },
})
/** Gives a value block its own id: it keeps it when it moves to another input. */
export const named = (id: string, value: Value): Value => ({ ...value, id })
/** A property of a component: `prop('Sprite', 'star', 'x')`. */
export const prop = (type: string, component: string, name: string): Value => ({
  type: `rx_${type}_get`,
  fields: { COMPONENT: component, PROP: name },
})
/** A method that returns a value. */
export const ask = (type: string, component: string, method: string, ...args: Value[]): Value => ({
  type: `rx_${type}_call_${method}`,
  fields: { COMPONENT: component },
  ...(args.length
    ? { inputs: Object.fromEntries(args.map((arg, index) => [`ARG${index}`, { block: arg }])) }
    : {}),
})
/** A value of the event the block is in. */
export const ev = (name: string): Value => ({ type: 'rx_event_value', fields: { ARG: name } })
export const list = (...items: Value[]): Value => ({
  type: 'lists_create_with',
  extraState: { itemCount: items.length },
  inputs: Object.fromEntries(items.map((item, index) => [`ADD${index}`, { block: item }])),
})
export const emptyList = (): Value => ({ type: 'lists_create_empty' })
export const item = (from: Value, at: Value | number): Value => ({
  type: 'lists_getIndex',
  fields: { MODE: 'GET', WHERE: 'FROM_START' },
  inputs: { VALUE: { block: from }, AT: { block: typeof at === 'number' ? num(at) : at } },
})
export const length = (of: Value): Value => ({
  type: 'lists_length',
  inputs: { VALUE: { block: of } },
})
export const split = (text: Value, by: Text): Value => ({
  type: 'lists_split',
  fields: { MODE: 'SPLIT' },
  extraState: { mode: 'SPLIT' },
  inputs: { INPUT: { block: text }, DELIM: { block: str(by) } },
})
/** A function that returns a value. */
export const result = (name: Text): Value => ({
  type: 'procedures_callreturn',
  extraState: { name: t(name) },
})

// Statements: each one takes its id.

const statement = (id: string, block: Block): Block => ({ ...block, id })

export const setVar = (id: string, name: string, value: Value): Block =>
  statement(id, {
    type: 'variables_set',
    fields: { VAR: name },
    inputs: { VALUE: { block: value } },
  })
export const change = (id: string, name: string, by: Value | number): Block =>
  statement(id, {
    type: 'math_change',
    fields: { VAR: name },
    inputs: { DELTA: { block: typeof by === 'number' ? num(by) : by } },
  })
/** Sets a property: `set('s', 'Sprite', 'star', 'vy', num(150))`. */
export const set = (id: string, type: string, component: string, name: string, value: Value) =>
  statement(id, {
    type: `rx_${type}_set`,
    fields: { COMPONENT: component, PROP: name },
    inputs: { VALUE: { block: value } },
  })
/** Calls a method of a component. */
export const call = (
  id: string,
  type: string,
  component: string,
  method: string,
  ...args: Value[]
) => statement(id, ask(type, component, method, ...args))
/** Calls a function of the workspace. */
export const run = (id: string, name: Text): Block =>
  statement(id, { type: 'procedures_callnoreturn', extraState: { name: t(name) } })
export const wait = (id: string, seconds: number): Block =>
  statement(id, { type: 'rx_wait', inputs: { SECONDS: { block: num(seconds) } } })
export const open = (id: string, screen: string): Block =>
  statement(id, { type: 'rx_screen_open', fields: { SCREEN: screen } })
export const toast = (id: string, text: Value): Block =>
  statement(id, { type: 'rx_ui_toast', inputs: { TEXT: { block: text } } })
export const forever = (id: string, body: Block[]): Block =>
  statement(id, { type: 'rx_forever', inputs: chainInput('DO', body) })
export const repeat = (id: string, times: Value | number, body: Block[]): Block =>
  statement(id, {
    type: 'controls_repeat_ext',
    inputs: {
      TIMES: { block: typeof times === 'number' ? num(times) : times },
      ...chainInput('DO', body),
    },
  })
/** "count with i from … to … by …". */
export const count = (
  id: string,
  name: string,
  from: Value | number,
  to: Value | number,
  by: Value | number,
  body: Block[],
): Block =>
  statement(id, {
    type: 'controls_for',
    fields: { VAR: name },
    inputs: {
      FROM: { block: typeof from === 'number' ? num(from) : from },
      TO: { block: typeof to === 'number' ? num(to) : to },
      BY: { block: typeof by === 'number' ? num(by) : by },
      ...chainInput('DO', body),
    },
  })
export const forEach = (id: string, name: string, of: Value, body: Block[]): Block =>
  statement(id, {
    type: 'controls_forEach',
    fields: { VAR: name },
    inputs: { LIST: { block: of }, ...chainInput('DO', body) },
  })
/** "if … then … else …" (`otherwise` adds the else). */
export const when = (id: string, test: Value, then: Block[], otherwise?: Block[]): Block =>
  statement(id, {
    type: 'controls_if',
    ...(otherwise ? { extraState: { hasElse: true } } : {}),
    inputs: {
      IF0: { block: test },
      ...chainInput('DO0', then),
      ...(otherwise ? chainInput('ELSE', otherwise) : {}),
    },
  })
/** Adds at the end of a list. */
export const push = (id: string, name: string, value: Value): Block =>
  statement(id, {
    type: 'lists_setIndex',
    fields: { MODE: 'INSERT', WHERE: 'LAST' },
    inputs: { LIST: { block: v(name) }, TO: { block: value } },
  })
/** Replaces the item at `at` of a list. */
export const put = (id: string, name: string, at: Value, value: Value): Block =>
  statement(id, {
    type: 'lists_setIndex',
    fields: { MODE: 'SET', WHERE: 'FROM_START' },
    inputs: { LIST: { block: v(name) }, AT: { block: at }, TO: { block: value } },
  })
/**
 * A short comment on a block. On the top block of a stack, it is shown open in the margin, at
 * the left of the stack (`stamp`); on a block inside, it is folded behind the block's "?" icon.
 */
export function note<T extends Block>(block: T, text: Text, width = 0, height = 0): T {
  return {
    ...block,
    icons: { comment: { text: t(text), pinned: false, width: width || 230, height: height || 0 } },
  }
}

function chainInput(name: string, body: Block[]): Record<string, { block: Block }> {
  const first = chain(body)
  return first ? { [name]: { block: first } } : {}
}

/** Statements one under the other. */
export function chain(blocks: Block[]): Block | undefined {
  const [first, ...rest] = blocks
  if (!first) return undefined
  const next = chain(rest)
  return next ? { ...first, next: { block: next } } : first
}

// Stacks

/** "when <component> <event>": `on('start', 'GameScene', 'sky', 'start', [...])`. */
export const on = (
  id: string,
  type: string,
  component: string,
  event: string,
  body: Block[],
  filter?: string,
): Block =>
  statement(id, {
    type: `rx_${type}_on_${event}`,
    fields: { COMPONENT: component, ...(filter ? { FILTER: filter } : {}) },
    inputs: chainInput('DO', body),
  })

/** A function without a result, named in words ("make a star fall"). */
export const fn = (id: string, name: Text, body: Block[]): Block =>
  statement(id, {
    type: 'procedures_defnoreturn',
    fields: { NAME: t(name) },
    inputs: chainInput('STACK', body),
  })

/** A function with a result. */
export const fnResult = (id: string, name: Text, body: Block[], value: Value): Block =>
  statement(id, {
    type: 'procedures_defreturn',
    fields: { NAME: t(name) },
    inputs: { ...chainInput('STACK', body), RETURN: { block: value } },
  })

/** Room for the comments in the margin, at the left of the stacks. */
const MARGIN = 300
const NOTE_WIDTH = 260

/** Height of a comment's bubble for its longest translation (about 30 letters a line). */
function noteHeight(text: Text): number {
  const longest = typeof text === 'string' ? text.length : Math.max(text.fr.length, text.en.length)
  return 28 + 20 * Math.ceil(longest / 30)
}

/**
 * Gives every value block an id from its parent's, and checks that statements have theirs.
 * Stacks are laid out in a column, in their order; the comment of a stack's top block is
 * shown open, in the margin at its left.
 */
export function stamp(stacks: Block[]): Block[] {
  let y = 40
  return stacks.map((stack) => {
    const done = visit(stack, undefined, '')
    done.x = stack.x ?? MARGIN
    done.y = stack.y ?? y
    const comment = done.icons?.comment
    let height = 0
    if (comment) {
      height = noteHeight(comment.text)
      done.icons = {
        comment: { ...comment, pinned: true, width: NOTE_WIDTH, height, x: 16, y: done.y },
      }
    }
    for (const inner of innerBlocks(done)) {
      const note = inner.icons?.comment
      if (note) inner.icons = { comment: { ...note, height: note.height || noteHeight(note.text) } }
    }
    y = (done.y as number) + Math.max(90 + 46 * size(done), height + 40)
    return done
  })
}

/** Every block of a stack but its top one. */
function innerBlocks(block: Block): Block[] {
  const found: Block[] = []
  const walk = (current: Block) => {
    for (const { block: child } of Object.values(current.inputs ?? {})) {
      found.push(child)
      walk(child)
    }
    if (current.next) {
      found.push(current.next.block)
      walk(current.next.block)
    }
  }
  walk(block)
  return found
}

function visit(block: Block, parent: string | undefined, input: string): Block {
  const id = block.id ?? (parent ? `${parent}/${input.toLowerCase()}` : undefined)
  if (!id) throw new Error(`a block of type ${block.type} has no id`)
  const copy: Block = { ...block, id }
  if (block.inputs) {
    copy.inputs = Object.fromEntries(
      Object.entries(block.inputs).map(([name, { block: child }]) => [
        name,
        { block: visit(child, id, name) },
      ]),
    )
  }
  if (block.next) {
    if (!block.next.block.id) throw new Error(`the block after ${id} has no id`)
    copy.next = { block: visit(block.next.block, undefined, '') }
  }
  return copy
}

/** Rows a stack takes, to space the column of stacks. */
function size(block: Block): number {
  let rows = 1
  for (const [name, { block: child }] of Object.entries(block.inputs ?? {})) {
    if (/^(DO|DO0|ELSE|STACK)$/.test(name)) rows += size(child)
  }
  if (block.next) rows += size(block.next.block)
  return rows
}

/** "if … then … else …" as a value. */
export const choose = (test: Value, then: Value, otherwise: Value): Value => ({
  type: 'logic_ternary',
  inputs: { IF: { block: test }, THEN: { block: then }, ELSE: { block: otherwise } },
})
