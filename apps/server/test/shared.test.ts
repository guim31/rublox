import { createProject } from '@rublox/catalog'
import {
  addColumn,
  addTable,
  addVariable,
  credentialToQuery,
  type DataCredential,
  projectToYDoc,
  SHARED_PATH,
  type SharedToApp,
} from '@rublox/schema'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import * as Y from 'yjs'
import { APPS } from './helpers.ts'
import { ADMIN, type Client, createTestServer, json, type TestServer } from './server.ts'

let server: TestServer
let owner: Client
let port: number
let projectId: string
let credential: DataCredential
const ids = {
  messages: 'tMessages',
  board: 'tBoard',
  local: 'tLocal',
  text: 'cText',
  score: 'vScore',
}

/** An app connected to `/_rx/shared`, as the player opens it. */
class App {
  readonly ws: WebSocket
  readonly received: SharedToApp[] = []
  closed: number | null = null
  private ref = 0

  constructor(cred: DataCredential, origin = APPS) {
    this.ws = new WebSocket(`ws://127.0.0.1:${port}${SHARED_PATH}?${credentialToQuery(cred)}`, {
      headers: { host: new URL(APPS).host, origin },
    })
    this.ws.on('message', (data) => this.received.push(JSON.parse(String(data))))
    this.ws.on('close', (code) => {
      this.closed = code
    })
    this.ws.on('error', () => {})
  }

  async next<T extends SharedToApp['type']>(
    type: T,
    match: (m: Extract<SharedToApp, { type: T }>) => boolean = () => true,
  ) {
    const find = () =>
      this.received.findIndex(
        (m) => m.type === type && match(m as Extract<SharedToApp, { type: T }>),
      )
    await until(() => find() >= 0)
    return this.received.splice(find(), 1)[0] as Extract<SharedToApp, { type: T }>
  }

  /** Sends a write and waits for its acknowledgement. */
  async write(message: Record<string, unknown>) {
    const ref = ++this.ref
    this.ws.send(JSON.stringify({ ...message, ref }))
    return this.next('ack', (ack) => ack.ref === ref)
  }

  close() {
    this.ws.close()
  }
}

async function until(check: () => boolean) {
  const deadline = Date.now() + 5000
  while (!check()) {
    if (Date.now() > deadline) throw new Error('timed out')
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

beforeAll(async () => {
  server = await createTestServer()
  owner = await server.signIn(ADMIN.username, ADMIN.password)
  port = (await server.listen()).port
  const ydoc = projectToYDoc(createProject({ name: 'Tchat', locale: 'fr', mode: 'studio' }))
  addTable(ydoc, { id: ids.messages, name: 'Messages', mode: 'shared', access: 'write' })
  addColumn(ydoc, ids.messages, { id: ids.text, name: 'Texte', type: 'text' })
  addTable(ydoc, { id: ids.board, name: 'Tableau', mode: 'shared', access: 'read' })
  addTable(ydoc, { id: ids.local, name: 'Locale' })
  addVariable(ydoc, 'shared', { id: ids.score, name: 'score', initial: 0 })
  const state = Buffer.from(Y.encodeStateAsUpdate(ydoc)).toString('base64')
  projectId = (await json<{ id: string }>(await owner.request('POST', '/api/projects', { state })))
    .id
  const { ticket } = await json<{ ticket: string }>(
    await owner.request('POST', `/api/projects/${projectId}/data/ticket`),
  )
  credential = { kind: 'editor', project: projectId, ticket }
})

afterAll(() => server.close())

describe('shared variables and tables (SPEC § 4.2, § 4.5)', () => {
  it('syncs a variable and rows between two apps', async () => {
    const a = new App(credential)
    const b = new App(credential)
    const hello = await a.next('hello')
    expect(hello.variables).toEqual({ [ids.score]: 0 })
    expect(Object.keys(hello.tables).sort()).toEqual([ids.board, ids.messages].sort())
    await b.next('hello')

    expect((await a.write({ type: 'set', variable: ids.score, value: 7 })).error).toBeUndefined()
    expect(await b.next('var')).toEqual({ type: 'var', variable: ids.score, value: 7 })

    const added = await a.write({
      type: 'add',
      table: ids.messages,
      values: { [ids.text]: 'Coucou' },
    })
    expect(added.error).toBeUndefined()
    const row = await b.next('row')
    expect(row).toEqual({
      type: 'row',
      table: ids.messages,
      row: { id: added.row, values: { [ids.text]: 'Coucou' } },
    })
    await b.write({
      type: 'update',
      table: ids.messages,
      row: added.row,
      values: { [ids.text]: 'Salut' },
    })
    expect((await a.next('row', (m) => m.row.values[ids.text] === 'Salut')).row.id).toBe(added.row)
    await a.write({ type: 'remove', table: ids.messages, row: added.row })
    expect(await b.next('removed')).toEqual({
      type: 'removed',
      table: ids.messages,
      row: added.row,
    })

    // A newcomer receives what is stored.
    const c = new App(credential)
    expect((await c.next('hello')).variables).toEqual({ [ids.score]: 7 })
    for (const app of [a, b, c]) app.close()
  })

  it('refuses read-only, local and unknown tables, unknown variables and big values', async () => {
    const app = new App(credential)
    await app.next('hello')
    expect((await app.write({ type: 'add', table: ids.board, values: {} })).error).toBe('read_only')
    expect((await app.write({ type: 'add', table: ids.local, values: {} })).error).toBe('unknown')
    expect((await app.write({ type: 'set', variable: 'nope', value: 1 })).error).toBe('unknown')
    expect(
      (await app.write({ type: 'set', variable: ids.score, value: 'x'.repeat(20_000) })).error,
    ).toBe('too_large')
    app.close()
  })

  it('limits the writes of a socket', async () => {
    const app = new App(credential)
    await app.next('hello')
    const results = await Promise.all(
      Array.from({ length: 40 }, () => app.write({ type: 'set', variable: ids.score, value: 1 })),
    )
    expect(results.some((ack) => ack.error === 'too_many_requests')).toBe(true)
    app.close()
  })

  it('closes a socket without a valid credential', async () => {
    const forged = new App({ ...credential, ticket: 'x' } as DataCredential)
    await until(() => forged.closed !== null)
    expect(forged.closed).toBe(4003)
  })

  it('lets the editor fill a read-only table, and apps see it', async () => {
    const app = new App(credential)
    await app.next('hello')
    const res = await owner.request(
      'POST',
      `/api/projects/${projectId}/data/tables/${ids.board}/rows`,
      {
        values: {},
      },
    )
    expect(res.status).toBe(200)
    expect((await app.next('row')).table).toBe(ids.board)
    const put = await owner.request(
      'PUT',
      `/api/projects/${projectId}/data/tables/${ids.board}/rows`,
      {
        rows: [{}, {}],
      },
    )
    expect(put.status).toBe(200)
    expect((await app.next('rows')).rows).toHaveLength(2)
    const listed = await json<{ rows: unknown[] }>(
      await owner.request('GET', `/api/projects/${projectId}/data/tables/${ids.board}/rows`),
    )
    expect(listed.rows).toHaveLength(2)
    app.close()
  })
})
