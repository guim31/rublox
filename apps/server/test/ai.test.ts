import { createProject } from '@rublox/catalog'
import { type ProjectDoc, projectDocSchema, projectToYDoc } from '@rublox/schema'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import createAnswer from '../../../e2e/fixtures/ai-create.json' with { type: 'json' }
import { DEFAULT_AI_FAST_MODEL, DEFAULT_AI_MODEL, loadConfig } from '../src/config.ts'
import { FakeAiClient } from './fake-ai.ts'
import { ADMIN, type Client, createTestServer, json, type TestServer } from './server.ts'

const APPS = 'http://apps.example.com'
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

async function newProject(by: Client, name: string) {
  const doc = createProject({ name, locale: 'fr', mode: 'junior' })
  const state = Buffer.from(Y.encodeStateAsUpdate(projectToYDoc(doc))).toString('base64')
  const res = await by.request('POST', '/api/projects', { state })
  expect(res.status).toBe(201)
  const id = (await json<{ id: string }>(res)).id
  return { id, doc: { ...doc, meta: { ...doc.meta, id } } as ProjectDoc }
}

describe('without ANTHROPIC_API_KEY', () => {
  let server: TestServer
  beforeAll(async () => {
    server = await createTestServer()
  })
  afterAll(async () => {
    await server.close()
  })

  it('has no assistant at all', async () => {
    const admin = await server.signIn(ADMIN.username, ADMIN.password)
    const me = await json<{ features: { ai: unknown } }>(await admin.request('GET', '/api/me'))
    expect(me.features.ai).toBeNull()
    const create = await admin.request('POST', '/api/ai/create', {
      request: 'une appli',
      locale: 'fr',
      mode: 'junior',
    })
    expect(create.status).toBe(404)
    expect((await admin.request('GET', '/api/ai/usage')).status).toBe(404)
    const relay = await admin.fetch(`${APPS}/_rx/ai`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: 'x', prompt: 'hi' }),
    })
    expect(relay.status).toBe(404)
  })

  it('reads the models from the environment', () => {
    const base = { NODE_ENV: 'test' as const }
    expect(loadConfig(base).ai).toBeUndefined()
    expect(loadConfig({ ...base, ANTHROPIC_API_KEY: 'k' }).ai).toEqual({
      apiKey: 'k',
      model: DEFAULT_AI_MODEL,
      fastModel: DEFAULT_AI_FAST_MODEL,
    })
    expect(
      loadConfig({
        ...base,
        ANTHROPIC_API_KEY: 'k',
        RUBLOX_AI_MODEL: 'm',
        RUBLOX_AI_FAST_MODEL: 'f',
      }).ai,
    ).toMatchObject({ model: 'm', fastModel: 'f' })
  })
})

describe('with a (fake) model', () => {
  let server: TestServer
  let admin: Client
  let alice: Client
  const fake = new FakeAiClient((request) =>
    request.schema ? { answer: 'Ce bloc change le texte.', blockIds: ['b1'] } : 'Bonjour !',
  )

  const create = (by: Client, request = 'une appli qui tire au sort qui fait la vaisselle') =>
    by.request('POST', '/api/ai/create', { request, locale: 'fr', mode: 'junior' })

  beforeAll(async () => {
    server = await createTestServer({}, { aiClient: fake })
    admin = await server.signIn(ADMIN.username, ADMIN.password)
    const res = await admin.request('POST', '/api/admin/users', {
      username: 'alice',
      displayName: 'Alice',
      password: 'alice-password',
    })
    expect(res.status).toBe(201)
    alice = await server.signIn('alice', 'alice-password')
  })
  afterAll(async () => {
    await server.close()
  })

  it('is off until the administrator turns it on', async () => {
    const me = await json<{ features: { ai: { allowed: boolean; reason: string } } }>(
      await alice.request('GET', '/api/me'),
    )
    expect(me.features.ai).toMatchObject({ allowed: false, reason: 'disabled' })
    const res = await create(alice)
    expect(res.status).toBe(403)
    expect(await json(res)).toEqual({ error: 'ai_forbidden' })
    await admin.request('PATCH', '/api/admin/settings', { aiEnabled: true, aiDailyQuota: 5 })
    const after = await json<{ features: { ai: unknown } }>(await alice.request('GET', '/api/me'))
    expect(after.features.ai).toEqual({ allowed: true, reason: null, quota: 5, used: 0 })
  })

  it('creates a valid project from a request', async () => {
    fake.queue.push(createAnswer)
    const res = await create(alice)
    expect(res.status).toBe(200)
    const body = await json<{ refused: boolean; doc: ProjectDoc; summary: string }>(res)
    expect(body.refused).toBe(false)
    expect(projectDocSchema.safeParse(body.doc).success).toBe(true)
    expect(body.doc.meta).toMatchObject({
      name: 'Qui fait la vaisselle ?',
      locale: 'fr',
      mode: 'junior',
    })
    const screen = body.doc.screens[body.doc.screenOrder[0] as string]
    const names = Object.values(screen?.components ?? {}).map((c) => c.name)
    expect(names).toEqual(expect.arrayContaining(['Titre', 'Noms', 'Tirer', 'Gagnant']))
    // Names in the blocks became ids.
    const stack = Object.values(body.doc.blocks[body.doc.screenOrder[0] as string] ?? {})[0]
    const tirer = Object.entries(screen?.components ?? {}).find(([, c]) => c.name === 'Tirer')?.[0]
    expect((stack?.fields as { COMPONENT?: string } | undefined)?.COMPONENT).toBe(tirer)
    expect(body.summary).toContain('vaisselle')
    // The rules and the catalog reference are in the cached system prompt.
    const request = fake.requests.at(-1)
    expect(request?.tier).toBe('main')
    expect(request?.system).toContain('child of 8')
    expect(request?.system).toContain('### Button')
    expect(request?.input.text).toContain('fait la vaisselle')
  })

  it('shows the problems to the model once, then gives up', async () => {
    const broken = structuredClone(createAnswer)
    broken.screens[0]!.components[0]!.type = 'Rocket'
    fake.queue.push(broken, createAnswer)
    const before = fake.requests.length
    const res = await create(alice)
    expect(res.status).toBe(200)
    expect(fake.requests.length - before).toBe(2)
    expect(fake.requests.at(-1)?.input.text).toContain('unknown component type "Rocket"')

    fake.queue.push(broken, broken)
    const failed = await create(alice)
    expect(failed.status).toBe(502)
    expect(await json(failed)).toEqual({ error: 'ai_failed' })
  })

  it('says so when the model declines', async () => {
    await admin.request('PATCH', '/api/admin/settings', { aiDailyQuota: 50 })
    fake.queue.push({ refuse: true })
    const res = await create(alice, 'quelque chose de pas gentil')
    expect(await json(res)).toEqual({ refused: true })
  })

  it('explains, with words that fit the mode', async () => {
    const res = await alice.request('POST', '/api/ai/explain', {
      projectId: null,
      target: 'stack',
      locale: 'fr',
      mode: 'junior',
      context: '{"type":"rx_Button_on_click"}',
    })
    expect(await json(res)).toEqual({ refused: false, answer: 'Bonjour !' })
    const request = fake.requests.at(-1)
    expect(request?.tier).toBe('fast')
    expect(request?.input.text).toContain('Junior mode')
    expect(request?.input.text).toContain('French')
  })

  it('reads the console and the blocks to debug', async () => {
    const res = await alice.request('POST', '/api/ai/debug', {
      projectId: null,
      locale: 'en',
      mode: 'studio',
      context: '[{"id":"b1","type":"rx_Text_set"}]',
      console: 'error: The list has only 3 items',
    })
    expect(await json(res)).toEqual({
      refused: false,
      answer: 'Ce bloc change le texte.',
      blockIds: ['b1'],
    })
    expect(fake.requests.at(-1)?.input.text).toContain('The list has only 3 items')
  })

  it('counts a daily quota per account', async () => {
    await admin.request('PATCH', '/api/admin/settings', { aiDailyQuota: 0 })
    const res = await alice.request('POST', '/api/ai/explain', {
      projectId: null,
      target: 'block',
      locale: 'fr',
      mode: 'junior',
      context: '{}',
    })
    expect(res.status).toBe(429)
    expect(await json(res)).toEqual({ error: 'ai_quota' })
    await admin.request('PATCH', '/api/admin/settings', { aiDailyQuota: 50 })
  })

  it('keeps a usage journal for the administrator', async () => {
    expect((await alice.request('GET', '/api/ai/usage')).status).toBe(403)
    const body = await json<{
      today: { requests: number }
      entries: { username: string; kind: string; outcome: string; inputTokens: number }[]
    }>(await admin.request('GET', '/api/ai/usage'))
    expect(body.today.requests).toBeGreaterThanOrEqual(7)
    expect(body.entries[0]).toMatchObject({ username: 'alice', kind: 'debug', outcome: 'ok' })
    expect(body.entries.map((e) => e.outcome)).toContain('refused')
  })

  it('needs the managers of a space to switch it on for their members', async () => {
    const space = await json<{ id: string }>(
      await alice.request('POST', '/api/spaces', { name: 'Classe', kind: 'class' }),
    )
    await alice.request('POST', `/api/spaces/${space.id}/accounts`, {
      username: 'kid',
      displayName: 'Kid',
      password: 'kid-password',
    })
    const kid = await server.signIn('kid', 'kid-password')
    const me = await json<{ features: { ai: { allowed: boolean; reason: string } } }>(
      await kid.request('GET', '/api/me'),
    )
    expect(me.features.ai).toMatchObject({ allowed: false, reason: 'space' })
    expect((await create(kid)).status).toBe(403)
    await alice.request('PATCH', `/api/spaces/${space.id}`, { membersCanUseAi: true })
    fake.queue.push(createAnswer)
    expect((await create(kid)).status).toBe(200)
  })

  it('answers the AI component in the editor preview', async () => {
    const project = await newProject(alice, 'Mon appli IA')
    const res = await alice.request('POST', '/api/ai/app', {
      projectId: project.id,
      prompt: 'Une blague sur les chats',
    })
    expect(await json(res)).toEqual({ refused: false, text: 'Bonjour !' })
    const image = await alice.request('POST', '/api/ai/app', {
      projectId: project.id,
      prompt: 'Que vois-tu ?',
      image: { mediaType: 'image/png', data: PNG },
    })
    expect(image.status).toBe(200)
    expect(fake.requests.at(-1)?.input.image?.mediaType).toBe('image/png')
  })

  it('lets a published app use it only when its owner allowed it', async () => {
    const project = await newProject(alice, 'Appli publiée')
    const png = PNG
    const published = await alice.request('PUT', `/api/projects/${project.id}/publication`, {
      slug: 'appli-ia',
      settings: {
        name: 'Appli IA',
        description: '',
        themeColor: '#6d4aff',
        backgroundColor: '#ffffff',
        icon: { kind: 'emoji', emoji: '🤖', background: '#ffd84d' },
      },
      icons: { '192': png, '512': png, maskable: png, apple: png },
      bundle: {
        doc: project.doc,
        code: { app: { code: 'export default async function () {}\n', lineMap: [] } },
      },
    })
    expect(published.status).toBe(201)
    const ask = () =>
      server.client('198.51.100.7').fetch(`${APPS}/_rx/ai`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: 'appli-ia', prompt: 'Dis bonjour' }),
      })
    const refused = await ask()
    expect(refused.status).toBe(403)
    expect(await json(refused)).toEqual({ error: 'ai_forbidden' })
    // Only the owner decides.
    const other = await server.signIn(ADMIN.username, ADMIN.password)
    expect(
      (await other.request('PUT', `/api/ai/projects/${project.id}`, { allowInApp: true })).status,
    ).toBe(404)
    expect(
      (await alice.request('PUT', `/api/ai/projects/${project.id}`, { allowInApp: true })).status,
    ).toBe(200)
    const ok = await ask()
    expect(await json(ok)).toEqual({ refused: false, text: 'Bonjour !' })
    // Billed to the owner.
    const usage = await json<{ entries: { username: string; kind: string }[] }>(
      await admin.request('GET', '/api/ai/usage'),
    )
    expect(usage.entries[0]).toMatchObject({ username: 'alice', kind: 'app-text' })
    // Unpublished: the address stays reserved, the AI stops.
    expect((await alice.request('DELETE', `/api/projects/${project.id}/publication`)).status).toBe(
      200,
    )
    const gone = await ask()
    expect(gone.status).toBe(404)
    expect(await json(gone)).toEqual({ error: 'not_found' })
  })
})
