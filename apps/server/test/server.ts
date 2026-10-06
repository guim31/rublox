import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createProject } from '@rublox/catalog'
import { projectToYDoc } from '@rublox/schema'
import { hc } from 'hono/client'
import * as Y from 'yjs'
import { bootstrapAdmin } from '../src/accounts.ts'
import type { Api } from '../src/api.ts'
import { createApp } from '../src/app.ts'
import { loadConfig } from '../src/config.ts'
import { openDatabase } from '../src/db/index.ts'
import { createServices } from '../src/services.ts'
import { APPS, STUDIO } from './helpers.ts'

export const ADMIN = { username: 'admin', password: 'admin-password' }
const STUDIO_HOST = new URL(STUDIO).host

/**
 * A server on an in-memory PGlite database, with the first administrator created. Each
 * `Client` keeps its own session cookie, as a browser would.
 */
export async function createTestServer(env: Record<string, string> = {}) {
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
  const services = createServices(database.db, config)
  await bootstrapAdmin(services, config.admin)
  const app = createApp({ config, services, ping: database.ping })

  const client = (ip = '203.0.113.1') => new Client(app, ip)
  const signIn = async (username: string, password: string, ip?: string) => {
    const c = client(ip)
    const res = await c.signIn(username, password)
    if (res.status !== 200) throw new Error(`sign-in of ${username} failed: ${res.status}`)
    return c
  }
  return {
    app,
    services,
    config,
    client,
    signIn,
    close: async () => {
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
