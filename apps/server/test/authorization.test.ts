import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  ADMIN,
  type Client,
  createTestServer,
  json,
  newProjectState,
  type TestServer,
} from './server.ts'

/**
 * Who may do what (SPEC § 6.9): a manager acts only on the member accounts of the spaces
 * they manage; projects are visible to their owner, the accounts they are shared with, and the
 * managers of the owner's spaces.
 */
let server: TestServer
let admin: Client
let parent: Client
let otherParent: Client
let teacher: Client
let child: Client
let familyId: string
let otherFamilyId: string
let classId: string
let childId: string
let adultMemberId: string
let childProjectId: string

let ipCounter = 10
const nextIp = () => `203.0.113.${ipCounter++}`

async function join(code: string, username: string) {
  const c = server.client(nextIp())
  const res = await c.request('POST', '/api/invites/accept', {
    code,
    username,
    displayName: username,
    password: `${username}-password`,
  })
  expect(res.status, username).toBe(201)
  return c
}

async function inviteCode(by: Client, body: Record<string, unknown> = {}) {
  const res = await by.request('POST', '/api/invites', body)
  expect(res.status).toBe(201)
  return (await json<{ code: string }>(res)).code
}

async function createSpace(by: Client, name: string, kind: string) {
  const res = await by.request('POST', '/api/spaces', { name, kind })
  expect(res.status).toBe(201)
  return (await json<{ id: string }>(res)).id
}

async function createChild(by: Client, spaceId: string, username: string) {
  const res = await by.request('POST', `/api/spaces/${spaceId}/accounts`, {
    username,
    displayName: username,
    password: `${username}-password`,
  })
  expect(res.status, username).toBe(201)
  return (await json<{ id: string }>(res)).id
}

beforeAll(async () => {
  server = await createTestServer()
  admin = await server.signIn(ADMIN.username, ADMIN.password, nextIp())
  parent = await join(await inviteCode(admin), 'parent')
  otherParent = await join(await inviteCode(admin), 'other-parent')
  teacher = await join(await inviteCode(admin), 'teacher')
  familyId = await createSpace(parent, 'Famille', 'family')
  otherFamilyId = await createSpace(otherParent, 'Autre famille', 'family')
  classId = await createSpace(teacher, 'CM2', 'class')
  childId = await createChild(parent, familyId, 'lou')
  child = await server.signIn('lou', 'lou-password', nextIp())
  // An adult invited into the family as a plain member (not created by the parent).
  await join(await inviteCode(parent, { spaceId: familyId, spaceRole: 'member' }), 'grand-parent')
  const family = await json<{ members: { id: string; username: string }[] }>(
    await parent.request('GET', `/api/spaces/${familyId}`),
  )
  adultMemberId = family.members.find((m) => m.username === 'grand-parent')?.id ?? ''
  const created = await child.request('POST', '/api/projects', {
    state: newProjectState('Mon jeu'),
  })
  expect(created.status).toBe(201)
  childProjectId = (await json<{ id: string }>(created)).id
}, 60_000)
afterAll(() => server.close())

describe('spaces', () => {
  it('lets a parent create a family and a member account without e-mail, starting in Junior', async () => {
    const me = await json<{ user: { managedBySpaceId: string; uiMode: string; email: null } }>(
      await child.request('GET', '/api/me'),
    )
    expect(me.user).toMatchObject({ managedBySpaceId: familyId, uiMode: 'junior', email: null })
  })

  it('shows the space to its members only', async () => {
    expect((await child.request('GET', `/api/spaces/${familyId}`)).status).toBe(200)
    expect((await otherParent.request('GET', `/api/spaces/${familyId}`)).status).toBe(404)
    expect((await teacher.request('GET', `/api/spaces/${familyId}`)).status).toBe(404)
  })

  it('refuses member actions to members and to managers of other spaces', async () => {
    const body = { username: 'intrus', displayName: 'Intrus', password: 'intrus-password' }
    expect((await child.request('POST', `/api/spaces/${familyId}/accounts`, body)).status).toBe(403)
    expect(
      (await otherParent.request('POST', `/api/spaces/${familyId}/accounts`, body)).status,
    ).toBe(404)
    expect((await child.request('PATCH', `/api/spaces/${familyId}`, { name: 'X' })).status).toBe(
      403,
    )
    expect(
      (await child.request('POST', '/api/spaces', { name: 'Mine', kind: 'team' })).status,
    ).toBe(403)
  })

  it('lets only the parent reset the child’s password, and signs the child out', async () => {
    const path = `/api/spaces/${familyId}/accounts/${childId}/password`
    const body = { password: 'new-lou-password' }
    expect((await otherParent.request('POST', path, body)).status).toBe(404)
    expect(
      (
        await otherParent.request(
          'POST',
          `/api/spaces/${otherFamilyId}/accounts/${childId}/password`,
          body,
        )
      ).status,
    ).toBe(404)
    expect((await teacher.request('POST', path, body)).status).toBe(404)
    expect((await child.request('POST', path, body)).status).toBe(403)
    expect((await admin.request('POST', path, body)).status).toBe(404)

    const session = await server.signIn('lou', 'lou-password', nextIp())
    expect((await parent.request('POST', path, body)).status).toBe(200)
    expect(await json(await session.request('GET', '/api/me'))).toMatchObject({ user: null })
    expect((await server.client(nextIp()).signIn('lou', 'lou-password')).status).toBe(401)
    child = await server.signIn('lou', 'new-lou-password', nextIp())
  })

  it('never gives a manager power over an adult they did not create', async () => {
    const path = `/api/spaces/${familyId}/accounts/${adultMemberId}/password`
    expect((await parent.request('POST', path, { password: 'stolen-password' })).status).toBe(404)
    expect(
      (await parent.request('DELETE', `/api/spaces/${familyId}/accounts/${adultMemberId}`)).status,
    ).toBe(404)
  })

  it('keeps at least one manager and refuses to promote a member account', async () => {
    const me = await json<{ user: { id: string } }>(await parent.request('GET', '/api/me'))
    expect(
      (await parent.request('DELETE', `/api/spaces/${familyId}/members/${me.user.id}`)).status,
    ).toBe(409)
    expect(
      (
        await parent.request('PATCH', `/api/spaces/${familyId}/members/${childId}`, {
          manager: true,
        })
      ).status,
    ).toBe(403)
    expect((await parent.request('DELETE', `/api/spaces/${familyId}`)).status).toBe(409)
  })

  it('lets a manager invite into their own space only, and never as admin', async () => {
    expect(
      (await parent.request('POST', '/api/invites', { spaceId: classId, spaceRole: 'member' }))
        .status,
    ).toBe(404)
    expect(
      (
        await parent.request('POST', '/api/invites', {
          spaceId: familyId,
          spaceRole: 'member',
          role: 'admin',
        })
      ).status,
    ).toBe(403)
    expect((await parent.request('POST', '/api/invites', {})).status).toBe(403)
    expect(
      (await child.request('POST', '/api/invites', { spaceId: familyId, spaceRole: 'member' }))
        .status,
    ).toBe(403)
  })
})

describe('administration', () => {
  it('is for administrators only', async () => {
    for (const c of [parent, child, teacher]) {
      expect((await c.request('GET', '/api/admin/users')).status).toBe(403)
      expect(
        (await c.request('PATCH', '/api/admin/settings', { galleryEnabled: false })).status,
      ).toBe(403)
    }
    expect((await server.client(nextIp()).request('GET', '/api/admin/users')).status).toBe(403)
  })

  it('lists, creates, disables and deletes accounts', async () => {
    const users = await json<{ users: { username: string; managed: boolean }[] }>(
      await admin.request('GET', '/api/admin/users'),
    )
    expect(users.users.find((u) => u.username === 'lou')?.managed).toBe(true)
    const created = await admin.request('POST', '/api/admin/users', {
      username: 'temp',
      displayName: 'Temp',
      password: 'temp-password',
    })
    expect(created.status).toBe(201)
    const { id } = await json<{ id: string }>(created)
    const temp = await server.signIn('temp', 'temp-password', nextIp())
    expect(
      (await admin.request('PATCH', `/api/admin/users/${id}`, { disabled: true })).status,
    ).toBe(200)
    expect(await json(await temp.request('GET', '/api/me'))).toMatchObject({ user: null })
    expect((await server.client(nextIp()).signIn('temp', 'temp-password')).status).toBe(403)
    expect((await admin.request('DELETE', `/api/admin/users/${id}`)).status).toBe(200)
  })

  it('never lets an administrator lock themself out', async () => {
    const me = await json<{ user: { id: string } }>(await admin.request('GET', '/api/me'))
    expect(
      (await admin.request('PATCH', `/api/admin/users/${me.user.id}`, { disabled: true })).status,
    ).toBe(409)
    expect((await admin.request('DELETE', `/api/admin/users/${me.user.id}`)).status).toBe(409)
  })

  it('reads and changes the instance settings', async () => {
    const res = await admin.request('PATCH', '/api/admin/settings', {
      instanceName: 'Maison',
      storageQuotaMb: 1,
    })
    expect(await json(res)).toMatchObject({
      settings: { instanceName: 'Maison', storageQuotaMb: 1 },
    })
    const spaces = await json<{ spaces: { name: string; managers: string[] }[] }>(
      await admin.request('GET', '/api/admin/spaces'),
    )
    expect(spaces.spaces.find((s) => s.name === 'Famille')?.managers).toEqual(['parent'])
  })
})

describe('projects', () => {
  type Summary = {
    id: string
    access: string
    owner: { username: string }
    deletedAt: string | null
    favorite: boolean
    name: string
  }
  const list = async (c: Client) =>
    (await json<{ projects: Summary[] }>(await c.request('GET', '/api/projects'))).projects

  it('shows the child’s project to the parent, read-only', async () => {
    const seen = (await list(parent)).find((p) => p.id === childProjectId)
    expect(seen).toMatchObject({ access: 'manager', owner: { username: 'lou' }, name: 'Mon jeu' })
    expect((await parent.request('GET', `/api/projects/${childProjectId}`)).status).toBe(200)
    const write = await parent.request('PATCH', `/api/projects/${childProjectId}`, { name: 'Hack' })
    expect(write.status).toBe(403)
    expect((await parent.request('POST', `/api/projects/${childProjectId}/trash`)).status).toBe(403)
  })

  it('hides it from everyone else', async () => {
    for (const c of [otherParent, teacher, admin]) {
      expect((await list(c)).some((p) => p.id === childProjectId)).toBe(false)
      expect((await c.request('GET', `/api/projects/${childProjectId}`)).status).toBe(404)
      expect(
        (
          await c.request('POST', `/api/projects/${childProjectId}/sync`, {
            update: '',
            stateVector: '',
          })
        ).status,
      ).toBe(404)
    }
  })

  it('shares in read or write mode', async () => {
    const res = await child.request('PUT', `/api/projects/${childProjectId}/members`, {
      username: 'teacher',
      role: 'viewer',
    })
    expect(res.status).toBe(200)
    expect((await list(teacher)).find((p) => p.id === childProjectId)?.access).toBe('viewer')
    expect(
      (await teacher.request('PATCH', `/api/projects/${childProjectId}`, { name: 'X' })).status,
    ).toBe(403)
    await child.request('PUT', `/api/projects/${childProjectId}/members`, {
      username: 'teacher',
      role: 'editor',
    })
    expect(
      (await teacher.request('PATCH', `/api/projects/${childProjectId}`, { name: 'Notre jeu' }))
        .status,
    ).toBe(200)
    // Only the owner shares.
    expect(
      (
        await teacher.request('PUT', `/api/projects/${childProjectId}/members`, {
          username: 'other-parent',
          role: 'viewer',
        })
      ).status,
    ).toBe(403)
  })

  it('keeps favorites per account and a 30-day trash', async () => {
    await parent.request('PATCH', `/api/projects/${childProjectId}`, { favorite: true })
    expect((await list(parent)).find((p) => p.id === childProjectId)?.favorite).toBe(true)
    expect((await list(child)).find((p) => p.id === childProjectId)?.favorite).toBe(false)
    expect((await child.request('POST', `/api/projects/${childProjectId}/trash`)).status).toBe(200)
    expect((await list(child)).find((p) => p.id === childProjectId)?.deletedAt).not.toBeNull()
    expect((await list(parent)).some((p) => p.id === childProjectId)).toBe(false)
    expect((await child.request('POST', `/api/projects/${childProjectId}/restore`)).status).toBe(
      200,
    )
  })

  it('duplicates into the caller’s projects', async () => {
    const res = await parent.request('POST', `/api/projects/${childProjectId}/duplicate`, {
      name: 'Copie',
    })
    expect(res.status).toBe(201)
    const { id } = await json<{ id: string }>(res)
    expect((await list(parent)).find((p) => p.id === id)).toMatchObject({
      access: 'owner',
      name: 'Copie',
    })
  })

  it('rejects documents that are not projects', async () => {
    const res = await child.request('POST', '/api/projects', {
      state: Buffer.from([0, 0]).toString('base64'),
    })
    expect(res.status).toBe(400)
  })
})
