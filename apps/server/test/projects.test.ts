import { createProject } from '@rublox/catalog'
import { addComponent, projectToYDoc, setMeta, yDocToProject } from '@rublox/schema'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { projects, projectVersions } from '../src/db/schema.ts'
import { purgeTrash, SNAPSHOT_INTERVAL_MS } from '../src/routes/projects.ts'
import { ADMIN, type Client, createTestServer, json, type TestServer } from './server.ts'

let server: TestServer
let owner: Client
let projectId: string

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64')
const bytes = (text: string) => new Uint8Array(Buffer.from(text, 'base64'))

/** An editor tab: a local Y.Doc kept in sync with the server, as the studio does. */
class Tab {
  ydoc = new Y.Doc()
  private serverVector: Uint8Array = new Uint8Array([0])

  constructor(
    private readonly client: Client,
    private readonly id: string,
  ) {}

  async open() {
    const res = await this.client.request('GET', `/api/projects/${this.id}`)
    const body = await json<{ state: string }>(res)
    Y.applyUpdate(this.ydoc, bytes(body.state), 'server')
    this.serverVector = Y.encodeStateVector(this.ydoc)
    return this
  }

  async sync() {
    const update = Y.encodeStateAsUpdate(this.ydoc, this.serverVector)
    const res = await this.client.request('POST', `/api/projects/${this.id}/sync`, {
      update: b64(update),
      stateVector: b64(Y.encodeStateVector(this.ydoc)),
    })
    if (res.status !== 200) return res.status
    Y.applyUpdate(this.ydoc, bytes((await json<{ update: string }>(res)).update), 'server')
    this.serverVector = Y.encodeStateVector(this.ydoc)
    return 200
  }

  get doc() {
    return yDocToProject(this.ydoc)
  }
}

beforeAll(async () => {
  server = await createTestServer()
  owner = await server.signIn(ADMIN.username, ADMIN.password)
  const doc = createProject({ name: 'Sync', locale: 'fr', mode: 'junior' })
  const res = await owner.request('POST', '/api/projects', {
    state: b64(Y.encodeStateAsUpdate(projectToYDoc(doc))),
  })
  projectId = (await json<{ id: string }>(res)).id
})
afterAll(() => server.close())

describe('Yjs sync over HTTP', () => {
  it('gives the project its server id', async () => {
    const tab = await new Tab(owner, projectId).open()
    expect(tab.doc.meta.id).toBe(projectId)
  })

  it('merges the edits of two tabs', async () => {
    const a = await new Tab(owner, projectId).open()
    const b = await new Tab(owner, projectId).open()
    const screen = a.doc.screenOrder[0] ?? ''
    const root = a.doc.screens[screen]?.rootId ?? ''
    addComponent(a.ydoc, screen, { type: 'Button', name: 'Bouton1', props: {} }, root)
    addComponent(b.ydoc, screen, { type: 'Text', name: 'Texte1', props: {} }, root)
    expect(await a.sync()).toBe(200)
    expect(await b.sync()).toBe(200)
    expect(await a.sync()).toBe(200)
    const names = (tab: Tab) =>
      Object.values(tab.doc.screens[screen]?.components ?? {})
        .map((c) => c.name)
        .sort()
    expect(names(a)).toEqual(['Accueil', 'Bouton1', 'Texte1'])
    expect(names(b)).toEqual(names(a))
  })

  it('updates the dashboard name and thumbnail', async () => {
    const tab = await new Tab(owner, projectId).open()
    setMeta(tab.ydoc, { name: 'Renamed in the editor' })
    await tab.sync()
    const list = await json<{ projects: { id: string; name: string; preview: unknown }[] }>(
      await owner.request('GET', '/api/projects'),
    )
    const summary = list.projects.find((p) => p.id === projectId)
    expect(summary?.name).toBe('Renamed in the editor')
    expect(summary?.preview).toMatchObject({ locale: 'fr' })
  })

  it('refuses an update that breaks the project format', async () => {
    const tab = await new Tab(owner, projectId).open()
    tab.ydoc.getMap('settings').set('orientation', 42)
    expect(await tab.sync()).toBe(400)
    const fresh = await new Tab(owner, projectId).open()
    expect(fresh.doc.settings.orientation).toBe('portrait')
  })
})

describe('versions', () => {
  it('takes an automatic snapshot at most every 10 minutes of activity', async () => {
    const versions = async () =>
      (
        await server.services.db
          .select()
          .from(projectVersions)
          .where(eq(projectVersions.projectId, projectId))
      ).length
    const before = await versions()
    const tab = await new Tab(owner, projectId).open()
    setMeta(tab.ydoc, { description: 'one' })
    await tab.sync()
    expect(await versions()).toBe(before)
    await server.services.db
      .update(projectVersions)
      .set({ createdAt: new Date(Date.now() - SNAPSHOT_INTERVAL_MS - 1000) })
      .where(eq(projectVersions.projectId, projectId))
    setMeta(tab.ydoc, { description: 'two' })
    await tab.sync()
    expect(await versions()).toBe(before + 1)
  })

  it('restores a named version without destroying the current state', async () => {
    const tab = await new Tab(owner, projectId).open()
    setMeta(tab.ydoc, { name: 'Version A' })
    await tab.sync()
    expect(
      (await owner.request('POST', `/api/projects/${projectId}/versions`, { name: 'A' })).status,
    ).toBe(201)
    setMeta(tab.ydoc, { name: 'Version B' })
    await tab.sync()

    const { versions } = await json<{ versions: { id: string; name: string | null }[] }>(
      await owner.request('GET', `/api/projects/${projectId}/versions`),
    )
    const named = versions.find((v) => v.name === 'A')
    expect(named).toBeTruthy()
    const count = versions.length
    expect(
      (await owner.request('POST', `/api/projects/${projectId}/versions/${named?.id}/restore`))
        .status,
    ).toBe(200)
    // The open tab receives the restored state as an ordinary edit.
    await tab.sync()
    expect(tab.doc.meta.name).toBe('Version A')
    expect(tab.doc.meta.id).toBe(projectId)
    const after = await json<{ versions: unknown[] }>(
      await owner.request('GET', `/api/projects/${projectId}/versions`),
    )
    expect(after.versions.length).toBe(count + 1)
  })
})

describe('assets', () => {
  const PNG = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52,
  ])

  const upload = (
    content: Uint8Array | string,
    name: string,
    type = 'application/octet-stream',
  ) => {
    const form = new FormData()
    form.append('file', new File([content], name, { type }))
    return owner.fetch(`http://studio.example.com/api/projects/${projectId}/assets`, {
      method: 'POST',
      body: form,
    })
  }

  it('stores a file by hash and serves it on the apps origin only', async () => {
    const res = await upload(PNG, 'pixel.txt', 'text/plain')
    expect(res.status).toBe(201)
    const asset = await json<{ sha256: string; mime: string; kind: string }>(res)
    expect(asset).toMatchObject({ mime: 'image/png', kind: 'image' })
    const served = await server.app.request(`http://apps.example.com/assets/${asset.sha256}`, {
      headers: { host: 'apps.example.com' },
    })
    expect(served.status).toBe(200)
    expect(served.headers.get('content-type')).toBe('image/png')
    expect(served.headers.get('cache-control')).toContain('immutable')
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(PNG)
    const studio = await server.app.request(`http://studio.example.com/assets/${asset.sha256}`, {
      headers: { host: 'studio.example.com' },
    })
    expect(studio.headers.get('content-type')).not.toBe('image/png')
  })

  it('checks the type on the content, never the name', async () => {
    const res = await upload('<html><script>alert(1)</script></html>', 'photo.png', 'image/png')
    expect(res.status).toBe(415)
  })

  it('serves SVG without scripts', async () => {
    const res = await upload(
      '<svg xmlns="http://www.w3.org/2000/svg"><circle r="4"/></svg>',
      'a.svg',
    )
    const asset = await json<{ sha256: string }>(res)
    const served = await server.app.request(`http://apps.example.com/assets/${asset.sha256}`, {
      headers: { host: 'apps.example.com' },
    })
    expect(served.headers.get('content-security-policy')).toContain('sandbox')
  })

  it('enforces the maximum size and the quota', async () => {
    await owner.request('PATCH', '/api/admin/settings', { maxUploadMb: 1, storageQuotaMb: 2 })
    const big = new Uint8Array(1.5 * 1024 * 1024)
    big.set(PNG)
    expect((await upload(big, 'big.png')).status).toBe(413)
    const chunk = (seed: number) => {
      const data = new Uint8Array(900 * 1024)
      data.set(PNG)
      data[100] = seed
      return data
    }
    expect((await upload(chunk(1), '1.png')).status).toBe(201)
    expect((await upload(chunk(2), '2.png')).status).toBe(201)
    const third = await upload(chunk(3), '3.png')
    expect(third.status).toBe(413)
    expect(await json(third)).toEqual({ error: 'quota_exceeded' })
    // The same file again costs nothing.
    expect((await upload(chunk(1), 'again.png')).status).toBe(201)
  })
})

describe('trash', () => {
  it('empties projects after 30 days, with their files', async () => {
    const created = await owner.request('POST', '/api/projects', {
      state: b64(
        Y.encodeStateAsUpdate(
          projectToYDoc(createProject({ name: 'Old', locale: 'fr', mode: 'junior' })),
        ),
      ),
    })
    const { id } = await json<{ id: string }>(created)
    await owner.request('POST', `/api/projects/${id}/trash`)
    await server.services.db
      .update(projects)
      .set({ deletedAt: new Date(Date.now() - 31 * 24 * 3600 * 1000) })
      .where(eq(projects.id, id))
    const purged = await purgeTrash(server.services)
    expect(purged.projects).toBe(1)
    expect((await owner.request('GET', `/api/projects/${id}`)).status).toBe(404)
  })
})
