import { createProject } from '@rublox/catalog'
import { addComponent, type ProjectDoc, projectToYDoc, setMeta } from '@rublox/schema'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import * as Y from 'yjs'
import { projectDocs, projects, projectVersions } from '../src/db/schema.ts'
import { purgeTrash, SNAPSHOT_INTERVAL_MS } from '../src/routes/projects.ts'
import {
  ADMIN,
  type Client,
  createTestServer,
  json,
  type Tab,
  type TestServer,
  until,
} from './server.ts'

let server: TestServer
let owner: Client
let projectId: string

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64')

const storedJson = async (id: string) => {
  await server.services.collab.flush()
  const [row] = await server.services.db
    .select({ json: projectDocs.json })
    .from(projectDocs)
    .where(eq(projectDocs.projectId, id))
  return row?.json as ProjectDoc | undefined
}

async function createUser(username: string) {
  const res = await owner.request('POST', '/api/admin/users', {
    username,
    displayName: username,
    password: `${username}-password`,
  })
  expect(res.status).toBe(201)
  return server.signIn(username, `${username}-password`, '203.0.113.9')
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

describe('documents on /ws/collab', () => {
  it('gives the project its server id', async () => {
    const tab = await server.tab(owner, projectId)
    expect(tab.refused).toBeNull()
    expect(tab.readOnly).toBe(false)
    expect(tab.doc.meta.id).toBe(projectId)
    tab.close()
  })

  it('merges the edits of two tabs live', async () => {
    const a = await server.tab(owner, projectId)
    const b = await server.tab(owner, projectId)
    const screen = a.doc.screenOrder[0] ?? ''
    const root = a.doc.screens[screen]?.rootId ?? ''
    addComponent(a.ydoc, screen, { type: 'Button', name: 'Bouton1', props: {} }, root)
    addComponent(b.ydoc, screen, { type: 'Text', name: 'Texte1', props: {} }, root)
    const names = (tab: Tab) =>
      Object.values(tab.doc.screens[screen]?.components ?? {})
        .map((c) => c.name)
        .sort()
    await until(() => names(a).length === 3 && names(b).length === 3, 'both edits')
    expect(names(a)).toEqual(['Accueil', 'Bouton1', 'Texte1'])
    expect(names(b)).toEqual(names(a))
    a.close()
    b.close()
    const stored = await storedJson(projectId)
    expect(Object.keys(stored?.screens[screen]?.components ?? {})).toHaveLength(3)
  })

  it('updates the dashboard name and thumbnail', async () => {
    const tab = await server.tab(owner, projectId)
    setMeta(tab.ydoc, { name: 'Renamed in the editor' })
    await tab.saved()
    await server.services.collab.flush()
    const list = await json<{ projects: { id: string; name: string; preview: unknown }[] }>(
      await owner.request('GET', '/api/projects'),
    )
    const summary = list.projects.find((p) => p.id === projectId)
    expect(summary?.name).toBe('Renamed in the editor')
    expect(summary?.preview).toMatchObject({ locale: 'fr' })
    tab.close()
  })

  it('never stores an update that breaks the project format', async () => {
    const tab = await server.tab(owner, projectId)
    tab.ydoc.getMap('settings').set('orientation', 42)
    await tab.saved()
    expect((await storedJson(projectId))?.settings.orientation).toBe('portrait')
    tab.ydoc.getMap('settings').set('orientation', 'portrait')
    await tab.saved()
    tab.close()
  })

  it('gives viewers a read-only connection: their edits never reach the server', async () => {
    const viewer = await createUser('viewer')
    await owner.request('PUT', `/api/projects/${projectId}/members`, {
      username: 'viewer',
      role: 'viewer',
    })
    const tab = await server.tab(viewer, projectId)
    expect(tab.readOnly).toBe(true)
    setMeta(tab.ydoc, { name: 'Changed by a viewer' })
    await new Promise((resolve) => setTimeout(resolve, 200))
    expect((await storedJson(projectId))?.meta.name).not.toBe('Changed by a viewer')
    tab.close()
  })

  it('refuses a project the account cannot see, and a missing session, without any 401', async () => {
    const stranger = await createUser('stranger')
    const hidden = await server.tab(stranger, projectId)
    expect(hidden.refused).toBe('not-found')
    expect(hidden.ydoc.share.size).toBe(0)
    hidden.close()
    const anonymous = await server.tab(server.client(), projectId)
    expect(anonymous.refused).toBe('signed-out')
    anonymous.close()
  })

  it('refuses the upgrade from another origin, and on the apps origin', async () => {
    const { port } = await server.listen()
    const status = (headers: Record<string, string>) =>
      new Promise<number>((resolve) => {
        const socket = new WebSocket(`ws://127.0.0.1:${port}/ws/collab`, { headers })
        socket.on('unexpected-response', (_request, response) => resolve(response.statusCode ?? 0))
        socket.on('open', () => {
          socket.close()
          resolve(101)
        })
        socket.on('error', () => resolve(-1))
      })
    expect(await status({ host: 'studio.example.com', origin: 'http://evil.example.com' })).toBe(
      403,
    )
    expect(await status({ host: 'apps.example.com', origin: 'http://studio.example.com' })).toBe(
      404,
    )
    expect(await status({ host: 'studio.example.com', origin: 'http://studio.example.com' })).toBe(
      101,
    )
  })

  it('lets the dashboard rename an open project: the tab receives it', async () => {
    const tab = await server.tab(owner, projectId)
    expect(
      (await owner.request('PATCH', `/api/projects/${projectId}`, { name: 'From the dashboard' }))
        .status,
    ).toBe(200)
    await until(() => tab.doc.meta.name === 'From the dashboard', 'the rename')
    tab.close()
  })
})

describe('versions', () => {
  it('takes an automatic snapshot at most every 10 minutes of activity', async () => {
    const versions = async () => {
      await server.services.collab.flush()
      return (
        await server.services.db
          .select()
          .from(projectVersions)
          .where(eq(projectVersions.projectId, projectId))
      ).length
    }
    const tab = await server.tab(owner, projectId)
    setMeta(tab.ydoc, { description: 'zero' })
    await tab.saved()
    const before = await versions()
    setMeta(tab.ydoc, { description: 'one' })
    await tab.saved()
    expect(await versions()).toBe(before)
    await server.services.db
      .update(projectVersions)
      .set({ createdAt: new Date(Date.now() - SNAPSHOT_INTERVAL_MS - 1000) })
      .where(eq(projectVersions.projectId, projectId))
    setMeta(tab.ydoc, { description: 'two' })
    await tab.saved()
    expect(await versions()).toBe(before + 1)
    tab.close()
  })

  it('restores a named version without destroying the current state', async () => {
    const tab = await server.tab(owner, projectId)
    setMeta(tab.ydoc, { name: 'Version A' })
    await tab.saved()
    expect(
      (await owner.request('POST', `/api/projects/${projectId}/versions`, { name: 'A' })).status,
    ).toBe(201)
    setMeta(tab.ydoc, { name: 'Version B' })
    await tab.saved()

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
    await until(() => tab.doc.meta.name === 'Version A', 'the restored state')
    expect(tab.doc.meta.id).toBe(projectId)
    const after = await json<{ versions: { name: string | null }[] }>(
      await owner.request('GET', `/api/projects/${projectId}/versions`),
    )
    expect(after.versions.length).toBe(count + 1)
    // The state before restoring was kept.
    expect((await storedJson(projectId))?.meta.name).toBe('Version A')
    tab.close()
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
