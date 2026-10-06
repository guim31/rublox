import { COMPONENTS, type ComponentDef } from '@rublox/catalog'
import { format, messages } from '@rublox/i18n'
import { isValidName } from '@rublox/schema'
import type * as Blockly from 'blockly/core'
import { JavascriptGenerator, javascriptGenerator, Order } from 'blockly/javascript'
import { type BlocksContext, contextOf } from './context.ts'
import {
  BLOCK_TYPES,
  type EventArgRef,
  eventBlockType,
  getterBlockType,
  isFieldArg,
  methodBlockType,
  setterBlockType,
} from './definitions.ts'
import { ANY } from './fields.ts'
import { registerColourBlocks } from './setup.ts'

/** Parameters every generated module receives (SPEC § 6.5). */
export const MODULE_PARAMS = [
  'components',
  'app',
  'stored',
  'shared',
  'screens',
  'ui',
  'device',
  'rx',
]

// Statement markers, stripped after generation to build the line → block map. Private-use
// characters: `quote` escapes them, so text typed in a block can never forge one.
const MARK_START = ''
const MARK_END = ''
const MARKER = new RegExp(`^\\s*${MARK_START}'((?:[^'\\\\]|\\\\.)*)'${MARK_END}\\s*$`)

/**
 * A JavaScript string literal for any text: quotes, backslashes, line breaks, `</script>`,
 * `${…}` and invisible characters all stay inside the string.
 */
export function quote(text: string): string {
  let out = "'"
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    if (char === '\\') out += '\\\\'
    else if (char === "'") out += "\\'"
    else if (char === '\n') out += '\\n'
    else if (char === '\r') out += '\\r'
    else if (char === '\t') out += '\\t'
    else if (
      code < 0x20 ||
      code === 0x7f ||
      code === 0x2028 ||
      code === 0x2029 ||
      (code >= 0xe000 && code <= 0xf8ff) ||
      (code >= 0xd800 && code <= 0xdfff)
    ) {
      out += `\\u${code.toString(16).padStart(4, '0')}`
    } else out += char
  }
  return `${out}'`
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** `app.score`, or `app['mon score']` when the name is not an identifier. */
function member(object: string, name: string): string {
  return isValidName(name) || /^[\p{L}_$][\p{L}\p{N}_$]*$/u.test(name)
    ? `${object}.${name}`
    : `${object}[${quote(name)}]`
}

/**
 * Generates the readable module of one workspace. Built on Blockly's JavaScript generator,
 * with these differences:
 *
 * - variables are the app's (`app.score`), except function parameters;
 * - functions and event handlers are `async`, calls and waits use `await`;
 * - every loop starts with `await rx.tick()`, so an endless loop never freezes anything;
 * - only event blocks and function definitions produce code: a loose block does nothing.
 */
export class RubloxGenerator extends JavascriptGenerator {
  context!: BlocksContext
  /** Component names the code uses, for the `const { … } = components` line. */
  readonly usedComponents = new Set<string>()
  /** Variable ids of the parameters of the function being generated. */
  private parameters = new Set<string>()
  private workspace?: Blockly.Workspace

  constructor() {
    super('Rublox')
    registerColourBlocks()
    Object.assign(this.forBlock, javascriptGenerator.forBlock)
    this.INFINITE_LOOP_TRAP = 'await rx.tick();\n'
    this.STATEMENT_PREFIX = `${MARK_START}%1${MARK_END}\n`
    this.addReservedWords(MODULE_PARAMS.join(','))
    installBlockGenerators(this)
  }

  override init(workspace: Blockly.Workspace): void {
    super.init(workspace)
    this.workspace = workspace
    this.context = contextOf(workspace)
    this.usedComponents.clear()
    this.parameters.clear()
    // App variables live in `app`, not in local declarations.
    delete this.definitions_.variables
  }

  /** Helper functions (Blockly's `provideFunction_`), placed above the module. */
  helpers(): string[] {
    return Object.values(this.definitions_)
  }

  override quote_(text: string): string {
    return quote(text)
  }

  override multiline_quote_(text: string): string {
    return quote(text)
  }

  override getVariableName(id: string): string {
    const variable = this.workspace?.getVariableMap().getVariableById(id)
    const name = variable?.getName() ?? id
    if (this.parameters.has(id)) return super.getVariableName(id)
    return member('app', name)
  }

  /** The name of a component of the screen, or `null` (and a comment) when it was deleted. */
  componentName(id: string): string | null {
    const component = this.context.components.find((c) => c.id === id)
    if (!component) return null
    this.usedComponents.add(component.name)
    return component.name
  }

  screenName(id: string): string | null {
    return this.context.screens.find((screen) => screen.id === id)?.name ?? null
  }

  /**
   * The parameter name of an event argument: its own name (`dt`, `other`), with a `_` when a
   * component of the screen already has that name.
   */
  argParam(arg: string): string {
    const taken = this.context.components.some((c) => c.name === arg)
    return taken || MODULE_PARAMS.includes(arg) ? `${arg}_` : arg
  }

  missing(): string {
    return messages[this.context.locale].blocks.code.missingComponent
  }

  withParameters<T>(ids: string[], run: () => T): T {
    const previous = this.parameters
    this.parameters = new Set(ids)
    try {
      return run()
    } finally {
      this.parameters = previous
    }
  }

  /** Top blocks that produce code, in a stable order: app start, functions, then events. */
  codeBlocks(workspace: Blockly.Workspace): Blockly.Block[] {
    const rank = (block: Blockly.Block) => {
      if (block.type === BLOCK_TYPES.appStart) return 0
      if (block.type.startsWith('procedures_def')) return 1
      return 2
    }
    return workspace
      .getTopBlocks(true)
      .filter((block) => block.isEnabled() && isHat(block))
      .sort((a, b) => rank(a) - rank(b))
  }
}

function isHat(block: Blockly.Block): boolean {
  return (
    block.type === BLOCK_TYPES.appStart ||
    block.type.startsWith('procedures_def') ||
    /^rx_\w+_on_\w+$/.test(block.type)
  )
}

type Gen = RubloxGenerator

function installBlockGenerators(generator: Gen): void {
  const f = generator.forBlock as Record<
    string,
    (block: Blockly.Block, g: Gen) => string | [string, number] | null
  >

  f[BLOCK_TYPES.appStart] = (block, g) => {
    const body = g.statementToCode(block, 'DO')
    const comment = `// ${messages[g.context.locale].blocks.code.appStart}\n`
    return comment + body.replace(/^ {2}/gm, '')
  }

  f[BLOCK_TYPES.forever] = (block, g) => {
    const body = g.addLoopTrap(g.statementToCode(block, 'DO'), block)
    return `while (true) {\n${body}}\n`
  }

  f[BLOCK_TYPES.wait] = (block, g) => {
    const seconds = g.valueToCode(block, 'SECONDS', Order.NONE) || '1'
    return `await rx.wait(${seconds});\n`
  }

  f[BLOCK_TYPES.log] = (block, g) =>
    `rx.log(${g.valueToCode(block, 'VALUE', Order.NONE) || "''"});\n`

  f[BLOCK_TYPES.screenOpen] = (block, g) => {
    const name = g.screenName(block.getFieldValue('SCREEN'))
    return name ? `screens.open(${quote(name)});\n` : `// screens.open(?)\n`
  }

  f[BLOCK_TYPES.screenBack] = () => 'screens.back();\n'

  f[BLOCK_TYPES.alert] = (block, g) =>
    `await ui.alert(${g.valueToCode(block, 'MESSAGE', Order.NONE) || "''"});\n`
  f[BLOCK_TYPES.toast] = (block, g) =>
    `ui.toast(${g.valueToCode(block, 'MESSAGE', Order.NONE) || "''"});\n`
  f[BLOCK_TYPES.confirm] = (block, g) => [
    `await ui.confirm(${g.valueToCode(block, 'MESSAGE', Order.NONE) || "''"})`,
    Order.AWAIT,
  ]
  f[BLOCK_TYPES.prompt] = (block, g) => [
    `await ui.prompt(${g.valueToCode(block, 'MESSAGE', Order.NONE) || "''"})`,
    Order.AWAIT,
  ]

  // Blockly's console output would be `window.alert`: send it to the console panel instead.
  f.text_print = (block, g) => `rx.log(${g.valueToCode(block, 'TEXT', Order.NONE) || "''"});\n`

  // Functions: defined inside the module (they see the components) and always async.
  const definition = (block: Blockly.Block, g: Gen) => {
    const name = g.getProcedureName(block.getFieldValue('NAME'))
    const variables = block.getVarModels?.() ?? []
    const ids = variables.map((variable) => variable.getId())
    return g.withParameters(ids, () => {
      const params = ids.map((id) => g.getVariableName(id))
      let body = g.statementToCode(block, 'STACK')
      if (g.INFINITE_LOOP_TRAP) {
        body = g.prefixLines(g.injectId(g.INFINITE_LOOP_TRAP, block), g.INDENT) + body
      }
      const returned = block.getInput('RETURN') ? g.valueToCode(block, 'RETURN', Order.NONE) : ''
      if (returned) body += `${g.INDENT}return ${returned};\n`
      return `async function ${name}(${params.join(', ')}) {\n${body}}\n`
    })
  }
  f.procedures_defnoreturn = definition
  f.procedures_defreturn = definition
  const call = (block: Blockly.Block, g: Gen): [string, number] => {
    const name = g.getProcedureName(block.getFieldValue('NAME'))
    const args = (block.getVarModels?.() ?? []).map(
      (_, index) => g.valueToCode(block, `ARG${index}`, Order.NONE) || 'null',
    )
    return [`await ${name}(${args.join(', ')})`, Order.AWAIT]
  }
  f.procedures_callreturn = call
  f.procedures_callnoreturn = (block, g) => `${call(block, g)[0]};\n`

  f[BLOCK_TYPES.eventArg] = (block, g) => {
    const ref = (block as Blockly.Block & { argRef?: EventArgRef }).argRef
    const root = block.getRootBlock()
    if (!ref || root.type !== eventBlockType(ref.type, ref.event))
      return ['undefined', Order.ATOMIC]
    return [g.argParam(ref.arg), Order.ATOMIC]
  }

  for (const def of COMPONENTS) {
    for (const event of Object.keys(def.events)) {
      f[eventBlockType(def.type, event)] = (block, g) => {
        const name = g.componentName(block.getFieldValue('COMPONENT'))
        if (!name) return `// ${g.missing()}\n`
        const filter = eventFilterCode(def, event, block, g)
        if (filter === null) return `// ${g.missing()}\n`
        const body = g.statementToCode(block, 'DO')
        const params = [
          ...(def.clonable ? [name] : []),
          ...Object.keys(def.events[event]?.args ?? {}).map((arg) => g.argParam(arg)),
        ]
        return `${name}.on${capitalize(event)}(${filter}async (${params.join(', ')}) => {\n${body}});\n`
      }
    }
    f[getterBlockType(def.type)] = (block, g) => {
      const name = g.componentName(block.getFieldValue('COMPONENT'))
      const prop = block.getFieldValue('PROP')
      return name ? [`${name}.${prop}`, Order.MEMBER] : ['undefined', Order.ATOMIC]
    }
    f[setterBlockType(def.type)] = (block, g) => {
      const name = g.componentName(block.getFieldValue('COMPONENT'))
      const prop = block.getFieldValue('PROP')
      const value = g.valueToCode(block, 'VALUE', Order.ASSIGNMENT) || "''"
      return name ? `${name}.${prop} = ${value};\n` : `// ${g.missing()}\n`
    }
    for (const [method, info] of Object.entries(def.methods)) {
      f[methodBlockType(def.type, method)] = (block, g) => {
        const name = g.componentName(block.getFieldValue('COMPONENT'))
        const args = Object.values(info.args).map((arg, index) =>
          isFieldArg(arg)
            ? (g.componentName(block.getFieldValue(`ARG${index}`)) ?? 'null')
            : g.valueToCode(block, `ARG${index}`, Order.NONE) || 'null',
        )
        const call = `${info.async ? 'await ' : ''}${name}.${method}(${args.join(', ')})`
        if (info.returns)
          return name
            ? [call, info.async ? Order.AWAIT : Order.FUNCTION_CALL]
            : ['undefined', Order.ATOMIC]
        return name ? `${call};\n` : `// ${g.missing()}\n`
      }
    }
  }
}

/**
 * The filter passed before an event handler, followed by `, `: `Panier, `, `'bottom', `,
 * `null, ` for any, `''` without a filter, and `null` when the chosen component was deleted.
 */
function eventFilterCode(
  def: ComponentDef,
  event: string,
  block: Blockly.Block,
  g: Gen,
): string | null {
  const filter = def.events[event]?.filter
  if (!filter) return ''
  const value = String(block.getFieldValue('FILTER') ?? ANY)
  if (value === ANY || value === '') return 'null, '
  if (filter.kind === 'enum') return filter.values.includes(value) ? `${quote(value)}, ` : 'null, '
  const name = g.componentName(value)
  return name ? `${name}, ` : null
}

export type GeneratedCode = {
  code: string
  /** Block id of each line of `code` (index 0 is line 1), or `null`. */
  lineMap: (string | null)[]
}

/**
 * Removes statement markers and records which block each line comes from. A line belongs to
 * the last marker above it that is not more indented, so the `}` closing a handler belongs to
 * the handler, not to its last statement.
 */
export function stripMarkers(raw: string): {
  lines: string[]
  ids: (string | null)[]
} {
  const lines: string[] = []
  const ids: (string | null)[] = []
  const stack: { indent: number; id: string }[] = []
  const indentOf = (line: string) => line.length - line.trimStart().length
  for (const line of raw.split('\n')) {
    const match = MARKER.exec(line)
    if (match) {
      const indent = indentOf(line)
      while (stack.length && (stack.at(-1)?.indent ?? 0) >= indent) stack.pop()
      stack.push({ indent, id: (match[1] ?? '').replace(/\\(.)/g, '$1') })
      continue
    }
    const indent = indentOf(line)
    if (line.trim()) {
      while (stack.length > 1 && (stack.at(-1)?.indent ?? 0) > indent) stack.pop()
    }
    lines.push(line)
    ids.push(line.trim() ? (stack.at(-1)?.id ?? null) : null)
  }
  return { lines, ids }
}

/** Assembles the module of a workspace from its blocks. */
export function workspaceToModule(
  generator: RubloxGenerator,
  workspace: Blockly.Workspace,
): GeneratedCode {
  generator.init(workspace)
  const context = generator.context
  const strings = messages[context.locale].blocks.code
  const chunks: string[] = []
  for (const block of generator.codeBlocks(workspace)) {
    const code = generator.blockToCode(block)
    if (typeof code === 'string' && code.trim()) chunks.push(code)
  }
  const helpers = generator.helpers()
  generator.finish('')

  const screen = context.screens.find((s) => s.id === context.workspace)
  const header = [
    `// ${screen ? format(strings.screenHeader, { name: screen.name }) : strings.appHeader}`,
    `// ${strings.note}`,
    '',
  ]
  for (const helper of helpers) header.push(helper, '')

  const params = `{ ${MODULE_PARAMS.join(', ')} }`
  const used = [...generator.usedComponents].sort((a, b) => a.localeCompare(b))
  const bodyRaw = chunks.join('\n')
  const body = stripMarkers(bodyRaw)

  const lines = [...header, `export default async function (${params}) {`]
  const ids: (string | null)[] = header.map(() => null).concat([null])
  if (used.length) {
    lines.push(`  const { ${used.join(', ')} } = components;`, '')
    ids.push(null, null)
  }
  if (!chunks.length) {
    lines.push(`  // ${strings.empty}`)
    ids.push(null)
  }
  body.lines.forEach((line, index) => {
    if (index === body.lines.length - 1 && line === '') return
    lines.push(line ? `  ${line}` : '')
    ids.push(body.ids[index] ?? null)
  })
  lines.push('}', '')
  ids.push(null, null)
  return { code: lines.join('\n'), lineMap: ids }
}
