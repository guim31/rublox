import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  ADMIN,
  type Client,
  createTestServer,
  json,
  newProjectState,
  type TestServer,
} from './server.ts'

let server: TestServer
let admin: Client
let alice: Client
let bob: Client

type Entry = {
  id: string
  name: string
  likes: number
  liked: boolean
  remixes: number
  mine: boolean
  mode: string
  remixOf: { id: string; name: string; owner: string } | null
}

async function account(username: string, displayName = username) {
  const res = await admin.request('POST', '/api/admin/users', {
    username,
    displayName,
    password: `${username}-password`,
  })
  expect(res.status, username).toBe(201)
  return server.signIn(username, `${username}-password`)
}

async function newProject(by: Client, name: string) {
  const res = await by.request('POST', '/api/projects', { state: newProjectState(name) })
  expect(res.status).toBe(201)
  return (await json<{ id: string }>(res)).id
}

const share = (by: Client, id: string, shared = true) =>
  by.request('PUT', `/api/gallery/${id}/sharing`, { shared })

const list = async (by: Client, query = '') => {
  const res = await by.request('GET', `/api/gallery${query}`)
  expect(res.status).toBe(200)
  return json<{ entries: Entry[]; canShare: boolean }>(res)
}

beforeAll(async () => {
  server = await createTestServer()
  admin = await server.signIn(ADMIN.username, ADMIN.password)
  alice = await account('alice', 'Alice')
  bob = await account('bob', 'Bob')
})

afterAll(async () => {
  await server.close()
})

describe('gallery', () => {
  let rocket: string

  it('is empty, and private projects stay out of it', async () => {
    rocket = await newProject(alice, 'La fusée')
    expect((await list(bob)).entries).toEqual([])
    // Not shared: someone else cannot even see it.
    expect((await bob.request('GET', `/api/projects/${rocket}`)).status).toBe(404)
  })

  it('shows a project its owner shared, to every account', async () => {
    expect((await share(bob, rocket)).status).toBe(404)
    expect((await share(alice, rocket)).status).toBe(200)
    const { entries } = await list(bob)
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      id: rocket,
      name: 'La fusée',
      mine: false,
      likes: 0,
      mode: 'junior',
    })
    expect((await list(alice)).entries[0]?.mine).toBe(true)
    // "See the blocks": read-only access, nothing else.
    const project = await json<{ access: string; inGallery: boolean }>(
      await bob.request('GET', `/api/projects/${rocket}`),
    )
    expect(project).toMatchObject({ access: 'gallery', inGallery: true })
    expect((await bob.request('GET', `/api/projects/${rocket}/versions`)).status).toBe(404)
    expect((await bob.request('GET', `/api/projects/${rocket}/members`)).status).toBe(404)
    expect((await bob.request('PATCH', `/api/projects/${rocket}`, { name: 'x' })).status).toBe(403)
  })

  it('opens the project read-only on /ws/collab', async () => {
    const tab = await server.tab(bob, rocket)
    expect(tab.refused).toBeNull()
    expect(tab.readOnly).toBe(true)
    tab.close()
  })

  it('counts likes, once per account', async () => {
    expect((await bob.request('PUT', `/api/gallery/${rocket}/like`)).status).toBe(200)
    expect((await bob.request('PUT', `/api/gallery/${rocket}/like`)).status).toBe(200)
    expect((await alice.request('PUT', `/api/gallery/${rocket}/like`)).status).toBe(200)
    let entry = (await list(bob)).entries[0]
    expect(entry).toMatchObject({ likes: 2, liked: true })
    await bob.request('DELETE', `/api/gallery/${rocket}/like`)
    entry = (await list(bob)).entries[0]
    expect(entry).toMatchObject({ likes: 1, liked: false })
  })

  let remix: string

  it('remixes: a copy in my projects, with "remix of X by Y"', async () => {
    const res = await bob.request('POST', `/api/gallery/${rocket}/remix`, { name: 'Ma fusée' })
    expect(res.status).toBe(201)
    remix = (await json<{ id: string }>(res)).id
    const mine = await json<{ projects: { id: string; access: string }[] }>(
      await bob.request('GET', '/api/projects'),
    )
    expect(mine.projects.map((p) => p.id)).toContain(remix)
    const project = await json<{ access: string; remixOf: unknown }>(
      await bob.request('GET', `/api/projects/${remix}`),
    )
    expect(project).toMatchObject({
      access: 'owner',
      remixOf: { id: rocket, name: 'La fusée', owner: 'Alice' },
    })
    expect((await list(alice)).entries.find((e) => e.id === rocket)?.remixes).toBe(1)
  })

  it('"Make a copy" of a gallery project is a remix too', async () => {
    const res = await bob.request('POST', `/api/projects/${rocket}/duplicate`, { name: 'Copie' })
    expect(res.status).toBe(201)
    const copy = (await json<{ id: string }>(res)).id
    const project = await json<{ remixOf: { id: string } | null }>(
      await bob.request('GET', `/api/projects/${copy}`),
    )
    expect(project.remixOf?.id).toBe(rocket)
  })

  it('draws the tree of remixes, naming only shared ones', async () => {
    expect((await share(bob, remix)).status).toBe(200)
    const carol = await account('carol', 'Carol')
    const res = await carol.request('POST', `/api/gallery/${remix}/remix`, { name: 'Fusée 3' })
    expect(res.status).toBe(201)
    const detail = await json<{
      remixes: { name: string; visible: boolean; children: { visible: boolean }[] }[]
      ancestors: unknown[]
    }>(await carol.request('GET', `/api/gallery/${rocket}`))
    const shared = detail.remixes.find((node) => node.visible)
    expect(shared?.name).toBe('Ma fusée')
    expect(shared?.children).toEqual([expect.objectContaining({ visible: false, name: '' })])
    // The private copy is counted, not named.
    expect(detail.remixes.filter((node) => !node.visible)).toHaveLength(1)
    const child = await json<{ ancestors: { id: string; visible: boolean }[] }>(
      await carol.request('GET', `/api/gallery/${remix}`),
    )
    expect(child.ancestors).toEqual([expect.objectContaining({ id: rocket, visible: true })])
  })

  it('filters by mode and searches', async () => {
    expect((await list(bob, '?mode=studio')).entries).toEqual([])
    expect((await list(bob, '?mode=junior')).entries.length).toBe(2)
    expect((await list(bob, '?q=ma%20fus')).entries.map((e) => e.name)).toEqual(['Ma fusée'])
    const popular = await list(bob, '?sort=popular')
    expect(popular.entries[0]?.id).toBe(rocket)
  })

  it('lets the administrator take a project out, for good', async () => {
    expect((await alice.request('DELETE', `/api/gallery/${rocket}`)).status).toBe(403)
    expect((await admin.request('DELETE', `/api/gallery/${rocket}`)).status).toBe(200)
    expect((await list(bob)).entries.map((e) => e.id)).not.toContain(rocket)
    expect((await bob.request('GET', `/api/projects/${rocket}`)).status).toBe(404)
    const res = await share(alice, rocket)
    expect(res.status).toBe(403)
    expect(await json(res)).toEqual({ error: 'gallery_removed' })
    expect((await admin.request('POST', `/api/gallery/${rocket}/allow`)).status).toBe(200)
    expect((await share(alice, rocket)).status).toBe(200)
  })

  it('leaves the trash out', async () => {
    await alice.request('POST', `/api/projects/${rocket}/trash`)
    expect((await list(bob)).entries.map((e) => e.id)).not.toContain(rocket)
    await alice.request('POST', `/api/projects/${rocket}/restore`)
  })

  it('obeys the managers of a space', async () => {
    const created = await json<{ id: string }>(
      await alice.request('POST', '/api/spaces', { name: 'Famille', kind: 'family' }),
    )
    const res = await alice.request('POST', `/api/spaces/${created.id}/accounts`, {
      username: 'kid',
      displayName: 'Kid',
      password: 'kid-password',
    })
    expect(res.status).toBe(201)
    const kid = await server.signIn('kid', 'kid-password')
    const project = await newProject(kid, 'Mon jeu')
    // Off by default: the managers decide.
    expect((await list(kid)).canShare).toBe(false)
    const refused = await share(kid, project)
    expect(refused.status).toBe(403)
    expect(await json(refused)).toEqual({ error: 'gallery_forbidden' })
    expect(
      (
        await alice.request('PATCH', `/api/spaces/${created.id}`, {
          membersCanShareInGallery: true,
        })
      ).status,
    ).toBe(200)
    expect((await list(kid)).canShare).toBe(true)
    expect((await share(kid, project)).status).toBe(200)
    const me = await json<{ features: { galleryShare: boolean; ai: unknown } }>(
      await kid.request('GET', '/api/me'),
    )
    expect(me.features).toMatchObject({ galleryShare: true, ai: null })
  })

  it('can be switched off by the administrator', async () => {
    await admin.request('PATCH', '/api/admin/settings', { galleryEnabled: false })
    expect((await bob.request('GET', '/api/gallery')).status).toBe(403)
    expect((await share(bob, remix)).status).toBe(403)
    const me = await json<{ features: { gallery: boolean } }>(await bob.request('GET', '/api/me'))
    expect(me.features.gallery).toBe(false)
    await admin.request('PATCH', '/api/admin/settings', { galleryEnabled: true })
  })

  it('refuses the guest (no session)', async () => {
    const guest = server.client()
    expect((await guest.request('GET', '/api/gallery')).status).toBe(403)
  })
})
