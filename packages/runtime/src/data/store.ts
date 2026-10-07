import {
  type Cell,
  type HttpMethod,
  MAX_LOCAL_ROWS,
  newId,
  objectToValues,
  type ProjectDoc,
  type RelayResponse,
  type Row,
  type RowObject,
  rowToObject,
  type SharedErrorCode,
  type SharedFromApp,
  type SharedToApp,
  type Table,
} from '@rublox/schema'
import { RxError } from '../errors.ts'

/** A call of an API connection, by its id (`ProjectDoc.data.apis`). */
export type ApiCall = {
  api: string
  method: HttpMethod
  path: string
  query?: Record<string, unknown>
  body?: unknown
}

/** Why a call failed, as `ServiceError.code`: the relay's codes, or `offline`. */
export class ServiceError extends Error {
  override name = 'ServiceError'
  constructor(readonly code: string) {
    super(code)
  }
}

/** A message to the shared data, without its reference (the connection numbers them). */
export type SharedWrite = SharedFromApp extends infer M
  ? M extends { ref: number }
    ? Omit<M, 'ref'>
    : never
  : never

export type SharedConnection = {
  /** Resolves with the server's acknowledgement (sent again after a reconnection). */
  send(message: SharedWrite): Promise<{ error?: SharedErrorCode; row?: string }>
  close(): void
}

/**
 * What the place running the app provides (SPEC § 6.7): the API relay and the shared data of
 * the apps origin. Absent where there is no server (a guest's preview): local tables still
 * work, the rest says why it cannot.
 */
export type DataServices = {
  request?(call: ApiCall): Promise<RelayResponse>
  /** The text of a Google sheet published as CSV. */
  sheet?(url: string): Promise<string>
  shared?(handlers: {
    message(message: SharedToApp): void
    status(online: boolean): void
  }): SharedConnection
}

type Saved = Record<string, { base: string; rows: Row[] }>

/** A short fingerprint of a table's rows in the project (to know they changed). */
function fingerprint(table: Table): string {
  const text = JSON.stringify([table.columns, table.rows])
  let hash = 5381
  for (let i = 0; i < text.length; i++) hash = (hash * 33) ^ text.charCodeAt(i)
  return `${text.length}:${(hash >>> 0).toString(36)}`
}

const same = (a: unknown, b: unknown) => {
  if (Object.is(a, b)) return true
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

export type DataStoreOptions = {
  doc: ProjectDoc
  appId: string
  storage: Pick<Storage, 'getItem' | 'setItem'> | null
  services?: DataServices
  /** A table (`table:<id>`) or a shared variable (`var:<id>`) changed. */
  changed(key: string): void
  warn(message: SharedWarning): void
}

export type SharedWarning = 'sharedOffline' | 'storageFull'

/**
 * The data of a running app (SPEC § 4.5): local tables (rows of the project, changed on the
 * device and kept there), shared tables and variables (the server's, through a connection),
 * and API calls. Rows reach the code as objects keyed by column name.
 */
export class DataStore {
  private doc: ProjectDoc
  private readonly local = new Map<string, Row[]>()
  private readonly shared = new Map<string, Row[]>()
  private readonly sharedVars = new Map<string, unknown>()
  private connection: SharedConnection | null = null
  private connectedTables = ''
  private online = false
  private warned = false
  /** Bumped at each change: what the bound lists redraw on. */
  version = 0

  constructor(private readonly options: DataStoreOptions) {
    this.doc = options.doc
  }

  // Life cycle

  /** Loads the device's copy of the local tables and connects to the shared data. */
  start() {
    this.local.clear()
    this.loadLocal()
    this.connect()
  }

  stop() {
    this.connection?.close()
    this.connection = null
    this.connectedTables = ''
    this.online = false
  }

  setDoc(doc: ProjectDoc) {
    const previous = this.doc
    this.doc = doc
    // Rows edited in the Data tab win over the device's copy.
    for (const [id, table] of Object.entries(doc.data.tables)) {
      const before = previous.data.tables[id]
      if (table.mode === 'local' && (!before || fingerprint(before) !== fingerprint(table))) {
        this.local.delete(id)
        this.bump(`table:${id}`)
      }
    }
    if (this.sharedKey() !== this.connectedTables && this.connection) {
      this.stop()
      this.connect()
    }
  }

  private sharedKey(): string {
    return Object.entries(this.doc.data.tables)
      .filter(([, table]) => table.mode === 'shared')
      .map(([id, table]) => `${id}:${table.access}`)
      .concat(this.doc.variables.shared.map((variable) => `var:${variable.id}`))
      .sort()
      .join(',')
  }

  private connect() {
    const key = this.sharedKey()
    if (!key || this.connection) return
    const open = this.options.services?.shared
    if (!open) return
    this.connectedTables = key
    this.connection = open({
      message: (message) => this.receive(message),
      status: (online) => {
        this.online = online
      },
    })
  }

  private bump(key: string) {
    this.version += 1
    this.options.changed(key)
  }

  private receive(message: SharedToApp) {
    switch (message.type) {
      case 'hello': {
        this.online = true
        for (const [id, value] of Object.entries(message.variables)) this.applyVar(id, value)
        for (const [id, rows] of Object.entries(message.tables)) {
          this.shared.set(id, rows)
          this.bump(`table:${id}`)
        }
        return
      }
      case 'var':
        this.applyVar(message.variable, message.value)
        return
      case 'row': {
        const rows = [...(this.shared.get(message.table) ?? [])]
        const index = rows.findIndex((row) => row.id === message.row.id)
        if (index >= 0) rows[index] = message.row
        else rows.push(message.row)
        this.shared.set(message.table, rows)
        this.bump(`table:${message.table}`)
        return
      }
      case 'removed':
        this.shared.set(
          message.table,
          (this.shared.get(message.table) ?? []).filter((row) => row.id !== message.row),
        )
        this.bump(`table:${message.table}`)
        return
      case 'rows':
        this.shared.set(message.table, message.rows)
        this.bump(`table:${message.table}`)
        return
      default:
        return
    }
  }

  private applyVar(id: string, value: unknown) {
    if (this.sharedVars.has(id) && same(this.sharedVars.get(id), value)) return
    this.sharedVars.set(id, value)
    this.bump(`var:${id}`)
  }

  // Local tables: the project's rows, then the device's copy once the app changed them

  private storageKey() {
    return `rublox:${this.options.appId}:tables`
  }

  private readSaved(): Saved {
    try {
      const text = this.options.storage?.getItem(this.storageKey())
      return text ? (JSON.parse(text) as Saved) : {}
    } catch {
      return {}
    }
  }

  private loadLocal() {
    const saved = this.readSaved()
    for (const [id, entry] of Object.entries(saved)) {
      const table = this.doc.data.tables[id]
      if (table?.mode === 'local' && entry.base === fingerprint(table)) {
        this.local.set(id, entry.rows)
      }
    }
  }

  private saveLocal(tableId: string) {
    const table = this.doc.data.tables[tableId]
    const rows = this.local.get(tableId)
    if (!table || !rows) return
    const saved = this.readSaved()
    saved[tableId] = { base: fingerprint(table), rows }
    for (const id of Object.keys(saved)) if (!this.doc.data.tables[id]) delete saved[id]
    try {
      this.options.storage?.setItem(this.storageKey(), JSON.stringify(saved))
    } catch {
      this.options.warn('storageFull')
    }
  }

  // Reading

  /** The table called `name` (the code names tables), or an error a learner can read. */
  table(name: string): { id: string; table: Table } {
    const entry = Object.entries(this.doc.data.tables).find(([, table]) => table.name === name)
    if (!entry) throw new RxError('unknownTable', { name })
    return { id: entry[0], table: entry[1] }
  }

  /** Rows of a table, as stored (cells by column id). */
  rows(tableId: string): Row[] {
    const table = this.doc.data.tables[tableId]
    if (!table) return []
    if (table.mode === 'shared' && this.usesServer()) return this.shared.get(tableId) ?? []
    return (
      this.local.get(tableId) ??
      (table.mode === 'shared' ? (this.shared.get(tableId) ?? []) : table.rows)
    )
  }

  /** Rows as the code sees them: `{ id, Nom: 'Léa' }`. */
  objects(tableId: string): RowObject[] {
    const table = this.doc.data.tables[tableId]
    if (!table) return []
    return this.rows(tableId).map((row) => rowToObject(table.columns, row))
  }

  private usesServer(): boolean {
    return Boolean(this.options.services?.shared)
  }

  // Writing

  private warnOffline() {
    if (this.warned) return
    this.warned = true
    this.options.warn('sharedOffline')
  }

  private async sharedWrite(message: SharedWrite, tableName: string) {
    if (!this.connection) throw new RxError('sharedUnavailable')
    const ack = await this.connection.send(message)
    if (ack.error === 'read_only') throw new RxError('tableReadOnly', { name: tableName })
    if (ack.error === 'too_many_rows') throw new RxError('tooManyRows', { name: tableName })
    if (ack.error === 'too_large') throw new RxError('valueTooLarge')
    if (ack.error === 'too_many_requests') throw new RxError('tooManyWrites')
    if (ack.error) throw new RxError('sharedRefused')
    return ack
  }

  /** Writes into a local table (or a shared one with no server: in memory only). */
  private writeLocal(tableId: string, change: (rows: Row[]) => Row[]) {
    const table = this.doc.data.tables[tableId] as Table
    if (table.mode === 'shared') {
      this.warnOffline()
      this.shared.set(tableId, change([...(this.shared.get(tableId) ?? [])]))
    } else {
      this.local.set(tableId, change([...this.rows(tableId)]))
      this.saveLocal(tableId)
    }
    this.bump(`table:${tableId}`)
  }

  private isServerTable(table: Table) {
    return table.mode === 'shared' && this.usesServer()
  }

  async add(name: string, object: Record<string, unknown>): Promise<RowObject> {
    const { id, table } = this.table(name)
    const values = objectToValues(table.columns, object ?? {})
    if (this.isServerTable(table)) {
      const ack = await this.sharedWrite({ type: 'add', table: id, values }, table.name)
      const row = this.rows(id).find((r) => r.id === ack.row) ?? { id: ack.row ?? '', values }
      return rowToObject(table.columns, row)
    }
    if (this.rows(id).length >= MAX_LOCAL_ROWS) throw new RxError('tooManyRows', { name })
    const row: Row = { id: newId(), values }
    this.writeLocal(id, (rows) => [...rows, row])
    return rowToObject(table.columns, row)
  }

  /** The id of a row given as an object (`{ id }`), an id, or a position (from 1). */
  private rowId(tableId: string, name: string, row: unknown): string {
    if (row && typeof row === 'object' && typeof (row as { id?: unknown }).id === 'string') {
      return (row as { id: string }).id
    }
    if (typeof row === 'string' && this.rows(tableId).some((r) => r.id === row)) return row
    const position = Number(row)
    const rows = this.rows(tableId)
    if (Number.isInteger(position) && position >= 1 && position <= rows.length) {
      return (rows[position - 1] as Row).id
    }
    throw new RxError('rowNotFound', { name })
  }

  async update(name: string, row: unknown, object: Record<string, unknown>): Promise<void> {
    const { id, table } = this.table(name)
    const rowId = this.rowId(id, name, row)
    const values = objectToValues(table.columns, object ?? {})
    if (this.isServerTable(table)) {
      await this.sharedWrite({ type: 'update', table: id, row: rowId, values }, table.name)
      return
    }
    this.writeLocal(id, (rows) =>
      rows.map((r) => (r.id === rowId ? { id: r.id, values: { ...r.values, ...values } } : r)),
    )
  }

  async remove(name: string, row: unknown): Promise<void> {
    const { id, table } = this.table(name)
    const rowId = this.rowId(id, name, row)
    if (this.isServerTable(table)) {
      await this.sharedWrite({ type: 'remove', table: id, row: rowId }, table.name)
      return
    }
    this.writeLocal(id, (rows) => rows.filter((r) => r.id !== rowId))
  }

  /** Empties a local table on this device (a shared one cannot be emptied by an app). */
  async clear(name: string): Promise<void> {
    const { id, table } = this.table(name)
    if (this.isServerTable(table)) {
      for (const row of this.rows(id)) {
        await this.sharedWrite({ type: 'remove', table: id, row: row.id }, table.name)
      }
      return
    }
    this.writeLocal(id, () => [])
  }

  /** The column called `column` in a table, checked. */
  column(name: string, column: string) {
    const { table } = this.table(name)
    const found = table.columns.find((c) => c.name === column)
    if (!found) throw new RxError('unknownColumn', { name, column })
    return found
  }

  // Shared variables

  private variableId(name: string): string | undefined {
    return this.doc.variables.shared.find((variable) => variable.name === name)?.id
  }

  getShared(name: string): unknown {
    const id = this.variableId(name)
    if (!id) return 0
    if (this.sharedVars.has(id)) return this.sharedVars.get(id)
    return this.doc.variables.shared.find((variable) => variable.id === id)?.initial ?? 0
  }

  setShared(name: string, value: unknown) {
    const id = this.variableId(name)
    if (!id) return
    let json: unknown
    try {
      json = value === undefined ? null : JSON.parse(JSON.stringify(value))
    } catch {
      throw new RxError('valueTooLarge')
    }
    this.applyVar(id, json)
    if (this.connection) {
      void this.connection.send({ type: 'set', variable: id, value: json as never }).then((ack) => {
        if (ack.error) this.options.warn('sharedOffline')
      })
    } else this.warnOffline()
  }

  /** The id of a shared variable, for its "when it changes" event. */
  sharedVariableId(name: string): string | undefined {
    return this.variableId(name)
  }

  // APIs

  apiId(name: string): string {
    const entry = Object.entries(this.doc.data.apis).find(([, api]) => api.name === name)
    if (!entry) throw new RxError('unknownApi', { name })
    return entry[0]
  }

  async request(name: string, call: Omit<ApiCall, 'api'>): Promise<RelayResponse> {
    const api = this.apiId(name)
    const request = this.options.services?.request
    if (!request) throw new RxError('apiNeedsServer', { name })
    try {
      return await request({ ...call, api })
    } catch (error) {
      if (error instanceof ServiceError) {
        const code =
          error.code === 'blocked_address'
            ? 'apiBlocked'
            : error.code === 'timeout'
              ? 'apiTimeout'
              : error.code === 'too_large'
                ? 'apiTooLarge'
                : error.code === 'too_many_requests'
                  ? 'apiTooMany'
                  : error.code === 'bad_url'
                    ? 'apiBadUrl'
                    : 'apiUnreachable'
        throw new RxError(code, { name })
      }
      throw error
    }
  }

  async sheet(url: string): Promise<string> {
    const read = this.options.services?.sheet
    if (!read) throw new RxError('apiNeedsServer', { name: 'Google Sheets' })
    try {
      return await read(url)
    } catch (error) {
      if (error instanceof ServiceError) {
        throw new RxError(error.code === 'bad_url' ? 'sheetBadUrl' : 'apiUnreachable', {
          name: 'Google Sheets',
        })
      }
      throw error
    }
  }

  isOnline(): boolean {
    return this.online
  }
}

/** Compares two cells for "where" and sorting: numbers as numbers, texts without case. */
export function compareCells(a: unknown, b: unknown): number {
  const na = typeof a === 'number' ? a : Number(a)
  const nb = typeof b === 'number' ? b : Number(b)
  const emptyA = a === null || a === undefined || a === ''
  const emptyB = b === null || b === undefined || b === ''
  if (emptyA || emptyB) return emptyA === emptyB ? 0 : emptyA ? 1 : -1
  if (Number.isFinite(na) && Number.isFinite(nb) && typeof a !== 'boolean') return na - nb
  return String(a).localeCompare(String(b), undefined, { sensitivity: 'base', numeric: true })
}

export const WHERE_OPERATORS = ['=', '!=', '<', '<=', '>', '>=', 'contains', 'starts'] as const
export type WhereOperator = (typeof WHERE_OPERATORS)[number]

export function matches(cell: Cell | unknown, operator: string, value: unknown): boolean {
  switch (operator) {
    case '=':
      return compareCells(cell, value) === 0
    case '!=':
      return compareCells(cell, value) !== 0
    case '<':
      return compareCells(cell, value) < 0
    case '<=':
      return compareCells(cell, value) <= 0
    case '>':
      return compareCells(cell, value) > 0
    case '>=':
      return compareCells(cell, value) >= 0
    case 'contains':
      return String(cell ?? '')
        .toLocaleLowerCase()
        .includes(String(value ?? '').toLocaleLowerCase())
    case 'starts':
      return String(cell ?? '')
        .toLocaleLowerCase()
        .startsWith(String(value ?? '').toLocaleLowerCase())
    default:
      return false
  }
}
