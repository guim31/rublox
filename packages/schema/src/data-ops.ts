import * as Y from 'yjs'
import {
  type ApiConnection,
  type Cell,
  type Column,
  type ColumnType,
  coerceCell,
  MAX_COLUMNS,
  MAX_LOCAL_ROWS,
  type Row,
  type Table,
  tableSchema,
} from './data.ts'
import { newId, uniqueName } from './names.ts'
import { type Origin, ProjectOpError } from './ops.ts'
import { tableToY, type YArray, type YMap, yData } from './ydoc.ts'

/**
 * Operations on the data of a project (SPEC § 4.5): tables of the Data tab and API
 * connections. Each one is a single transaction (one undo step), like those of `ops.ts`.
 */

function section(ydoc: Y.Doc, key: 'tables' | 'apis'): YMap {
  const data = yData(ydoc)
  let map = data.get(key) as YMap | undefined
  if (!(map instanceof Y.Map)) {
    map = new Y.Map()
    data.set(key, map)
  }
  return map
}

/** The map of a table (a plain object written by an older version becomes one). */
function tableMap(ydoc: Y.Doc, tableId: string): YMap {
  const tables = section(ydoc, 'tables')
  const value = tables.get(tableId)
  if (value instanceof Y.Map) return value
  if (!value) throw new ProjectOpError(`table ${tableId} not found`)
  const map = tableToY(tableSchema.parse(value))
  tables.set(tableId, map)
  return map
}

function rowsOf(table: YMap): YArray<Row> {
  let rows = table.get('rows') as YArray<Row> | undefined
  if (!(rows instanceof Y.Array)) {
    rows = Y.Array.from<Row>(Array.isArray(rows) ? rows : [])
    table.set('rows', rows)
  }
  return rows
}

function columnsOf(table: YMap): Column[] {
  return ((table.get('columns') as Column[] | undefined) ?? []).map((column) => ({ ...column }))
}

export function tableNames(ydoc: Y.Doc, except?: string): string[] {
  return [...section(ydoc, 'tables').entries()]
    .filter(([id]) => id !== except)
    .map(([, table]) => String(table instanceof Y.Map ? table.get('name') : table?.name))
}

function apiNames(ydoc: Y.Doc, except?: string): string[] {
  return [...section(ydoc, 'apis').entries()]
    .filter(([id]) => id !== except)
    .map(([, api]) => String((api as ApiConnection).name))
}

export type NewTable = Partial<Omit<Table, 'name'>> & { name: string; id?: string }

/** Adds a table; a taken name gets a number (`Contacts2`). Returns its id. */
export function addTable(ydoc: Y.Doc, input: NewTable, origin?: Origin): string {
  const id = input.id ?? newId()
  ydoc.transact(() => {
    const taken = tableNames(ydoc)
    const name = taken.includes(input.name) ? uniqueName(input.name, taken) : input.name
    const table = tableSchema.parse({ ...input, name })
    section(ydoc, 'tables').set(id, tableToY(table))
  }, origin)
  return id
}

export function updateTable(
  ydoc: Y.Doc,
  tableId: string,
  patch: Partial<Pick<Table, 'name' | 'mode' | 'access'>>,
  origin?: Origin,
) {
  ydoc.transact(() => {
    const table = tableMap(ydoc, tableId)
    if (patch.name !== undefined) {
      const name = patch.name.trim()
      if (!name || name.length > 64) throw new ProjectOpError('invalid table name')
      if (tableNames(ydoc, tableId).includes(name)) {
        throw new ProjectOpError(`table name ${name} is taken`)
      }
      if (table.get('name') !== name) table.set('name', name)
    }
    if (patch.mode && table.get('mode') !== patch.mode) table.set('mode', patch.mode)
    if (patch.access && table.get('access') !== patch.access) table.set('access', patch.access)
  }, origin)
}

export function removeTable(ydoc: Y.Doc, tableId: string, origin?: Origin) {
  ydoc.transact(() => section(ydoc, 'tables').delete(tableId), origin)
}

// Columns

export function addColumn(
  ydoc: Y.Doc,
  tableId: string,
  input: { name: string; type: ColumnType; id?: string },
  origin?: Origin,
): string {
  const id = input.id ?? newId()
  ydoc.transact(() => {
    const table = tableMap(ydoc, tableId)
    const columns = columnsOf(table)
    if (columns.length >= MAX_COLUMNS) throw new ProjectOpError('too many columns')
    const taken = columns.map((column) => column.name)
    const name = taken.includes(input.name) ? uniqueName(input.name, taken) : input.name
    table.set('columns', [...columns, { id, name, type: input.type }])
  }, origin)
  return id
}

/** Renames a column or changes its type: the cells are converted (an impossible one empties). */
export function updateColumn(
  ydoc: Y.Doc,
  tableId: string,
  columnId: string,
  patch: Partial<Pick<Column, 'name' | 'type'>>,
  origin?: Origin,
) {
  ydoc.transact(() => {
    const table = tableMap(ydoc, tableId)
    const columns = columnsOf(table)
    const column = columns.find((c) => c.id === columnId)
    if (!column) throw new ProjectOpError(`column ${columnId} not found`)
    if (patch.name !== undefined) {
      const name = patch.name.trim()
      if (!name || name.length > 64) throw new ProjectOpError('invalid column name')
      if (columns.some((c) => c.id !== columnId && c.name === name)) {
        throw new ProjectOpError(`column name ${name} is taken`)
      }
      column.name = name
    }
    if (patch.type && patch.type !== column.type) {
      column.type = patch.type
      const rows = rowsOf(table)
      rows.toArray().forEach((row, index) => {
        if (!(columnId in row.values)) return
        const value = coerceCell(column.type, row.values[columnId]) ?? null
        rows.delete(index, 1)
        rows.insert(index, [{ id: row.id, values: { ...row.values, [columnId]: value } }])
      })
    }
    table.set('columns', columns)
  }, origin)
}

export function removeColumn(ydoc: Y.Doc, tableId: string, columnId: string, origin?: Origin) {
  ydoc.transact(() => {
    const table = tableMap(ydoc, tableId)
    table.set(
      'columns',
      columnsOf(table).filter((column) => column.id !== columnId),
    )
    const rows = rowsOf(table)
    rows.toArray().forEach((row, index) => {
      if (!(columnId in row.values)) return
      const { [columnId]: _, ...values } = row.values
      rows.delete(index, 1)
      rows.insert(index, [{ id: row.id, values }])
    })
  }, origin)
}

export function moveColumn(
  ydoc: Y.Doc,
  tableId: string,
  columnId: string,
  toIndex: number,
  origin?: Origin,
) {
  ydoc.transact(() => {
    const table = tableMap(ydoc, tableId)
    const columns = columnsOf(table)
    const from = columns.findIndex((column) => column.id === columnId)
    if (from < 0) return
    const [column] = columns.splice(from, 1)
    if (column) columns.splice(Math.max(0, Math.min(toIndex, columns.length)), 0, column)
    table.set('columns', columns)
  }, origin)
}

// Rows (local tables; a shared table keeps its rows on the server)

/** Adds rows (cells by column id, converted to each column's type). Returns their ids. */
export function addRows(
  ydoc: Y.Doc,
  tableId: string,
  rows: Record<string, unknown>[],
  index?: number,
  origin?: Origin,
): string[] {
  const ids = rows.map(() => newId())
  ydoc.transact(() => {
    const table = tableMap(ydoc, tableId)
    const columns = columnsOf(table)
    const list = rowsOf(table)
    if (list.length + rows.length > MAX_LOCAL_ROWS) throw new ProjectOpError('too many rows')
    const made = rows.map((values, i) => ({
      id: ids[i] as string,
      values: cleanValues(columns, values),
    }))
    list.insert(Math.max(0, Math.min(index ?? list.length, list.length)), made)
  }, origin)
  return ids
}

function cleanValues(columns: Column[], values: Record<string, unknown>): Record<string, Cell> {
  const clean: Record<string, Cell> = {}
  for (const column of columns) {
    if (column.id in values) clean[column.id] = coerceCell(column.type, values[column.id]) ?? null
  }
  return clean
}

/** Changes some cells of a row (by column id). */
export function updateRow(
  ydoc: Y.Doc,
  tableId: string,
  rowId: string,
  values: Record<string, unknown>,
  origin?: Origin,
) {
  ydoc.transact(() => {
    const table = tableMap(ydoc, tableId)
    const list = rowsOf(table)
    const index = list.toArray().findIndex((row) => row.id === rowId)
    const row = list.get(index)
    if (!row) throw new ProjectOpError(`row ${rowId} not found`)
    list.delete(index, 1)
    list.insert(index, [
      { id: row.id, values: { ...row.values, ...cleanValues(columnsOf(table), values) } },
    ])
  }, origin)
}

export function removeRows(ydoc: Y.Doc, tableId: string, rowIds: string[], origin?: Origin) {
  const remove = new Set(rowIds)
  ydoc.transact(() => {
    const list = rowsOf(tableMap(ydoc, tableId))
    for (let index = list.length - 1; index >= 0; index--) {
      if (remove.has(list.get(index).id)) list.delete(index, 1)
    }
  }, origin)
}

export function moveRow(
  ydoc: Y.Doc,
  tableId: string,
  rowId: string,
  toIndex: number,
  origin?: Origin,
) {
  ydoc.transact(() => {
    const list = rowsOf(tableMap(ydoc, tableId))
    const from = list.toArray().findIndex((row) => row.id === rowId)
    const row = list.get(from)
    if (!row) return
    list.delete(from, 1)
    list.insert(Math.max(0, Math.min(toIndex, list.length)), [row])
  }, origin)
}

/**
 * Replaces the columns and rows of a table (a CSV import): `header` names the columns (an
 * existing column of that name keeps its id and type, a new one is text), `rows` holds texts.
 */
export function importTable(
  ydoc: Y.Doc,
  tableId: string,
  header: string[],
  rows: string[][],
  mode: 'replace' | 'append',
  origin?: Origin,
): void {
  ydoc.transact(() => {
    const table = tableMap(ydoc, tableId)
    const columns = columnsOf(table)
    const byIndex: Column[] = []
    header.slice(0, MAX_COLUMNS).forEach((raw, index) => {
      const name = raw.trim() || `${index + 1}`
      let column = columns.find((c) => c.name === name)
      if (!column && columns.length < MAX_COLUMNS) {
        column = { id: newId(), name, type: guessType(rows.map((row) => row[index] ?? '')) }
        columns.push(column)
      }
      if (column) byIndex[index] = column
    })
    const list = rowsOf(table)
    if (mode === 'replace') {
      // Replacing: the table takes the file's columns, in its order.
      const kept = byIndex.filter((column): column is Column => Boolean(column))
      table.set('columns', [...new Map(kept.map((column) => [column.id, column])).values()])
      list.delete(0, list.length)
    } else table.set('columns', columns)
    const room = MAX_LOCAL_ROWS - list.length
    list.push(
      rows.slice(0, Math.max(0, room)).map((cells) => {
        const values: Record<string, Cell> = {}
        byIndex.forEach((column, index) => {
          if (column) values[column.id] = coerceCell(column.type, cells[index] ?? '') ?? null
        })
        return { id: newId(), values }
      }),
    )
  }, origin)
}

/** The type that fits every non-empty text of a column (text when nothing else does). */
export function guessType(values: string[]): ColumnType {
  const filled = values.map((value) => value.trim()).filter((value) => value !== '')
  if (!filled.length) return 'text'
  const all = (type: ColumnType) => filled.every((value) => coerceCell(type, value) !== undefined)
  if (all('number')) return 'number'
  if (filled.every((value) => /^(true|false|vrai|faux|oui|non|yes|no)$/i.test(value)))
    return 'boolean'
  if (filled.every((value) => /^\d{4}-\d{2}-\d{2}$|^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value))) {
    return 'date'
  }
  if (filled.every((value) => /^https?:\/\//i.test(value))) {
    return filled.every((value) => /\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i.test(value))
      ? 'image'
      : 'link'
  }
  return 'text'
}

// API connections

export type NewApi = Partial<Omit<ApiConnection, 'name'>> & { name: string; id?: string }

export function addApi(ydoc: Y.Doc, input: NewApi, origin?: Origin): string {
  const id = input.id ?? newId()
  ydoc.transact(() => {
    const taken = apiNames(ydoc)
    const name = taken.includes(input.name) ? uniqueName(input.name, taken) : input.name
    section(ydoc, 'apis').set(id, {
      name,
      baseUrl: input.baseUrl ?? '',
      headers: input.headers ?? [],
      params: input.params ?? [],
    } satisfies ApiConnection)
  }, origin)
  return id
}

export function updateApi(
  ydoc: Y.Doc,
  apiId: string,
  patch: Partial<ApiConnection>,
  origin?: Origin,
) {
  ydoc.transact(() => {
    const apis = section(ydoc, 'apis')
    const current = apis.get(apiId) as ApiConnection | undefined
    if (!current) throw new ProjectOpError(`api ${apiId} not found`)
    if (patch.name !== undefined) {
      const name = patch.name.trim()
      if (!name || name.length > 64) throw new ProjectOpError('invalid api name')
      if (apiNames(ydoc, apiId).includes(name)) throw new ProjectOpError(`api ${name} is taken`)
      patch = { ...patch, name }
    }
    apis.set(apiId, { ...current, ...patch })
  }, origin)
}

export function removeApi(ydoc: Y.Doc, apiId: string, origin?: Origin) {
  ydoc.transact(() => section(ydoc, 'apis').delete(apiId), origin)
}
