import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { serve } from '@hono/node-server'
import { createProject } from '@rublox/catalog'
import { type LiveToPhone, type LiveToStudio, projectToYDoc } from '@rublox/schema'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import * as Y from 'yjs'
import { Upgrades } from '../src/upgrades.ts'
import { APPS, STUDIO } from './helpers.ts'
import { ADMIN, type Client, createTestServer, json, type TestServer } from './server.ts'

let server: TestServer
let http: Server
let port: number
let owner: Client
let stranger: Client
let projectId: string
const doc = createProject({ name: 'Direct', locale: 'fr', mode: 'junior' })
const bundle = { doc, code: { app: { code: 'export default async function () {}', lineMap: [] } } }

/** A WebSocket as a browser opens it: Host and Origin of the page, cookies of its origin. */
class Socket {
  readonly ws: WebSocket
  readonly received: unknown[] = []
  closed: number | null = null

  constructor(path: string, origin: string, cookies = '') {
    this.ws = new WebSocket(`ws://127.0.0.1:${port}${path}`, {
      headers: { host: new URL(origin).host, origin, ...(cookies ? { cookie: cookies } : {}) },
    })
    this.ws.on('message', (data) => this.received.push(JSON.parse(String(data))))
    this.ws.on('close', (code) => {
      this.closed = code
    })
    this.ws.on('error', () => {})
  }

  opened() {
    return new Promise<void>((resolve, reject) => {
      this.ws.once('open', () => resolve())
      this.ws.once('unexpected-response', (_req, res) =>
        reject(new Error(`refused: ${res.statusCode}`)),
      )
    })
  }

  send(message: unknown) {
    this.ws.send(JSON.stringify(message))
  }

  async next<T>(match: (message: T) => boolean): Promise<T> {
    await until(() => this.received.some((m) => match(m as T)))
    const index = this.received.findIndex((m) => match(m as T))
    return this.received.splice(index, 1)[0] as T
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

const cookiesOf = (client: Client) => [...client.cookies].map(([k, v]) => `${k}=${v}`).join('; ')
const phone = (token: string) => new Socket(`/_rx/live?token=${token}`, APPS)
const editor = (token: string, client = owner) =>
  new Socket(`/ws/live?token=${token}`, STUDIO, cookiesOf(client))

async function newLink(client = owner) {
  const res = await client.request('POST', `/api/projects/${projectId}/live`)
  expect(res.status).toBe(201)
  return json<{ id: string; token: string; url: string; expiresAt: string }>(res)
}

beforeAll(async () => {
  server = await createTestServer()
  owner = await server.signIn(ADMIN.username, ADMIN.password)
  await owner.request('POST', '/api/admin/users', {
    username: 'stranger',
    displayName: 'Stranger',
    password: 'stranger-password',
  })
  stranger = await server.signIn('stranger', 'stranger-password')
  const state = Buffer.from(Y.encodeStateAsUpdate(projectToYDoc(doc))).toString('base64')
  projectId = (await json<{ id: string }>(await owner.request('POST', '/api/projects', { state })))
    .id
  const upgrades = new Upgrades()
  for (const route of server.services.live.routes()) upgrades.add(route)
  await new Promise<void>((resolve) => {
    http = serve({ fetch: server.app.fetch, port: 0, hostname: '127.0.0.1' }, (info) => {
      port = (info as AddressInfo).port
      resolve()
    }) as Server
    upgrades.attach(http)
  })
})

afterAll(async () => {
  server.services.live.close()
  http.closeAllConnections()
  await new Promise((resolve) => http.close(resolve))
  await server.close()
})

describe('test on my phone', () => {
  it('relays the project to the phone and its console to the editor', async () => {
    const link = await newLink()
    expect(link.url).toBe(`${APPS}/live/${link.token}`)

    const studio = editor(link.token)
    await studio.opened()
    const device = phone(link.token)
    await device.opened()
    expect(await device.next<LiveToPhone>((m) => m.type === 'editor')).toEqual({
      type: 'editor',
      connected: true,
    })
    device.send({ type: 'hello', device: 'Android · Chrome' })
    const phones = await studio.next<LiveToStudio>(
      (m) => m.type === 'phones' && m.phones.some((p) => p.device === 'Android · Chrome'),
    )
    expect(phones.type === 'phones' && phones.phones).toHaveLength(1)

    studio.send({ type: 'load', bundle })
    const load = await device.next<LiveToPhone>((m) => m.type === 'load')
    expect(load.type === 'load' && load.bundle.doc.meta.name).toBe('Direct')

    device.send({ type: 'log', entry: { level: 'log', message: 'Bonjour', time: 1 } })
    const log = await studio.next<LiveToStudio>((m) => m.type === 'log')
    expect(log).toMatchObject({ device: 'Android · Chrome', entry: { message: 'Bonjour' } })

    // A phone that comes later gets the last project at once.
    const late = phone(link.token)
    await late.opened()
    await late.next<LiveToPhone>((m) => m.type === 'load')

    // Invalid messages are ignored, not relayed.
    studio.send({ type: 'load', bundle: { doc: { nope: true }, code: {} } })
    device.send({ type: 'load', bundle })
    studio.send({ type: 'restart' })
    await device.next<LiveToPhone>((m) => m.type === 'restart')
    expect(device.received.some((m) => (m as LiveToPhone).type === 'load')).toBe(false)

    studio.close()
    expect(await device.next<LiveToPhone>((m) => m.type === 'editor')).toEqual({
      type: 'editor',
      connected: false,
    })
    device.close()
    late.close()
  })

  it('ends the link for everyone when it is revoked', async () => {
    const link = await newLink()
    const device = phone(link.token)
    await device.opened()
    await until(() => server.services.live.phoneCount(link.id) === 1)
    const res = await owner.request('DELETE', `/api/projects/${projectId}/live/${link.id}`)
    expect(res.status).toBe(200)
    expect(await device.next<LiveToPhone>((m) => m.type === 'ended')).toEqual({
      type: 'ended',
      reason: 'revoked',
    })
    await until(() => device.closed === 4003)

    const again = phone(link.token)
    await again.opened()
    await again.next<LiveToPhone>((m) => m.type === 'ended')
  })

  it('replaces the previous link of the same person', async () => {
    const first = await newLink()
    await newLink()
    const device = phone(first.token)
    await device.opened()
    expect(await device.next<LiveToPhone>((m) => m.type === 'ended')).toMatchObject({
      reason: 'revoked',
    })
  })

  it('refuses unknown tokens, foreign pages and strangers', async () => {
    const unknown = phone('x'.repeat(32))
    await unknown.opened()
    expect(await unknown.next<LiveToPhone>((m) => m.type === 'ended')).toMatchObject({
      reason: 'not-found',
    })

    const link = await newLink()
    // A page of another origin may not open either socket.
    const foreign = new Socket(`/_rx/live?token=${link.token}`, 'http://evil.example.com')
    await expect(foreign.opened()).rejects.toThrow('refused')
    // The phone socket lives on the apps origin only, the editor one on the studio origin.
    const wrongHost = new Socket(`/ws/live?token=${link.token}`, APPS)
    await expect(wrongHost.opened()).rejects.toThrow('refused: 404')

    // Without a session, or without access to the project, no editor socket.
    const anonymous = new Socket(`/ws/live?token=${link.token}`, STUDIO)
    await anonymous.opened()
    await anonymous.next<LiveToStudio>((m) => m.type === 'ended')
    const outsider = editor(link.token, stranger)
    await outsider.opened()
    expect(await outsider.next<LiveToStudio>((m) => m.type === 'ended')).toMatchObject({
      reason: 'not-found',
    })
    expect((await stranger.request('POST', `/api/projects/${projectId}/live`)).status).toBe(404)
    expect(
      (await stranger.request('DELETE', `/api/projects/${projectId}/live/${link.id}`)).status,
    ).toBe(404)
  })

  it('serves the phone page on the apps origin only', async () => {
    const link = await newLink()
    const res = await owner.fetch(`${APPS}/live/${link.token}`)
    // No player is built in the tests: the route exists, the page says so.
    expect(res.status).toBe(503)
    expect(await res.text()).toContain('player is not built')
    expect((await owner.fetch(`${APPS}/live/not*a*token`)).status).toBe(404)
  })
})
