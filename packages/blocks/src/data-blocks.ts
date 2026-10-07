import { messages } from '@rublox/i18n'
import { HTTP_METHODS } from '@rublox/schema'
import * as Blockly from 'blockly/core'
import { Order } from 'blockly/javascript'
import { type BlocksContext, contextOf, getBlocksLocale, type TableRef } from './context.ts'
import { DATA_BLOCK_TYPES } from './data-types.ts'
import { ReferenceField } from './fields.ts'
import type { RubloxGenerator } from './generator.ts'
import { member, quote } from './text.ts'

export { DATA_BLOCK_TYPES } from './data-types.ts'

const WHERE_OPERATORS = ['=', '!=', '<', '<=', '>', '>=', 'contains', 'starts'] as const

type Option = [string, string]

function strings() {
  return messages[getBlocksLocale()].blocks.data
}

function asField(field: Blockly.Field | Blockly.FieldDropdown): Blockly.Field {
  return field as unknown as Blockly.Field
}

// Fields

/** Tables of the Data tab. */
export class TableField extends ReferenceField {
  override missingWarning(): string {
    return strings().missingTable
  }

  protected available(): Option[] {
    return (contextOf(this.getSourceBlock()?.workspace).tables ?? []).map((table) => [
      table.name,
      table.id,
    ])
  }

  static override fromJson() {
    return new TableField()
  }
}

/** API connections of the Data tab. */
export class ApiField extends ReferenceField {
  protected available(): Option[] {
    return (contextOf(this.getSourceBlock()?.workspace).apis ?? []).map((api) => [api.name, api.id])
  }

  static override fromJson() {
    return new ApiField()
  }
}

/** Shared variables of the project. */
export class SharedVariableField extends ReferenceField {
  protected available(): Option[] {
    return (contextOf(this.getSourceBlock()?.workspace).variables ?? [])
      .filter((variable) => variable.kind === 'shared')
      .map((variable) => [variable.name, variable.id])
  }

  static override fromJson() {
    return new SharedVariableField()
  }
}

/** The table chosen in the `TABLE` field of a block. */
function tableOf(block: Blockly.Block | null | undefined): TableRef | undefined {
  if (!block) return undefined
  const id = block.getFieldValue('TABLE')
  return contextOf(block.workspace).tables?.find((table) => table.id === id)
}

/** Columns of the table chosen in the same block (by id, so that renaming keeps them). */
export class ColumnField extends ReferenceField {
  protected available(): Option[] {
    return (tableOf(this.getSourceBlock())?.columns ?? []).map((column) => [column.name, column.id])
  }

  protected override missingLabel(id: string): string {
    return id ? '⚠ ?' : strings().noColumn
  }

  static override fromJson() {
    return new ColumnField()
  }
}

function dropdown(options: () => Option[]): Blockly.Field {
  return asField(new Blockly.FieldDropdown(options as unknown as Blockly.MenuGeneratorFunction))
}

// Definitions

/** Splits a message around its `%n`, like `parts` in `definitions.ts`. */
function parts(template: string): (string | number)[] {
  return template
    .split(/(%\d+)/)
    .filter((part) => part !== '')
    .map((part) => (/^%\d+$/.test(part) ? Number(part.slice(1)) : part.trim()))
    .filter((part) => part !== '')
}

type Slot =
  | { field: () => Blockly.Field; name: string }
  | { input: string; check?: string | string[] }

/** Builds a block from a message: fields go on the current line, values open an input. */
function build(block: Blockly.Block, template: string, slots: Record<number, Slot>) {
  let input: Blockly.Input = block.appendDummyInput()
  for (const part of parts(template)) {
    if (typeof part === 'string') {
      input.appendField(part)
      continue
    }
    const slot = slots[part]
    if (!slot) continue
    if ('field' in slot) input.appendField(slot.field(), slot.name)
    else {
      input = block.appendValueInput(slot.input)
      if (slot.check) input.setCheck(slot.check)
    }
  }
  block.setInputsInline(true)
}

const table = (): Slot => ({ field: () => asField(new TableField()), name: 'TABLE' })
const column = (): Slot => ({ field: () => asField(new ColumnField()), name: 'COLUMN' })

/** When the table changes, a column that is not in it is replaced by its first column. */
function followTable(block: Blockly.Block) {
  const field = block.getField('TABLE')
  field?.setValidator((id: string) => {
    const columns = contextOf(block.workspace).tables?.find((t) => t.id === id)?.columns ?? []
    const columnField = block.getField('COLUMN')
    if (columnField && !columns.some((c) => c.id === columnField.getValue())) {
      columnField.setValue(columns[0]?.id ?? '')
    }
    ;(block as TableAddBlock).updateColumns_?.(columns.map((c) => c.id))
    return id
  })
}

type TableAddBlock = Blockly.Block & {
  columns_: string[]
  updateColumns_(ids: string[]): void
}

function value(
  type: string,
  template: () => string,
  slots: () => Record<number, Slot>,
  tooltip: () => string,
  output: string | null = null,
) {
  Blockly.Blocks[type] = {
    init(this: Blockly.Block) {
      build(this, template(), slots())
      this.setOutput(true, output)
      this.setStyle('rx_data_blocks')
      this.setTooltip(tooltip)
      if (this.getField('TABLE')) followTable(this)
    },
  }
}

function statement(
  type: string,
  template: () => string,
  slots: () => Record<number, Slot>,
  tooltip: () => string,
) {
  Blockly.Blocks[type] = {
    init(this: Blockly.Block) {
      build(this, template(), slots())
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setStyle('rx_data_blocks')
      this.setTooltip(tooltip)
      if (this.getField('TABLE')) followTable(this)
    },
  }
}

function hat(type: string, template: () => string, slot: Slot, tooltip: () => string) {
  Blockly.Blocks[type] = {
    init(this: Blockly.Block) {
      build(this, template(), { 1: slot })
      this.appendStatementInput('DO')
      this.setStyle('rx_event_blocks')
      this.setTooltip(tooltip)
    },
  }
}

const T = DATA_BLOCK_TYPES

export function defineDataBlocks(): void {
  const s = strings
  const tip = (key: keyof ReturnType<typeof strings>['tooltips']) => () => s().tooltips[key]

  value(
    T.tableRows,
    () => s().tableRows,
    () => ({ 1: table() }),
    tip('tableRows'),
    'Array',
  )
  value(
    T.tableWhere,
    () => s().tableWhere,
    () => ({
      1: table(),
      2: column(),
      3: {
        field: () => dropdown(() => WHERE_OPERATORS.map((op): Option => [s().operators[op], op])),
        name: 'OP',
      },
      4: { input: 'VALUE' },
    }),
    tip('tableWhere'),
    'Array',
  )
  value(
    T.tableCount,
    () => s().tableCount,
    () => ({ 1: table() }),
    tip('tableCount'),
    'Number',
  )
  value(
    T.tableSort,
    () => s().tableSort,
    () => ({
      1: { input: 'ROWS', check: 'Array' },
      2: table(),
      3: column(),
      4: {
        field: () =>
          dropdown(() => [
            [s().order.asc, 'ASC'],
            [s().order.desc, 'DESC'],
          ]),
        name: 'ORDER',
      },
    }),
    tip('tableSort'),
    'Array',
  )
  value(
    T.tableGet,
    () => s().tableGet,
    () => ({ 1: column(), 2: { input: 'ROW' }, 3: table() }),
    tip('tableGet'),
  )

  Blockly.Blocks[T.tableAdd] = {
    init(this: TableAddBlock) {
      this.columns_ = []
      build(this, s().tableAdd, { 1: table() })
      this.setInputsInline(false)
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setStyle('rx_data_blocks')
      this.setTooltip(tip('tableAdd'))
      followTable(this)
    },
    /** One input per column of the table, labelled with its name. */
    updateColumns_(this: TableAddBlock, ids: string[]) {
      for (const old of this.columns_) {
        if (!ids.includes(old) && this.getInput(`COL_${old}`)) this.removeInput(`COL_${old}`)
      }
      const columns = tableOf(this)?.columns ?? []
      for (const id of ids) {
        const label = columns.find((c) => c.id === id)?.name ?? '?'
        const input = this.getInput(`COL_${id}`) ?? this.appendValueInput(`COL_${id}`)
        input.setAlign(Blockly.inputs.Align.RIGHT)
        const field = input.fieldRow[0]
        if (field) field.setValue(label)
        else input.appendField(label)
      }
      // Inputs follow the order of the columns.
      ids.forEach((id, index) => {
        const name = `COL_${id}`
        const at = this.inputList.findIndex((input) => input.name === name)
        if (at >= 0 && at !== index + 1) this.moveNumberedInputBefore(at, index + 1)
      })
      this.columns_ = [...ids]
    },
    saveExtraState(this: TableAddBlock) {
      return { columns: this.columns_ }
    },
    loadExtraState(this: TableAddBlock, state: { columns?: string[] }) {
      this.updateColumns_(state.columns ?? [])
    },
  } as Partial<TableAddBlock> & ThisType<TableAddBlock>

  statement(
    T.tableSet,
    () => s().tableSet,
    () => ({ 1: table(), 2: column(), 3: { input: 'ROW' }, 4: { input: 'VALUE' } }),
    tip('tableSet'),
  )
  statement(
    T.tableRemove,
    () => s().tableRemove,
    () => ({ 1: table(), 2: { input: 'ROW' } }),
    tip('tableRemove'),
  )
  statement(
    T.tableClear,
    () => s().tableClear,
    () => ({ 1: table() }),
    tip('tableClear'),
  )
  hat(T.tableOnChange, () => s().tableOnChange, table(), tip('tableOnChange'))
  hat(
    T.sharedOnChange,
    () => s().sharedOnChange,
    { field: () => asField(new SharedVariableField()), name: 'VAR' },
    tip('sharedOnChange'),
  )

  const apiSlots = (): Record<number, Slot> => ({
    1: { field: () => asField(new ApiField()), name: 'API' },
    2: {
      field: () => dropdown(() => HTTP_METHODS.map((method): Option => [method, method])),
      name: 'METHOD',
    },
    3: { input: 'PATH' },
  })
  const withQueryAndBody = (block: Blockly.Block) => {
    block.appendValueInput('QUERY').setAlign(Blockly.inputs.Align.RIGHT).appendField(s().query)
    block.appendValueInput('BODY').setAlign(Blockly.inputs.Align.RIGHT).appendField(s().body)
    block.setInputsInline(true)
  }
  Blockly.Blocks[T.apiRequest] = {
    init(this: Blockly.Block) {
      build(this, s().apiRequest, apiSlots())
      withQueryAndBody(this)
      this.setOutput(true, null)
      this.setStyle('rx_data_blocks')
      this.setTooltip(tip('apiRequest'))
    },
  }
  Blockly.Blocks[T.apiSend] = {
    init(this: Blockly.Block) {
      build(this, s().apiSend, apiSlots())
      withQueryAndBody(this)
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setStyle('rx_data_blocks')
      this.setTooltip(tip('apiSend'))
    },
  }

  const objects = (type: string) => {
    const init = Blockly.Blocks[type]?.init
    if (!init) return
    ;(Blockly.Blocks[type] as { init: () => void }).init = function (this: Blockly.Block) {
      init.call(this)
      this.setStyle('rx_object_blocks')
    }
  }
  value(
    T.objectGet,
    () => s().objectGet,
    () => ({
      1: { field: () => new Blockly.FieldTextInput('nom'), name: 'PATH' },
      2: { input: 'OBJECT' },
    }),
    tip('objectGet'),
  )
  value(
    T.objectCreate,
    () => s().objectCreate,
    () => ({}),
    tip('objectCreate'),
  )
  value(
    T.objectSet,
    () => s().objectSet,
    () => ({
      1: { input: 'OBJECT' },
      2: { field: () => new Blockly.FieldTextInput('nom'), name: 'KEY' },
      3: { input: 'VALUE' },
    }),
    tip('objectSet'),
  )
  value(
    T.jsonParse,
    () => s().jsonParse,
    () => ({ 1: { input: 'TEXT' } }),
    tip('jsonParse'),
  )
  value(
    T.jsonStringify,
    () => s().jsonStringify,
    () => ({ 1: { input: 'VALUE' } }),
    tip('jsonStringify'),
    'String',
  )
  for (const type of [T.objectGet, T.objectCreate, T.objectSet, T.jsonParse, T.jsonStringify]) {
    objects(type)
  }
}

let registered = false

export function registerDataFields(): void {
  if (registered) return
  registered = true
  Blockly.fieldRegistry.register('field_rx_table', TableField)
  Blockly.fieldRegistry.register('field_rx_column', ColumnField)
  Blockly.fieldRegistry.register('field_rx_api', ApiField)
  Blockly.fieldRegistry.register('field_rx_shared_variable', SharedVariableField)
}

// Generators

type Gen = RubloxGenerator
type Forms = Record<string, (block: Blockly.Block, g: Gen) => string | [string, number] | null>

/** `data.Contacts`, or `null` when the table was deleted. */
function tableCode(block: Blockly.Block, g: Gen): { code: string; table: TableRef } | null {
  const found =
    tableOf(block) ?? g.context.tables?.find((t) => t.id === block.getFieldValue('TABLE'))
  if (!found) return null
  g.usesData = true
  return { code: member('data', found.name), table: found }
}

function columnName(block: Blockly.Block, table: TableRef): string | null {
  const id = block.getFieldValue('COLUMN')
  return table.columns.find((c) => c.id === id)?.name ?? null
}

const missing = (g: Gen) => `// ${messages[g.context.locale].blocks.data.missingTable}\n`

export function installDataGenerators(generator: Gen): void {
  const f = generator.forBlock as unknown as Forms
  const none: [string, number] = ['null', Order.ATOMIC]

  f[T.tableRows] = (block, g) => {
    const t = tableCode(block, g)
    return t ? [`${t.code}.rows()`, Order.FUNCTION_CALL] : ['[]', Order.ATOMIC]
  }
  f[T.tableCount] = (block, g) => {
    const t = tableCode(block, g)
    return t ? [`${t.code}.count()`, Order.FUNCTION_CALL] : ['0', Order.ATOMIC]
  }
  f[T.tableWhere] = (block, g) => {
    const t = tableCode(block, g)
    const column = t && columnName(block, t.table)
    if (!t || !column) return ['[]', Order.ATOMIC]
    const op = String(block.getFieldValue('OP') ?? '=')
    const value = g.valueToCode(block, 'VALUE', Order.NONE) || "''"
    return [`${t.code}.where(${quote(column)}, ${quote(op)}, ${value})`, Order.FUNCTION_CALL]
  }
  f[T.tableSort] = (block, g) => {
    const t = tableCode(block, g)
    const column = t && columnName(block, t.table)
    const rows = g.valueToCode(block, 'ROWS', Order.NONE) || 'null'
    if (!t || !column) return [rows === 'null' ? '[]' : rows, Order.ATOMIC]
    const ascending = block.getFieldValue('ORDER') !== 'DESC'
    return [`${t.code}.sort(${rows}, ${quote(column)}, ${ascending})`, Order.FUNCTION_CALL]
  }
  f[T.tableGet] = (block, g) => {
    const t = tableCode(block, g)
    const column = t && columnName(block, t.table)
    if (!t || !column) return none
    const row = g.valueToCode(block, 'ROW', Order.NONE) || 'null'
    return [`${t.code}.get(${row}, ${quote(column)})`, Order.FUNCTION_CALL]
  }
  f[T.tableAdd] = (block, g) => {
    const t = tableCode(block, g)
    if (!t) return missing(g)
    const entries = t.table.columns
      .filter((c) => block.getInput(`COL_${c.id}`))
      .map((c) => `${quote(c.name)}: ${g.valueToCode(block, `COL_${c.id}`, Order.NONE) || 'null'}`)
    return `await ${t.code}.add({ ${entries.join(', ')} });\n`.replace('({  })', '({})')
  }
  f[T.tableSet] = (block, g) => {
    const t = tableCode(block, g)
    const column = t && columnName(block, t.table)
    if (!t || !column) return missing(g)
    const row = g.valueToCode(block, 'ROW', Order.NONE) || 'null'
    const value = g.valueToCode(block, 'VALUE', Order.NONE) || 'null'
    return `await ${t.code}.set(${row}, ${quote(column)}, ${value});\n`
  }
  f[T.tableRemove] = (block, g) => {
    const t = tableCode(block, g)
    if (!t) return missing(g)
    return `await ${t.code}.remove(${g.valueToCode(block, 'ROW', Order.NONE) || 'null'});\n`
  }
  f[T.tableClear] = (block, g) => {
    const t = tableCode(block, g)
    return t ? `await ${t.code}.clear();\n` : missing(g)
  }
  f[T.tableOnChange] = (block, g) => {
    const t = tableCode(block, g)
    if (!t) return missing(g)
    const body = g.statementToCode(block, 'DO')
    return `${t.code}.onChange(async () => {\n${body}});\n`
  }
  f[T.sharedOnChange] = (block, g) => {
    const id = block.getFieldValue('VAR')
    const variable = g.context.variables?.find((v) => v.kind === 'shared' && v.id === id)
    if (!variable) return `// ${messages[g.context.locale].blocks.missingComponent}\n`
    g.usesData = true
    const body = g.statementToCode(block, 'DO')
    return `data.onShared(${quote(variable.name)}, async () => {\n${body}});\n`
  }

  const apiCall = (block: Blockly.Block, g: Gen): string | null => {
    const id = block.getFieldValue('API')
    const api = g.context.apis?.find((a) => a.id === id)
    if (!api) return null
    g.usesWeb = true
    const method = String(block.getFieldValue('METHOD') ?? 'GET').toLowerCase()
    const args = [
      g.valueToCode(block, 'PATH', Order.NONE) || "''",
      g.valueToCode(block, 'QUERY', Order.NONE),
      g.valueToCode(block, 'BODY', Order.NONE),
    ]
    while (args.length > 1 && !args.at(-1)) args.pop()
    return `await ${member('web', api.name)}.${method}(${args.map((a) => a || 'null').join(', ')})`
  }
  f[T.apiRequest] = (block, g) => {
    const call = apiCall(block, g)
    return call ? [call, Order.AWAIT] : none
  }
  f[T.apiSend] = (block, g) => {
    const call = apiCall(block, g)
    return call ? `${call};\n` : `// ${messages[g.context.locale].blocks.missingComponent}\n`
  }

  f[T.objectGet] = (block, g) => {
    const object = g.valueToCode(block, 'OBJECT', Order.NONE) || 'null'
    return [
      `rx.get(${object}, ${quote(String(block.getFieldValue('PATH') ?? ''))})`,
      Order.FUNCTION_CALL,
    ]
  }
  f[T.objectCreate] = () => ['{}', Order.ATOMIC]
  f[T.objectSet] = (block, g) => {
    const object = g.valueToCode(block, 'OBJECT', Order.NONE) || '{}'
    const value = g.valueToCode(block, 'VALUE', Order.NONE) || 'null'
    const key = quote(String(block.getFieldValue('KEY') ?? ''))
    return [`rx.set(${object}, ${key}, ${value})`, Order.FUNCTION_CALL]
  }
  f[T.jsonParse] = (block, g) => [
    `rx.fromJson(${g.valueToCode(block, 'TEXT', Order.NONE) || "''"})`,
    Order.FUNCTION_CALL,
  ]
  f[T.jsonStringify] = (block, g) => [
    `rx.toJson(${g.valueToCode(block, 'VALUE', Order.NONE) || 'null'})`,
    Order.FUNCTION_CALL,
  ]
}

// Toolbox

type Item = Blockly.utils.toolbox.ToolboxItemInfo
const item = (type: string, extra: Record<string, unknown> = {}): Item =>
  ({ kind: 'block', type, ...extra }) as Item
const textShadow = (text = '') => ({ shadow: { type: 'text', fields: { TEXT: text } } })

/** The blocks of one table, its columns preset. */
function tableItems(table: TableRef): Item[] {
  const fields = { TABLE: table.id }
  const first = table.columns[0]?.id ?? ''
  const withColumn = { ...fields, COLUMN: first }
  const rows = { block: { type: T.tableRows, fields } }
  return [
    { kind: 'label', text: table.name } as Item,
    item(T.tableRows, { fields }),
    item(T.tableWhere, { fields: { ...withColumn, OP: '=' }, inputs: { VALUE: textShadow() } }),
    item(T.tableCount, { fields }),
    item(T.tableSort, { fields: { ...withColumn, ORDER: 'ASC' }, inputs: { ROWS: rows } }),
    item(T.tableGet, { fields: withColumn }),
    item(T.tableAdd, {
      fields,
      extraState: { columns: table.columns.map((c) => c.id) },
      inputs: Object.fromEntries(table.columns.map((c) => [`COL_${c.id}`, textShadow()])),
    }),
    item(T.tableSet, { fields: withColumn, inputs: { VALUE: textShadow() } }),
    item(T.tableRemove, { fields }),
    item(T.tableClear, { fields }),
    item(T.tableOnChange, { fields }),
  ]
}

/** The Data category: each table, then each API connection. */
export function dataCategory(context: BlocksContext, style: string): Item {
  const s = messages[context.locale].blocks.data
  const tables = context.tables ?? []
  const apis = context.apis ?? []
  const contents: Item[] = []
  for (const table of tables) contents.push(...tableItems(table))
  if (apis.length) contents.push({ kind: 'label', text: s.apis } as Item)
  for (const api of apis) {
    const fields = { API: api.id, METHOD: 'GET' }
    contents.push(
      item(T.apiRequest, { fields, inputs: { PATH: textShadow() } }),
      item(T.apiSend, { fields: { API: api.id, METHOD: 'POST' }, inputs: { PATH: textShadow() } }),
    )
  }
  if (!contents.length) contents.push({ kind: 'label', text: s.noData } as Item)
  return {
    kind: 'category',
    name: s.categories.data,
    categorystyle: style,
    contents,
  } as Item
}

/** Objects and JSON: reading the answers of APIs. */
export function objectsCategory(context: BlocksContext, style: string): Item {
  const s = messages[context.locale].blocks.data
  return {
    kind: 'category',
    name: s.categories.objects,
    categorystyle: style,
    contents: [
      item(T.objectGet, { fields: { PATH: 'nom' } }),
      item(T.objectCreate),
      item(T.objectSet, {
        fields: { KEY: 'nom' },
        inputs: { OBJECT: { block: { type: T.objectCreate } }, VALUE: textShadow() },
      }),
      item(T.jsonParse, { inputs: { TEXT: textShadow('{}') } }),
      item(T.jsonStringify),
    ],
  } as Item
}

/**
 * Brings data blocks up to date after the Data tab changed: names of tables and columns,
 * and the inputs of "add a row" (one per column).
 */
export function refreshDataBlocks(workspace: Blockly.Workspace): void {
  for (const block of workspace.getBlocksByType(T.tableAdd, false)) {
    const columns = tableOf(block)?.columns.map((c) => c.id)
    if (columns) (block as TableAddBlock).updateColumns_(columns)
  }
}
