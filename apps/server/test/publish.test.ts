import { createProject } from '@rublox/catalog'
import { type AppSettingsInput, type ProjectDoc, projectToYDoc } from '@rublox/schema'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { manifestOf, renderPlayerPage } from '../src/published.ts'
import { createDistFixture, indexHtml } from './helpers.ts'
import { ADMIN, type Client, createTestServer, json, type TestServer } from './server.ts'

/** A 1×1 PNG. */
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const ICONS = { '192': PNG, '512': PNG, maskable: PNG, apple: PNG }
const APPS = 'http://apps.example.com'

const settings: AppSettingsInput = {
  name: 'Le dé',
  description: 'Lance le dé !',
  themeColor: '#6d4aff',
  backgroundColor: '#ffffff',
  icon: { kind: 'emoji', emoji: '🎲', background: '#ffd84d' },
}

const code = {
  app: { code: 'export default async function () {}\n', lineMap: [] },
}

let server: TestServer
let dist: ReturnType<typeof createDistFixture>
let admin: Client
let editor: Client
let viewer: Client

async function newProject(by: Client, name: string) {
  const doc = createProject({ name, locale: 'fr', mode: 'junior' })
  const state = Buffer.from(Y.encodeStateAsUpdate(projectToYDoc(doc))).toString('base64')
  const res = await by.request('POST', '/api/projects', { state })
  expect(res.status).toBe(201)
  const id = (await json<{ id: string }>(res)).id
  return { id, doc: { ...doc, meta: { ...doc.meta, id } } as ProjectDoc }
}

async function account(username: string) {
  const res = await admin.request('POST', '/api/admin/users', {
    username,
    displayName: username,
    password: `${username}-password`,
  })
  expect(res.status, username).toBe(201)
  return server.signIn(username, `${username}-password`)
}

const publish = (by: Client, projectId: string, body: Record<string, unknown>) =>
  by.request('PUT', `/api/projects/${projectId}/publication`, {
    settings,
    icons: ICONS,
    ...body,
  })

const apps = (by: Client, path: string) => by.fetch(`${APPS}${path}`)

beforeAll(async () => {
  dist = createDistFixture()
  server = await createTestServer({ PLAYER_DIST: dist.playerDist })
  admin = await server.signIn(ADMIN.username, ADMIN.password)
  editor = await account('publish-editor')
  viewer = await account('publish-viewer')
})

afterAll(async () => {
  await server.close()
  dist.cleanup()
})

describe('publishing an app', () => {
  let project: Awaited<ReturnType<typeof newProject>>

  beforeAll(async () => {
    project = await newProject(admin, 'Le dé magique')
  })

  it('proposes a free address from the project name', async () => {
    const body = await json<{ suggestedSlug: string; published: boolean; canPublish: boolean }>(
      await admin.request('GET', `/api/projects/${project.id}/publication`),
    )
    expect(body).toMatchObject({
      suggestedSlug: 'le-de-magique',
      published: false,
      canPublish: true,
    })
  })

  it('publishes a frozen version at a stable address', async () => {
    const res = await publish(admin, project.id, {
      slug: 'le-de',
      bundle: { doc: project.doc, code },
    })
    expect(res.status).toBe(201)
    expect(await json(res)).toEqual({ slug: 'le-de', url: `${APPS}/a/le-de/`, version: 1 })

    const page = await apps(admin, '/a/le-de/')
    expect(page.status).toBe(200)
    const html = await page.text()
    expect(html).toContain('<title>Le dé</title>')
    expect(html).toContain('<link rel="manifest" href="/a/le-de/manifest.webmanifest" />')
    expect(html).toContain('"page":{"kind":"app","slug":"le-de"}')
    expect(page.headers.get('content-security-policy')).toContain("script-src 'self' blob:")

    const app = await json<{ appId: string; version: number; doc: ProjectDoc }>(
      await apps(admin, '/a/le-de/app.json'),
    )
    expect(app.version).toBe(1)
    expect(app.doc.meta.name).toBe('Le dé magique')

    const manifest = await apps(admin, '/a/le-de/manifest.webmanifest')
    expect(manifest.headers.get('content-type')).toContain('application/manifest+json')
    expect(await manifest.json()).toMatchObject({
      name: 'Le dé',
      start_url: '/a/le-de/',
      scope: '/a/le-de/',
      display: 'standalone',
      theme_color: '#6d4aff',
    })

    const icon = await apps(admin, '/a/le-de/icon-512.png')
    expect(icon.headers.get('content-type')).toBe('image/png')
    expect((await icon.arrayBuffer()).byteLength).toBeGreaterThan(20)

    const sw = await (await apps(admin, '/a/le-de/sw.js')).text()
    expect(sw).toContain('/_app/player-def456.js')
    expect(sw).toContain('"/a/le-de/app.json"')
    expect(sw).toContain("addEventListener('notificationclick'")
    // Its own cache only: another app of the origin cannot answer in its place.
    expect(sw).not.toContain('caches.match(')
    expect(() => new Function(sw)).not.toThrow()

    expect((await apps(admin, '/a/le-de')).status).toBe(301)
    expect((await apps(admin, '/a/le-de/install')).status).toBe(200)
    expect((await apps(admin, '/a/le-de/nope.txt')).status).toBe(404)
    expect((await apps(admin, '/a/nothing-here/')).status).toBe(404)
  })

  it('keeps the address and numbers the versions', async () => {
    const renamed = { ...project.doc, meta: { ...project.doc.meta, name: 'Le dé v2' } }
    const res = await publish(admin, project.id, {
      slug: 'another-address',
      bundle: { doc: renamed, code },
    })
    expect(await json(res)).toMatchObject({ slug: 'le-de', version: 2 })
    const body = await json<{ versions: { number: number; current: boolean }[] }>(
      await admin.request('GET', `/api/projects/${project.id}/publication`),
    )
    expect(body.versions.map((v) => [v.number, v.current])).toEqual([
      [2, true],
      [1, false],
    ])
  })

  it('unpublishes, and serves an earlier version again', async () => {
    expect((await admin.request('DELETE', `/api/projects/${project.id}/publication`)).status).toBe(
      200,
    )
    expect((await apps(admin, '/a/le-de/')).status).toBe(410)
    expect((await apps(admin, '/a/le-de/app.json')).status).toBe(410)

    const { versions } = await json<{ versions: { id: string; number: number }[] }>(
      await admin.request('GET', `/api/projects/${project.id}/publication`),
    )
    const first = versions.find((v) => v.number === 1)
    const res = await admin.request(
      'POST',
      `/api/projects/${project.id}/publication/versions/${first?.id}/current`,
    )
    expect(res.status).toBe(200)
    const app = await json<{ version: number }>(await apps(admin, '/a/le-de/app.json'))
    expect(app.version).toBe(1)
  })

  it('refuses an address taken by another project', async () => {
    const other = await newProject(admin, 'Autre')
    const check = await json(
      await admin.request('GET', `/api/projects/${other.id}/publication/slug/le-de`),
    )
    expect(check).toEqual({ valid: true, available: false })
    const res = await publish(admin, other.id, { slug: 'le-de', bundle: { doc: other.doc, code } })
    expect(res.status).toBe(409)
    expect(await json(res)).toEqual({ error: 'slug_taken' })
    expect(
      (await publish(admin, other.id, { slug: 'Not valid!', bundle: { doc: other.doc, code } }))
        .status,
    ).toBe(400)
  })

  it('refuses icons that are not PNG and files that are not the project’s', async () => {
    const other = await newProject(admin, 'Fichiers')
    const notPng = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64')
    const res = await publish(admin, other.id, {
      slug: 'fichiers',
      bundle: { doc: other.doc, code },
      icons: { ...ICONS, apple: notPng },
    })
    expect(res.status).toBe(400)

    const doc = {
      ...other.doc,
      assets: {
        a1: { name: 'x.png', kind: 'image', mime: 'image/png', size: 1, sha256: 'a'.repeat(64) },
      },
    }
    const missing = await publish(admin, other.id, { slug: 'fichiers', bundle: { doc, code } })
    expect(await json(missing)).toEqual({ error: 'missing_asset' })
  })

  it('takes a project in the trash offline', async () => {
    const other = await newProject(admin, 'Poubelle')
    await publish(admin, other.id, { slug: 'poubelle', bundle: { doc: other.doc, code } })
    expect((await apps(admin, '/a/poubelle/')).status).toBe(200)
    await admin.request('POST', `/api/projects/${other.id}/trash`)
    expect((await apps(admin, '/a/poubelle/')).status).toBe(410)
    const res = await publish(admin, other.id, {
      slug: 'poubelle',
      bundle: { doc: other.doc, code },
    })
    expect(res.status).toBe(409)
  })
})

describe('who may publish', () => {
  it('lets editors publish, not viewers', async () => {
    const project = await newProject(admin, 'Partagé')
    for (const [username, role] of [
      ['publish-editor', 'editor'],
      ['publish-viewer', 'viewer'],
    ]) {
      await admin.request('PUT', `/api/projects/${project.id}/members`, { username, role })
    }
    const body = { slug: 'partage', bundle: { doc: project.doc, code } }
    expect((await publish(viewer, project.id, body)).status).toBe(403)
    expect((await publish(editor, project.id, body)).status).toBe(201)
    expect((await viewer.request('DELETE', `/api/projects/${project.id}/publication`)).status).toBe(
      403,
    )
  })

  it('applies the space setting "members may publish"', async () => {
    const res = await admin.request('POST', '/api/spaces', { name: 'CM2', kind: 'class' })
    const spaceId = (await json<{ id: string }>(res)).id
    const created = await admin.request('POST', `/api/spaces/${spaceId}/accounts`, {
      username: 'eleve',
      displayName: 'Élève',
      password: 'eleve-password',
    })
    expect(created.status).toBe(201)
    const pupil = await server.signIn('eleve', 'eleve-password')
    const project = await newProject(pupil, 'Mon appli')
    const body = { slug: 'appli-eleve', bundle: { doc: project.doc, code } }

    const info = await json<{ canPublish: boolean }>(
      await pupil.request('GET', `/api/projects/${project.id}/publication`),
    )
    expect(info.canPublish).toBe(false)
    const refused = await publish(pupil, project.id, body)
    expect(refused.status).toBe(403)
    expect(await json(refused)).toEqual({ error: 'publish_forbidden' })
    // Nor through someone who may publish their own apps (SPEC § 0.10).
    const shared = await pupil.request('PUT', `/api/projects/${project.id}/members`, {
      username: 'publish-editor',
      role: 'editor',
    })
    expect(shared.status).toBe(200)
    const through = await publish(editor, project.id, { ...body, slug: 'appli-eleve-2' })
    expect(through.status).toBe(403)
    expect(await json(through)).toEqual({ error: 'publish_forbidden' })

    await admin.request('PATCH', `/api/spaces/${spaceId}`, { membersCanPublish: true })
    expect((await publish(pupil, project.id, body)).status).toBe(201)
  })
})

describe('the published page', () => {
  it('names the app, its language, colours and icons in the head', () => {
    const html = renderPlayerPage(
      indexHtml('player').replace('<head>', '<head><title>Rublox</title>'),
      { studioUrl: 'http://studio', appsUrl: 'http://apps' },
      { kind: 'app', slug: 'x-y' },
      {
        settings: { ...settings, description: 'a "quote" <b>', name: 'A&B' } as never,
        locale: 'en',
        base: '/a/x-y/',
      },
    )
    expect(html).toContain('<html lang="en">')
    expect(html).toContain('<title>A&#38;B</title>')
    expect(html).toContain('content="a &#34;quote&#34; &#60;b&#62;"')
    expect(html).toContain('<link rel="apple-touch-icon" href="/a/x-y/apple-touch-icon.png" />')
  })

  it('gives a manifest with maskable icons', () => {
    const doc = createProject({ name: 'X', locale: 'en', mode: 'studio' })
    const manifest = manifestOf(
      {
        appId: '1',
        slug: 'x-y',
        version: 1,
        settings: { ...settings, description: '' } as never,
        doc,
        code: {},
      },
      '/a/x-y/',
    )
    expect(manifest.icons.map((icon) => icon.purpose)).toEqual(['any', 'any', 'maskable'])
    expect(manifest.lang).toBe('en')
  })
})
