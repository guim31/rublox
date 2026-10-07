import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { gzipSync } from 'node:zlib'
import { createProject } from '@rublox/catalog'
import { addApi, type ProjectDoc, projectToYDoc, RELAY_PATH, yDocToProject } from '@rublox/schema'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { isPublicAddress, type Resolve } from '../src/data/address.ts'
import type { DataSource } from '../src/data/credentials.ts'
import { DenyList, SelfAddresses } from '../src/data/deny.ts'
import { isPublishedSheet, Relay, RelayFailure } from '../src/data/relay.ts'
import { projectSecrets } from '../src/db/schema.ts'
import { APPS } from './helpers.ts'
import { ADMIN, type Client, createTestServer, json, type TestServer } from './server.ts'

/** A project with one connection to `baseUrl`, its key in a secret. */
function projectWith(baseUrl: string): { doc: ProjectDoc; apiId: string } {
  const ydoc = projectToYDoc(createProject({ name: 'Relais', locale: 'fr', mode: 'studio' }))
  const apiId = addApi(ydoc, {
    name: 'Service',
    baseUrl,
    headers: [{ id: 'h', key: 'X-Key', value: '{{secret:SERVICE_KEY}}' }],
    params: [{ id: 'p', key: 'lang', value: 'fr' }],
  })
  return { doc: yDocToProject(ydoc), apiId }
}

const source = (doc: ProjectDoc): DataSource => ({ projectId: 'p1', doc, kind: 'editor' })
const noSecrets = async () => new Map<string, string>()

/** Fails with the relay's error code. */
async function refusal(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    if (error instanceof RelayFailure) return error.code
    throw error
  }
  throw new Error('the call went through')
}

describe('the relay refuses private addresses (SPEC § 6.9)', () => {
  const relay = new Relay(noSecrets, {
    // Every name resolves to what the test says, without any DNS server.
    resolve: async (host) => {
      if (host === 'intranet.example.com') return [{ address: '10.1.2.3', family: 4 }]
      if (host === 'mixed.example.com')
        return [
          { address: '93.184.215.14', family: 4 },
          { address: '192.168.1.1', family: 4 },
        ]
      if (host === 'v6.example.com') return [{ address: '::ffff:127.0.0.1', family: 6 }]
      throw Object.assign(new Error('not found'), { code: 'ENOTFOUND' })
    },
  })

  it('refuses http://127.0.0.1', async () => {
    const { doc, apiId } = projectWith('http://127.0.0.1')
    expect(await refusal(relay.call(source(doc), { api: apiId, method: 'GET', path: '' }))).toBe(
      'blocked_address',
    )
  })

  it('refuses http://169.254.169.254 (cloud metadata)', async () => {
    const { doc, apiId } = projectWith('http://169.254.169.254/latest/meta-data')
    expect(await refusal(relay.call(source(doc), { api: apiId, method: 'GET', path: '' }))).toBe(
      'blocked_address',
    )
  })

  it('refuses a name that resolves to a private address', async () => {
    const { doc, apiId } = projectWith('https://intranet.example.com/api')
    expect(await refusal(relay.call(source(doc), { api: apiId, method: 'GET', path: '' }))).toBe(
      'blocked_address',
    )
  })

  it('refuses a name when one of its addresses is private, and mapped IPv6 loopback', async () => {
    for (const base of ['https://mixed.example.com', 'https://v6.example.com']) {
      const { doc, apiId } = projectWith(base)
      expect(
        await refusal(relay.call(source(doc), { api: apiId, method: 'GET', path: '' })),
        base,
      ).toBe('blocked_address')
    }
  })

  it('refuses local names, other schemes, and paths that leave the base', async () => {
    for (const base of ['http://localhost:3000', 'http://printer.local', 'http://intranet']) {
      const { doc, apiId } = projectWith(base)
      expect(
        await refusal(relay.call(source(doc), { api: apiId, method: 'GET', path: '' })),
        base,
      ).toBe('blocked_address')
    }
    const file = projectWith('file:///etc/passwd')
    expect(
      await refusal(relay.call(source(file.doc), { api: file.apiId, method: 'GET', path: '' })),
    ).toBe('bad_url')
    const outside = projectWith('https://api.example.com/v1')
    expect(
      await refusal(
        relay.call(source(outside.doc), {
          api: outside.apiId,
          method: 'GET',
          path: '//169.254.169.254/',
        }),
      ),
    ).toBe('bad_url')
  })

  it('reads only Google sheets published on the web', () => {
    expect(
      isPublishedSheet(
        new URL('https://docs.google.com/spreadsheets/d/e/2PACX-abc_123/pub?output=csv'),
      ),
    ).toBe(true)
    for (const url of [
      'http://docs.google.com/spreadsheets/d/e/abc/pub?output=csv',
      'https://docs.google.com.example.com/spreadsheets/d/e/abc/pub',
      'https://docs.google.com/document/d/abc/pub',
      'https://example.com/spreadsheets/d/e/abc/pub',
    ]) {
      expect(isPublishedSheet(new URL(url)), url).toBe(false)
    }
  })

  it('classifies addresses', () => {
    for (const address of [
      '127.0.0.1',
      '10.0.0.1',
      '172.31.255.255',
      '192.168.0.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '::1',
      '::',
      'fe80::1',
      'fd00:ec2::254',
      '::ffff:10.0.0.1',
      '::ffff:7f00:1',
      '64:ff9b::a9fe:a9fe',
      '224.0.0.1',
    ]) {
      expect(isPublicAddress(address), address).toBe(false)
    }
    for (const address of ['93.184.215.14', '1.1.1.1', '2606:4700:4700::1111']) {
      expect(isPublicAddress(address), address).toBe(true)
    }
  })
})

describe('the relay refuses the instance itself and RUBLOX_RELAY_DENY', () => {
  const names = new Map<string, { address: string; family: number }[]>([
    ['rublox.example.com', [{ address: '93.184.215.14', family: 4 }]],
    ['apps.example.org', [{ address: '2606:2800:220:1::1', family: 6 }]],
    // Another name served by the same router: same public address.
    ['photos.example.net', [{ address: '93.184.215.14', family: 4 }]],
    ['cdn.example.net', [{ address: '93.184.1.2', family: 4 }]],
  ])
  const asked: string[] = []
  const resolve: Resolve = async (host) => {
    asked.push(host)
    const found = names.get(host)
    if (found) return found
    throw Object.assign(new Error('not found'), { code: 'ENOTFOUND' })
  }
  const call = (relay: Relay, base: string) => {
    const { doc, apiId } = projectWith(base)
    return refusal(relay.call(source(doc), { api: apiId, method: 'GET', path: '' }))
  }

  it("refuses the instance's public address, whatever the name used to reach it", async () => {
    const self = new SelfAddresses(['rublox.example.com', 'apps.example.org'], resolve, () => {}, 0)
    const relay = new Relay(noSecrets, { resolve, self })
    for (const base of [
      'https://rublox.example.com',
      'https://photos.example.net',
      'http://93.184.215.14:8080',
      'http://[::ffff:93.184.215.14]',
      'http://[2606:2800:220:1::1]',
    ]) {
      expect(await call(relay, base), base).toBe('blocked_address')
    }
  })

  it('follows a new address of the instance, and keeps the last one if DNS fails', async () => {
    const self = new SelfAddresses(['rublox.example.com'], resolve, () => {}, 0)
    await self.ready
    expect(self.has('93.184.215.14')).toBe(true)
    names.set('rublox.example.com', [{ address: '93.184.215.99', family: 4 }])
    await self.refresh()
    expect(self.has('93.184.215.99')).toBe(true)
    expect(self.has('93.184.215.14')).toBe(false)
    names.delete('rublox.example.com')
    const errors: string[] = []
    const failing = new SelfAddresses(
      ['rublox.example.com'],
      resolve,
      (host) => errors.push(host),
      0,
    )
    await failing.ready
    expect(errors).toEqual(['rublox.example.com'])
    expect(self.has('93.184.215.99')).toBe(true)
    await self.refresh()
    expect(self.has('93.184.215.99')).toBe(true)
    names.set('rublox.example.com', [{ address: '93.184.215.14', family: 4 }])
  })

  it('refuses a listed name suffix with its subdomains, before resolving it', async () => {
    const deny = new DenyList(['corp.example.com', '*.intra.example.org'])
    expect(deny.deniesName('corp.example.com')).toBe(true)
    expect(deny.deniesName('git.corp.example.com.')).toBe(true)
    expect(deny.deniesName('a.b.intra.example.org')).toBe(true)
    expect(deny.deniesName('notcorp.example.com')).toBe(false)
    const relay = new Relay(noSecrets, { resolve, deny })
    asked.length = 0
    expect(await call(relay, 'https://git.corp.example.com/api')).toBe('blocked_address')
    expect(asked).toEqual([])
  })

  it('refuses a listed range, IPv4 or IPv6, after resolution and in mapped form', async () => {
    const deny = new DenyList(['93.184.0.0/16', '2606:2800::/32'])
    expect(deny.deniesAddress('93.184.1.2')).toBe(true)
    expect(deny.deniesAddress('::ffff:93.184.1.2')).toBe(true)
    expect(deny.deniesAddress('2606:2800:220:1::1')).toBe(true)
    expect(deny.deniesAddress('94.1.1.1')).toBe(false)
    const relay = new Relay(noSecrets, { resolve, deny })
    for (const base of [
      'https://cdn.example.net',
      'http://93.184.1.2',
      'https://apps.example.org',
    ]) {
      expect(await call(relay, base), base).toBe('blocked_address')
    }
  })
})

describe('the relay calls an API', () => {
  let remote: Server
  let base: string
  const seen: { url: string; key: string | undefined }[] = []

  beforeAll(async () => {
    remote = createServer((request, response) => {
      seen.push({ url: request.url ?? '', key: request.headers['x-key'] as string | undefined })
      if (request.url?.startsWith('/redirect-private')) {
        response.writeHead(302, { location: 'http://10.0.0.1/' }).end()
      } else if (request.url?.startsWith('/redirect-denied-name')) {
        response.writeHead(302, { location: 'http://git.corp.example.com/' }).end()
      } else if (request.url?.startsWith('/redirect-denied-range')) {
        response.writeHead(302, { location: 'http://93.184.1.2/' }).end()
      } else if (request.url?.startsWith('/redirect-here')) {
        response.writeHead(302, { location: '/v1/hello' }).end()
      } else if (request.url?.startsWith('/v1/big')) {
        response.writeHead(200, { 'content-type': 'text/plain' }).end('x'.repeat(5000))
      } else if (request.url?.startsWith('/v1/bomb')) {
        response
          .writeHead(200, { 'content-type': 'text/plain', 'content-encoding': 'gzip' })
          .end(gzipSync(Buffer.alloc(200_000)))
      } else if (request.url?.startsWith('/v1/slow')) {
        setTimeout(() => response.end('late'), 1000)
      } else {
        response
          .writeHead(200, { 'content-type': 'application/json' })
          .end(JSON.stringify({ current: { temperature: 21.5 } }))
      }
    })
    await new Promise<void>((resolve) => remote.listen(0, '127.0.0.1', resolve))
    base = `http://127.0.0.1:${(remote.address() as AddressInfo).port}`
  })

  afterAll(() => new Promise<void>((resolve) => remote.close(() => resolve())))

  // The test server is on 127.0.0.1: only this relay may reach it.
  const relay = () =>
    new Relay(async (_project, names) => new Map(names.map((name) => [name, `value-of-${name}`])), {
      allowAddress: (address) => address === '127.0.0.1',
      maxResponseBytes: 1000,
      timeoutMs: 300,
    })

  it('adds the parameters and the secret, and parses the JSON answer', async () => {
    const { doc, apiId } = projectWith(`${base}/v1`)
    const response = await relay().call(source(doc), {
      api: apiId,
      method: 'GET',
      path: '/forecast',
      query: { city: 'Lyon' },
    })
    expect(response).toEqual({
      status: 200,
      contentType: 'application/json',
      body: { current: { temperature: 21.5 } },
    })
    expect(seen.at(-1)).toEqual({
      url: '/v1/forecast?lang=fr&city=Lyon',
      key: 'value-of-SERVICE_KEY',
    })
  })

  it('checks each redirect again', async () => {
    const { doc, apiId } = projectWith(base)
    expect(
      await refusal(
        relay().call(source(doc), { api: apiId, method: 'GET', path: '/redirect-private' }),
      ),
    ).toBe('blocked_address')
    const followed = await relay().call(source(doc), {
      api: apiId,
      method: 'GET',
      path: '/redirect-here',
    })
    expect(followed.body).toEqual({ current: { temperature: 21.5 } })
  })

  it('applies RUBLOX_RELAY_DENY at each redirect', async () => {
    const denying = new Relay(noSecrets, {
      // 93.184.x.x counts as public here: only the deny list refuses it.
      allowAddress: (address) => address === '127.0.0.1' || address.startsWith('93.184.'),
      deny: new DenyList(['corp.example.com', '93.184.0.0/16']),
    })
    const { doc, apiId } = projectWith(base)
    for (const path of ['/redirect-denied-name', '/redirect-denied-range']) {
      expect(
        await refusal(denying.call(source(doc), { api: apiId, method: 'GET', path })),
        path,
      ).toBe('blocked_address')
    }
  })

  it('caps the size of the answer (compressed or not) and the time', async () => {
    const { doc, apiId } = projectWith(`${base}/v1`)
    expect(
      await refusal(relay().call(source(doc), { api: apiId, method: 'GET', path: '/big' })),
    ).toBe('too_large')
    expect(
      await refusal(relay().call(source(doc), { api: apiId, method: 'GET', path: '/bomb' })),
    ).toBe('too_large')
    expect(
      await refusal(relay().call(source(doc), { api: apiId, method: 'GET', path: '/slow' })),
    ).toBe('timeout')
  })

  it('caps the calls per minute of a project', async () => {
    const limited = new Relay(noSecrets, {
      allowAddress: (address) => address === '127.0.0.1',
      perMinute: 2,
    })
    const { doc, apiId } = projectWith(`${base}/v1`)
    const call = () => limited.call(source(doc), { api: apiId, method: 'GET', path: '' })
    await call()
    await call()
    expect(await refusal(call())).toBe('too_many_requests')
  })

  it('refuses an unknown connection', async () => {
    const { doc } = projectWith(base)
    expect(await refusal(relay().call(source(doc), { api: 'nope', method: 'GET', path: '' }))).toBe(
      'unknown_api',
    )
  })
})

describe('/_rx/proxy and the secrets', () => {
  let server: TestServer
  let owner: Client
  let projectId: string
  let apiId: string

  beforeAll(async () => {
    server = await createTestServer()
    owner = await server.signIn(ADMIN.username, ADMIN.password)
    const { doc, apiId: id } = projectWith('http://169.254.169.254/latest')
    apiId = id
    const state = Buffer.from(Y.encodeStateAsUpdate(projectToYDoc(doc))).toString('base64')
    const res = await owner.request('POST', '/api/projects', { state })
    projectId = (await json<{ id: string }>(res)).id
  })

  afterAll(() => server.close())

  const proxy = (body: unknown, origin = APPS) =>
    owner.fetch(`${APPS}${RELAY_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify(body),
    })

  it('answers only with a valid ticket of the editor', async () => {
    const res = await owner.request('POST', `/api/projects/${projectId}/data/ticket`)
    expect(res.status).toBe(200)
    const { ticket } = await json<{ ticket: string }>(res)
    const credential = { kind: 'editor', project: projectId, ticket }
    // A valid credential reaches the address check, which refuses the metadata service.
    const blocked = await proxy({ credential, api: apiId })
    expect(blocked.status).toBe(403)
    expect(await json(blocked)).toEqual({ error: 'blocked_address' })

    const forged = await proxy({ credential: { ...credential, ticket: `${ticket}x` }, api: apiId })
    expect(await json(forged)).toEqual({ error: 'forbidden' })
    const other = await proxy({ credential: { ...credential, project: 'another' }, api: apiId })
    expect(await json(other)).toEqual({ error: 'forbidden' })
    expect((await proxy({ credential, api: apiId }, 'https://evil.example.com')).status).toBe(403)
    expect(
      await json(await proxy({ credential: { kind: 'app', slug: 'nothing' }, api: apiId })),
    ).toEqual({ error: 'forbidden' })
    expect(
      await json(await proxy({ credential: { kind: 'live', token: 'nothing' }, api: apiId })),
    ).toEqual({ error: 'forbidden' })
  })

  it('answers a live test link, until it is revoked', async () => {
    const link = await json<{ id: string; token: string }>(
      await owner.request('POST', `/api/projects/${projectId}/live`),
    )
    const credential = { kind: 'live', token: link.token }
    expect(await json(await proxy({ credential, api: apiId }))).toEqual({
      error: 'blocked_address',
    })
    await owner.request('DELETE', `/api/projects/${projectId}/live/${link.id}`)
    expect(await json(await proxy({ credential, api: apiId }))).toEqual({ error: 'forbidden' })
  })

  it('keeps the secrets encrypted and never gives them back', async () => {
    const put = await owner.request('PUT', `/api/projects/${projectId}/secrets/SERVICE_KEY`, {
      value: 'top-secret-key',
    })
    expect(put.status).toBe(200)
    const list = await json<{ secrets: { name: string }[] }>(
      await owner.request('GET', `/api/projects/${projectId}/secrets`),
    )
    expect(list.secrets.map((s) => s.name)).toEqual(['SERVICE_KEY'])
    expect(JSON.stringify(list)).not.toContain('top-secret-key')
    const [row] = await server.services.db.select().from(projectSecrets)
    expect(row?.value).not.toContain('top-secret-key')
    expect(await server.services.secrets.values(projectId, ['SERVICE_KEY'])).toEqual(
      new Map([['SERVICE_KEY', 'top-secret-key']]),
    )
    // A value cannot be moved to another project or name.
    expect(server.services.secrets.decrypt('other', 'SERVICE_KEY', row?.value ?? '')).toBeNull()
    expect(
      (await owner.request('PUT', `/api/projects/${projectId}/secrets/bad name`, { value: 'x' }))
        .status,
    ).toBe(400)
    // Never in the RGPD export.
    const exported = await owner.request('GET', '/api/me/export')
    expect(await exported.text()).not.toContain('top-secret-key')
    expect(
      (await owner.request('DELETE', `/api/projects/${projectId}/secrets/SERVICE_KEY`)).status,
    ).toBe(200)
    expect(await server.services.secrets.values(projectId, ['SERVICE_KEY'])).toEqual(new Map())
  })

  it('"Try" uses the same relay, for those who may write', async () => {
    const res = await owner.request('POST', `/api/projects/${projectId}/data/try`, { api: apiId })
    expect(res.status).toBe(403)
    expect(await json(res)).toEqual({ error: 'blocked_address' })
  })
})
