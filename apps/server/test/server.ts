import { mkdtempSync, rmSync } from 'node:fs'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider'
import { serve } from '@hono/node-server'
import { createProject } from '@rublox/catalog'
import { type ProjectDoc, projectToYDoc, yDocToProject } from '@rublox/schema'
import { hc } from 'hono/client'
import { WebSocket } from 'ws'
import * as Y from 'yjs'
import { bootstrapAdmin } from '../src/accounts.ts'
import type { Api } from '../src/api.ts'
import { createApp } from '../src/app.ts'
import { COLLAB_PATH } from '../src/collab.ts'
import { loadConfig } from '../src/config.ts'
import { openDatabase } from '../src/db/index.ts'
import { createServices } from '../src/services.ts'
import { Upgrades } from '../src/upgrades.ts'
import { APPS, STUDIO } from './helpers.ts'

export const ADMIN = { username: 'admin', password: 'admin-password' }
const STUDIO_HOST = new URL(STUDIO).host

/**
 * A server on an in-memory PGlite database, with the first administrator created. Each
 * `Client` keeps its own session cookie, as a browser would.
 */
export async function createTestServer(
  env: Record<string, string> = {},
  options: Parameters<typeof createServices>[3] = {},
) {
  const dataDir = mkdtempSync(join(tmpdir(), 'rublox-data-'))
  const config = loadConfig({
    NODE_ENV: 'test',
    STUDIO_URL: STUDIO,
    APPS_URL: APPS,
    DATA_DIR: dataDir,
    STUDIO_DIST: join(dataDir, 'no-studio'),
    PLAYER_DIST: join(dataDir, 'no-player'),
    RUBLOX_ADMIN_USERNAME: ADMIN.username,
    RUBLOX_ADMIN_PASSWORD: ADMIN.password,
    ...env,
  })
  const database = openDatabase({ databaseUrl: 'memory://', dataDir })
  await database.migrate(config.migrationsFolder)
  const services = createServices(database.db, config, undefined, options)
  await bootstrapAdmin(services, config.admin)
  const app = createApp({ config, services, ping: database.ping })

  const client = (ip = '203.0.113.1') => new Client(app, ip)
  const signIn = async (username: string, password: string, ip?: string) => {
    const c = client(ip)
    const res = await c.signIn(username, password)
    if (res.status !== 200) throw new Error(`sign-in of ${username} failed: ${res.status}`)
    return c
  }
  // A real HTTP server, started on demand: the WebSocket of the documents needs one.
  let listening: Promise<{ server: Server; port: number }> | undefined
  const listen = () => {
    listening ??= new Promise((resolve) => {
      const server = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' }, (info) =>
        resolve({ server: server as Server, port: (info as AddressInfo).port }),
      )
      // The same router as `index.ts`: documents and the live test side by side.
      const upgrades = new Upgrades().add(services.collab.route())
      for (const route of services.live.routes()) upgrades.add(route)
      upgrades.add(services.sharedHub.route())
      upgrades.attach(server as Server)
    })
    return listening
  }
  return {
    app,
    services,
    config,
    client,
    signIn,
    listen,
    /** An editor tab of `client` on a project, connected to `/ws/collab`. */
    tab: async (client: Client, projectId: string, origin = STUDIO) => {
      const { port } = await listen()
      return Tab.open(client, projectId, port, origin)
    },
    close: async () => {
      await services.collab.flush()
      services.live.close()
      services.sharedHub.close()
      services.relay.close()
      if (listening) {
        const { server } = await listening
        server.closeAllConnections()
        await new Promise((resolve) => server.close(resolve))
      }
      await database.close()
      rmSync(dataDir, { recursive: true, force: true })
    },
  }
}

export type TestServer = Awaited<ReturnType<typeof createTestServer>>

/** A browser: a cookie jar, the studio origin, and a typed `hc` client. */
export class Client {
  cookies = new Map<string, string>()
  readonly api: ReturnType<typeof hc<Api>>

  constructor(
    private readonly app: ReturnType<typeof createApp>,
    private readonly ip: string,
  ) {
    this.api = hc<Api>(`${STUDIO}/api`, {
      fetch: (input: Request | string | URL, init?: RequestInit) => this.fetch(input, init),
    })
  }

  async fetch(input: Request | string | URL, init: RequestInit = {}): Promise<Response> {
    const request = new Request(input, init)
    const headers = new Headers(request.headers)
    headers.set('host', new URL(request.url).host)
    if (!headers.has('origin') && request.method !== 'GET') headers.set('origin', STUDIO)
    if (this.cookies.size > 0) {
      headers.set('cookie', [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '))
    }
    const response = await this.app.request(new Request(request, { headers }), undefined, {
      incoming: { socket: { remoteAddress: this.ip } },
    })
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';')
      const index = pair?.indexOf('=') ?? -1
      if (!pair || index < 0) continue
      const name = pair.slice(0, index)
      const value = pair.slice(index + 1)
      if (value === '' || /max-age=0/i.test(cookie)) this.cookies.delete(name)
      else this.cookies.set(name, value)
    }
    return response
  }

  request(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    return this.fetch(`http://${STUDIO_HOST}${path}`, {
      method,
      headers: body === undefined ? headers : { 'content-type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  }

  signIn(username: string, password: string) {
    return this.request('POST', '/api/auth/sign-in/username', { username, password })
  }
}

/** The Yjs state of a new project, as the studio builds it. */
export function newProjectState(name: string): string {
  const doc = createProject({ name, locale: 'fr', mode: 'junior' })
  return Buffer.from(Y.encodeStateAsUpdate(projectToYDoc(doc))).toString('base64')
}

export async function json<T = Record<string, unknown>>(response: Response): Promise<T> {
  return (await response.json()) as T
}

/**
 * An editor tab: a Y.Doc kept in sync with `/ws/collab` by the Hocuspocus provider, with the
 * cookies of its `Client` (as a browser sends them on the WebSocket upgrade).
 */
export class Tab {
  readonly ydoc = new Y.Doc()
  readonly provider: HocuspocusProvider
  readonly socket: HocuspocusProviderWebsocket
  /** Why the server refused the document, if it did. */
  refused: string | null = null
  readOnly = false

  private constructor(client: Client, projectId: string, port: number, origin: string) {
    const headers = {
      host: STUDIO_HOST,
      origin,
      cookie: [...client.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
    }
    class BrowserSocket extends WebSocket {
      constructor(url: string, protocols?: string | string[]) {
        super(url, protocols, { headers })
      }
    }
    this.socket = new HocuspocusProviderWebsocket({
      url: `ws://127.0.0.1:${port}${COLLAB_PATH}`,
      WebSocketPolyfill: BrowserSocket,
      maxAttempts: 1,
    })
    this.provider = new HocuspocusProvider({
      websocketProvider: this.socket,
      name: projectId,
      document: this.ydoc,
      onAuthenticationFailed: ({ reason }) => {
        this.refused = reason
      },
      onAuthenticated: ({ scope }) => {
        this.readOnly = scope === 'readonly'
      },
    })
    this.provider.attach()
  }

  static async open(client: Client, projectId: string, port: number, origin: string) {
    const tab = new Tab(client, projectId, port, origin)
    await until(() => tab.provider.isSynced || tab.refused !== null, 'the tab to open')
    return tab
  }

  get doc(): ProjectDoc {
    return yDocToProject(this.ydoc)
  }

  /** Waits until the server acknowledged every local edit. */
  async saved() {
    await until(() => !this.provider.hasUnsyncedChanges, 'the edits to reach the server')
  }

  close() {
    this.provider.destroy()
    this.socket.destroy()
    this.ydoc.destroy()
  }
}

/** Polls `check` until it holds (5 s at most). */
export async function until(check: () => boolean | Promise<boolean>, what = 'a condition') {
  const deadline = Date.now() + 5000
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`)
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}
