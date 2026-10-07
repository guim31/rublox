import {
  type Cell,
  credentialFromQuery,
  type DataCredential,
  objectToValues,
  type ProjectDoc,
  type Row,
  SHARED_CLOSE,
  SHARED_LIMITS,
  SHARED_PATH,
  type SharedErrorCode,
  type SharedToApp,
  sharedFromAppSchema,
} from '@rublox/schema'
import { and, asc, count, eq } from 'drizzle-orm'
import { type RawData, type WebSocket, WebSocketServer } from 'ws'
import type { Database } from '../db/index.ts'
import { sharedRows, sharedVars } from '../db/schema.ts'
import type { UpgradeRoute } from '../upgrades.ts'
import type { DataSource } from './credentials.ts'
import { newRowId } from './ids.ts'

type Resolver = (credential: DataCredential) => Promise<DataSource | null>

export class SharedError extends Error {
  override name = 'SharedError'
  constructor(readonly code: SharedErrorCode) {
    super(code)
  }
}

const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value ?? null))

/**
 * Shared variables and shared tables (SPEC § 4.2, § 4.5): stored per project, common to the
 * editor's preview, the phones of the live test and the published app. Every change is sent
 * to the apps connected to the project.
 */
export class SharedData {
  private readonly rooms = new Map<string, Set<WebSocket>>()
  private seq = 0

  constructor(private readonly db: Database) {}

  // Storage

  /** Values of the shared variables the project declares (initial value when never set). */
  async variables(projectId: string, doc: ProjectDoc): Promise<Record<string, unknown>> {
    const rows = await this.db.select().from(sharedVars).where(eq(sharedVars.projectId, projectId))
    const stored = new Map(rows.map((row) => [row.varId, row.value]))
    return Object.fromEntries(
      doc.variables.shared.map((variable) => [
        variable.id,
        stored.has(variable.id) ? stored.get(variable.id) : (variable.initial ?? 0),
      ]),
    )
  }

  async rows(projectId: string, tableId: string): Promise<Row[]> {
    const rows = await this.db
      .select({ rowId: sharedRows.rowId, values: sharedRows.values })
      .from(sharedRows)
      .where(and(eq(sharedRows.projectId, projectId), eq(sharedRows.tableId, tableId)))
      .orderBy(asc(sharedRows.seq))
      .limit(SHARED_LIMITS.maxRowsPerTable)
    return rows.map((row) => ({ id: row.rowId, values: row.values as Record<string, Cell> }))
  }

  /** Everything an app receives when it connects. */
  async hello(projectId: string, doc: ProjectDoc): Promise<SharedToApp> {
    const tables: Record<string, Row[]> = {}
    for (const [tableId, table] of Object.entries(doc.data.tables)) {
      if (table.mode === 'shared') tables[tableId] = await this.rows(projectId, tableId)
    }
    return { type: 'hello', variables: await this.variables(projectId, doc), tables }
  }

  async setVariable(projectId: string, doc: ProjectDoc, varId: string, value: unknown) {
    if (!doc.variables.shared.some((variable) => variable.id === varId)) {
      throw new SharedError('unknown')
    }
    if (bytes(value) > SHARED_LIMITS.maxValueBytes) throw new SharedError('too_large')
    await this.db
      .insert(sharedVars)
      .values({ projectId, varId, value })
      .onConflictDoUpdate({
        target: [sharedVars.projectId, sharedVars.varId],
        set: { value, updatedAt: new Date() },
      })
    this.broadcast(projectId, { type: 'var', variable: varId, value })
  }

  private sharedTable(doc: ProjectDoc, tableId: string, write: boolean) {
    const table = doc.data.tables[tableId]
    if (table?.mode !== 'shared') throw new SharedError('unknown')
    if (write && table.access !== 'write') throw new SharedError('read_only')
    return table
  }

  /** Cells of a row: known columns only, of the right type. */
  private clean(doc: ProjectDoc, tableId: string, values: Record<string, unknown>) {
    const table = doc.data.tables[tableId]
    const clean = objectToValues(table?.columns ?? [], values)
    if (bytes(clean) > SHARED_LIMITS.maxValueBytes) throw new SharedError('too_large')
    return clean
  }

  /** `byApp`: from an app, which needs write access; the editor's Data tab always may. */
  async addRow(
    projectId: string,
    doc: ProjectDoc,
    tableId: string,
    values: Record<string, unknown>,
    byApp = true,
  ): Promise<Row> {
    this.sharedTable(doc, tableId, byApp)
    const clean = this.clean(doc, tableId, values)
    const [total] = await this.db
      .select({ n: count() })
      .from(sharedRows)
      .where(and(eq(sharedRows.projectId, projectId), eq(sharedRows.tableId, tableId)))
    if ((total?.n ?? 0) >= SHARED_LIMITS.maxRowsPerTable) throw new SharedError('too_many_rows')
    const row: Row = { id: newRowId(), values: clean }
    await this.db.insert(sharedRows).values({
      projectId,
      tableId,
      rowId: row.id,
      values: clean,
      seq: this.nextSeq(),
    })
    this.broadcast(projectId, { type: 'row', table: tableId, row })
    return row
  }

  private nextSeq(): number {
    this.seq = Math.max(this.seq + 1, Date.now() * 1000)
    return this.seq
  }

  async updateRow(
    projectId: string,
    doc: ProjectDoc,
    tableId: string,
    rowId: string,
    values: Record<string, unknown>,
    byApp = true,
  ): Promise<Row> {
    this.sharedTable(doc, tableId, byApp)
    const where = and(
      eq(sharedRows.projectId, projectId),
      eq(sharedRows.tableId, tableId),
      eq(sharedRows.rowId, rowId),
    )
    const [current] = await this.db.select().from(sharedRows).where(where)
    if (!current) throw new SharedError('unknown')
    const merged = {
      ...(current.values as Record<string, Cell>),
      ...this.clean(doc, tableId, values),
    }
    if (bytes(merged) > SHARED_LIMITS.maxValueBytes) throw new SharedError('too_large')
    await this.db.update(sharedRows).set({ values: merged, updatedAt: new Date() }).where(where)
    const row: Row = { id: rowId, values: merged }
    this.broadcast(projectId, { type: 'row', table: tableId, row })
    return row
  }

  async removeRow(
    projectId: string,
    doc: ProjectDoc,
    tableId: string,
    rowId: string,
    byApp = true,
  ) {
    this.sharedTable(doc, tableId, byApp)
    await this.db
      .delete(sharedRows)
      .where(
        and(
          eq(sharedRows.projectId, projectId),
          eq(sharedRows.tableId, tableId),
          eq(sharedRows.rowId, rowId),
        ),
      )
    this.broadcast(projectId, { type: 'removed', table: tableId, row: rowId })
  }

  /** Replaces every row of a shared table (the Data tab: import, empty). */
  async replaceRows(
    projectId: string,
    doc: ProjectDoc,
    tableId: string,
    rows: Record<string, unknown>[],
  ): Promise<Row[]> {
    this.sharedTable(doc, tableId, false)
    if (rows.length > SHARED_LIMITS.maxRowsPerTable) throw new SharedError('too_many_rows')
    const made: Row[] = rows.map((values) => ({
      id: newRowId(),
      values: this.clean(doc, tableId, values),
    }))
    await this.db.transaction(async (tx) => {
      await tx
        .delete(sharedRows)
        .where(and(eq(sharedRows.projectId, projectId), eq(sharedRows.tableId, tableId)))
      for (let i = 0; i < made.length; i += 500) {
        const chunk = made.slice(i, i + 500)
        if (!chunk.length) continue
        await tx.insert(sharedRows).values(
          chunk.map((row) => ({
            projectId,
            tableId,
            rowId: row.id,
            values: row.values,
            seq: this.nextSeq(),
          })),
        )
      }
    })
    this.broadcast(projectId, { type: 'rows', table: tableId, rows: made })
    return made
  }

  /** Forgets the value of a shared variable (back to its initial value). */
  async resetVariable(projectId: string, doc: ProjectDoc, varId: string) {
    await this.db
      .delete(sharedVars)
      .where(and(eq(sharedVars.projectId, projectId), eq(sharedVars.varId, varId)))
    const variable = doc.variables.shared.find((v) => v.id === varId)
    this.broadcast(projectId, { type: 'var', variable: varId, value: variable?.initial ?? 0 })
  }

  // Connected apps

  join(projectId: string, ws: WebSocket): boolean {
    let room = this.rooms.get(projectId)
    if (!room) {
      room = new Set()
      this.rooms.set(projectId, room)
    }
    if (room.size >= SHARED_LIMITS.maxSocketsPerProject) return false
    room.add(ws)
    return true
  }

  leave(projectId: string, ws: WebSocket) {
    const room = this.rooms.get(projectId)
    room?.delete(ws)
    if (room && room.size === 0) this.rooms.delete(projectId)
  }

  broadcast(projectId: string, message: SharedToApp) {
    const text = JSON.stringify(message)
    for (const ws of this.rooms.get(projectId) ?? []) {
      if (ws.readyState === ws.OPEN) ws.send(text)
    }
  }

  connections(projectId: string): number {
    return this.rooms.get(projectId)?.size ?? 0
  }
}

const DOC_CACHE_MS = 2000
const PING_MS = 25_000

/**
 * `/_rx/shared` on the apps origin: one WebSocket per running app. It sends everything at
 * first, then each change; the app writes through it (variables, rows), within quotas.
 */
export class SharedHub {
  private readonly sockets = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 })
  private readonly pinger: ReturnType<typeof setInterval>

  constructor(
    private readonly data: SharedData,
    private readonly resolve: Resolver,
    private readonly appsUrl: string,
    private readonly logger?: { warn(object: unknown, message?: string): void },
  ) {
    this.pinger = setInterval(() => {
      for (const ws of this.sockets.clients) {
        const alive = ws as WebSocket & { alive?: boolean }
        if (alive.alive === false) {
          ws.terminate()
          continue
        }
        alive.alive = false
        ws.ping()
      }
    }, PING_MS)
    this.pinger.unref?.()
  }

  route(): UpgradeRoute {
    return {
      origin: this.appsUrl,
      path: SHARED_PATH,
      allowedOrigin: this.appsUrl,
      handle: (request, socket, head, url) =>
        this.sockets.handleUpgrade(request, socket, head, (ws) =>
          this.accept(ws, credentialFromQuery(url.searchParams)),
        ),
    }
  }

  close() {
    clearInterval(this.pinger)
    for (const ws of this.sockets.clients) ws.close(1001)
  }

  private async accept(ws: WebSocket, credential: DataCredential | null) {
    const alive = ws as WebSocket & { alive?: boolean }
    alive.alive = true
    ws.on('pong', () => {
      alive.alive = true
    })
    const early: RawData[] = []
    const queue = (data: RawData) => early.push(data)
    ws.on('message', queue)
    const source = credential ? await this.resolve(credential).catch(() => null) : null
    if (!credential || !source) {
      ws.close(SHARED_CLOSE.forbidden, 'forbidden')
      return
    }
    if (ws.readyState !== ws.OPEN) return
    const { projectId } = source
    if (!this.data.join(projectId, ws)) {
      ws.close(SHARED_CLOSE.tooMany, 'too many')
      return
    }
    ws.on('close', () => this.data.leave(projectId, ws))

    // The project as it is now (an editor may change a table's access): read again at most
    // every two seconds.
    let doc = source.doc
    let docTime = Date.now()
    const currentDoc = async () => {
      if (source.kind !== 'app' && Date.now() - docTime > DOC_CACHE_MS) {
        const again = await this.resolve(credential)
        if (!again) throw new SharedError('forbidden')
        doc = again.doc
        docTime = Date.now()
      }
      return doc
    }

    let budget: number = SHARED_LIMITS.writeBurst
    const refill = setInterval(() => {
      budget = Math.min(SHARED_LIMITS.writeBurst, budget + SHARED_LIMITS.writesPerSecond)
    }, 1000)
    ws.on('close', () => clearInterval(refill))

    const reply = (message: SharedToApp) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message))
    }

    // Writes run one after the other, in the order they came.
    let chain = Promise.resolve()
    const onMessage = (data: RawData) => {
      chain = chain.then(async () => {
        const parsed = sharedFromAppSchema.safeParse(parseJson(data))
        if (!parsed.success) return
        const message = parsed.data
        if (budget <= 0) {
          reply({ type: 'ack', ref: message.ref, error: 'too_many_requests' })
          return
        }
        budget -= 1
        try {
          const current = await currentDoc()
          if (message.type === 'set') {
            await this.data.setVariable(projectId, current, message.variable, message.value)
            reply({ type: 'ack', ref: message.ref })
          } else if (message.type === 'add') {
            const row = await this.data.addRow(projectId, current, message.table, message.values)
            reply({ type: 'ack', ref: message.ref, row: row.id })
          } else if (message.type === 'update') {
            await this.data.updateRow(
              projectId,
              current,
              message.table,
              message.row,
              message.values,
            )
            reply({ type: 'ack', ref: message.ref, row: message.row })
          } else {
            await this.data.removeRow(projectId, current, message.table, message.row)
            reply({ type: 'ack', ref: message.ref, row: message.row })
          }
        } catch (error) {
          if (error instanceof SharedError) {
            reply({ type: 'ack', ref: message.ref, error: error.code })
            if (error.code === 'forbidden') ws.close(SHARED_CLOSE.forbidden, 'forbidden')
          } else {
            this.logger?.warn({ err: error, projectId }, 'shared data write failed')
            reply({ type: 'ack', ref: message.ref, error: 'invalid' })
          }
        }
      })
    }

    try {
      reply(await this.data.hello(projectId, doc))
    } catch (error) {
      this.logger?.warn({ err: error, projectId }, 'could not read the shared data')
      ws.close(1011)
      return
    }
    ws.off('message', queue)
    ws.on('message', onMessage)
    for (const data of early) onMessage(data)
  }
}

function parseJson(data: RawData): unknown {
  try {
    const text = Array.isArray(data)
      ? Buffer.concat(data).toString('utf8')
      : Buffer.from(data as ArrayBuffer).toString('utf8')
    return JSON.parse(text)
  } catch {
    return null
  }
}
