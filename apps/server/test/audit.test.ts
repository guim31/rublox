import { createProject } from '@rublox/catalog'
import { addApi, projectToYDoc, RELAY_PATH } from '@rublox/schema'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { APP_AI_PATH } from '../src/ai/app-relay.ts'
import { projects } from '../src/db/schema.ts'
import { FakeAiClient } from './fake-ai.ts'
import { APPS } from './helpers.ts'
import { ADMIN, type Client, createTestServer, json, type TestServer } from './server.ts'

/** What the security audit of J8 found and fixed (SPEC § 0.10), one regression test each. */

let server: TestServer
let admin: Client

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64')

async function account(username: string, ip?: string) {
  const res = await admin.request('POST', '/api/admin/users', {
    username,
    displayName: username,
    password: `${username}-password`,
  })
  expect(res.status, username).toBe(201)
  return server.signIn(username, `${username}-password`, ip)
}

async function idOf(client: Client) {
  return (await json<{ user: { id: string } }>(await client.request('GET', '/api/me'))).user.id
}

async function newProject(by: Client, name: string, edit?: (ydoc: Y.Doc) => void) {
  const ydoc = projectToYDoc(createProject({ name, locale: 'fr', mode: 'studio' }))
  edit?.(ydoc)
  const res = await by.request('POST', '/api/projects', { state: b64(Y.encodeStateAsUpdate(ydoc)) })
  expect(res.status).toBe(201)
  return (await json<{ id: string }>(res)).id
}

const share = (by: Client, id: string, username: string, role: 'editor' | 'viewer') =>
  by.request('PUT', `/api/projects/${id}/members`, { username, role })

beforeAll(async () => {
  server = await createTestServer({}, { aiClient: new FakeAiClient() })
  admin = await server.signIn(ADMIN.username, ADMIN.password)
})
afterAll(() => server.close())

describe('projects', () => {
  it('gives a project without its AI billing nor its gallery sharing', async () => {
    const giver = await account('audit-giver')
    await account('audit-taker')
    const id = await newProject(giver, 'Cadeau')
    expect((await share(giver, id, 'audit-taker', 'editor')).status).toBe(200)
    await server.services.db
      .update(projects)
      .set({ appAiAllowed: true, visibility: 'gallery' })
      .where(eq(projects.id, id))
    const taker = await server.signIn('audit-taker', 'audit-taker-password')
    const given = await giver.request('POST', `/api/projects/${id}/owner`, {
      userId: await idOf(taker),
    })
    expect(given.status).toBe(200)
    const [row] = await server.services.db.select().from(projects).where(eq(projects.id, id))
    expect(row).toMatchObject({ appAiAllowed: false, visibility: 'private' })
  })

  it('takes no edit of a project in the trash', async () => {
    const owner = await account('audit-trash')
    const id = await newProject(owner, 'Jetée')
    expect((await owner.request('POST', `/api/projects/${id}/trash`, {})).status).toBe(200)
    const secret = await owner.request('PUT', `/api/projects/${id}/secrets/KEY`, { value: 'x' })
    expect(secret.status).toBe(409)
    expect(await json(secret)).toEqual({ error: 'in_trash' })
    // Taking it out of the trash, or deleting it for good, is still possible.
    expect((await owner.request('POST', `/api/projects/${id}/restore`, {})).status).toBe(200)
    expect(
      (await owner.request('PUT', `/api/projects/${id}/secrets/KEY`, { value: 'x' })).status,
    ).toBe(200)
  })
})

describe('the ticket of the editor', () => {
  it('ends with the sharing that gave it', async () => {
    const owner = await account('audit-ticket-owner')
    const reader = await account('audit-ticket-reader')
    let apiId = ''
    const id = await newProject(owner, 'Ticket', (ydoc) => {
      apiId = addApi(ydoc, { name: 'Service', baseUrl: 'https://api.example.com' })
    })
    expect((await share(owner, id, 'audit-ticket-reader', 'viewer')).status).toBe(200)
    const { ticket } = await json<{ ticket: string }>(
      await reader.request('POST', `/api/projects/${id}/data/ticket`, {}),
    )
    const call = () =>
      reader.fetch(`${APPS}${RELAY_PATH}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: APPS },
        body: JSON.stringify({
          credential: { kind: 'editor', project: id, ticket },
          api: apiId,
          method: 'GET',
          path: '',
        }),
      })
    // Accepted (the call itself is refused further on: no network here).
    expect((await call()).status).not.toBe(403)
    const removed = await owner.request(
      'DELETE',
      `/api/projects/${id}/members/${await idOf(reader)}`,
    )
    expect(removed.status).toBe(200)
    expect((await call()).status).toBe(403)
  })
})

describe('accounts', () => {
  it('records the address Rublox resolved for a session opened by an invitation', async () => {
    const { code } = await json<{ code: string }>(
      await admin.request('POST', '/api/invites', { note: 'Audit' }),
    )
    const visitor = server.client('198.51.100.40')
    const res = await visitor.request(
      'POST',
      '/api/invites/accept',
      {
        code,
        username: 'audit-invited',
        displayName: 'Invited',
        password: 'audit-invited-password',
      },
      { 'x-rublox-client-ip': '1.2.3.4' },
    )
    expect(res.status).toBe(201)
    const sessions = await json<{ ipAddress: string | null }[]>(
      await visitor.request('GET', '/api/auth/list-sessions'),
    )
    expect(sessions.map((session) => session.ipAddress)).toEqual(['198.51.100.40'])
  })

  it('never leaves the instance without an administrator who can sign in', async () => {
    const other = await account('audit-admin')
    const otherId = await idOf(other)
    expect(
      (await admin.request('PATCH', `/api/admin/users/${otherId}`, { role: 'admin' })).status,
    ).toBe(200)
    const second = await server.signIn('audit-admin', 'audit-admin-password')
    // The second administrator disables the first…
    const adminId = await idOf(admin)
    expect(
      (await second.request('PATCH', `/api/admin/users/${adminId}`, { disabled: true })).status,
    ).toBe(200)
    // …and cannot then delete itself: a disabled administrator does not count.
    const gone = await second.request('DELETE', '/api/me', { password: 'audit-admin-password' })
    expect(gone.status).toBe(409)
    expect(await json(gone)).toEqual({ error: 'last_admin' })
    expect(
      (await second.request('PATCH', `/api/admin/users/${adminId}`, { disabled: false })).status,
    ).toBe(200)
    admin = await server.signIn(ADMIN.username, ADMIN.password)
  })
})

describe('the apps origin', () => {
  /** A body sent in chunks: no `Content-Length` to check first. */
  const chunked = (size: number) =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        const chunk = new Uint8Array(64 * 1024).fill(32)
        for (let sent = 0; sent < size; sent += chunk.byteLength) controller.enqueue(chunk)
        controller.close()
      },
    })

  it('stops reading a body past its limit, even without a length', async () => {
    for (const [path, size] of [
      [RELAY_PATH, 2 * 1024 * 1024],
      [APP_AI_PATH, 12 * 1024 * 1024],
    ] as const) {
      const res = await server.client('198.51.100.50').fetch(`${APPS}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: APPS },
        body: chunked(size),
        duplex: 'half',
      } as RequestInit)
      expect(res.status, path).toBe(413)
    }
  })
})
