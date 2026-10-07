import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { organization, projects, user } from '../src/db/schema.ts'
import {
  ADMIN,
  type Client,
  createTestServer,
  json,
  newProjectState,
  type TestServer,
} from './server.ts'

/** RGPD (SPEC § 4.7): export of all one's data, and deletion of the account. */
let server: TestServer
let admin: Client
let ip = 60
const nextIp = () => `203.0.113.${ip++}`

async function join(username: string) {
  const invite = await json<{ code: string }>(await admin.request('POST', '/api/invites', {}))
  const c = server.client(nextIp())
  const res = await c.request('POST', '/api/invites/accept', {
    code: invite.code,
    username,
    displayName: username,
    password: `${username}-password`,
  })
  expect(res.status).toBe(201)
  return c
}

const userId = async (username: string) =>
  (await server.services.db.select().from(user).where(eq(user.username, username)))[0]?.id

beforeAll(async () => {
  server = await createTestServer()
  admin = await server.signIn(ADMIN.username, ADMIN.password, nextIp())
}, 30_000)
afterAll(() => server.close())

describe('export', () => {
  it('gives everything about the account, never a secret', async () => {
    const sam = await join('sam')
    await sam.request('POST', '/api/projects', { state: newProjectState('Projet de Sam') })
    const res = await sam.request('GET', '/api/me/export')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-disposition')).toContain('attachment')
    const data = await json<{
      profile: { username: string }
      projects: { name: string; document: { meta: { name: string } } }[]
      sessions: unknown[]
    }>(res)
    expect(data.profile.username).toBe('sam')
    expect(data.projects.map((p) => p.document.meta.name)).toEqual(['Projet de Sam'])
    expect(data.sessions.length).toBeGreaterThan(0)
    const text = JSON.stringify(data)
    for (const secret of [...sam.cookies.values()]) {
      expect(text).not.toContain(decodeURIComponent(secret).split('.')[0])
    }
    expect(text).not.toMatch(/password|scrypt|token/i)
  })

  it('lets a manager export a member account they created, and nobody else', async () => {
    const parent = await join('parent')
    const space = await json<{ id: string }>(
      await parent.request('POST', '/api/spaces', { name: 'Famille', kind: 'family' }),
    )
    const child = await json<{ id: string }>(
      await parent.request('POST', `/api/spaces/${space.id}/accounts`, {
        username: 'kid',
        displayName: 'Kid',
        password: 'kid-password',
      }),
    )
    const path = `/api/spaces/${space.id}/accounts/${child.id}/export`
    expect((await parent.request('GET', path)).status).toBe(200)
    const stranger = await join('stranger')
    expect((await stranger.request('GET', path)).status).toBe(404)
    const kid = await server.signIn('kid', 'kid-password', nextIp())
    expect((await kid.request('GET', '/api/me/export')).status).toBe(200)
    // A member account is deleted by its manager, not by itself.
    expect((await kid.request('DELETE', '/api/me', { password: 'kid-password' })).status).toBe(403)
  })
})

describe('deletion', () => {
  it('asks for the password, then removes the account and its projects', async () => {
    const leo = await join('leo')
    const created = await json<{ id: string }>(
      await leo.request('POST', '/api/projects', { state: newProjectState('Projet de Léo') }),
    )
    expect((await leo.request('DELETE', '/api/me', { password: 'wrong-one' })).status).toBe(400)
    expect((await leo.request('DELETE', '/api/me', { password: 'leo-password' })).status).toBe(200)
    expect(await userId('leo')).toBeUndefined()
    const left = await server.services.db.select().from(projects).where(eq(projects.id, created.id))
    expect(left).toEqual([])
    // The session is gone: a lost session, not a 401.
    const me = await json<{ user: unknown }>(await leo.request('GET', '/api/me'))
    expect(me.user).toBeNull()
    expect((await server.client(nextIp()).signIn('leo', 'leo-password')).status).toBe(401)
  })

  it('takes a space the account is alone in, and keeps one whose members need a manager', async () => {
    const solo = await join('solo')
    const lonely = await json<{ id: string }>(
      await solo.request('POST', '/api/spaces', { name: 'Seul', kind: 'team' }),
    )
    expect((await solo.request('DELETE', '/api/me', { password: 'solo-password' })).status).toBe(
      200,
    )
    const rows = await server.services.db
      .select()
      .from(organization)
      .where(eq(organization.id, lonely.id))
    expect(rows).toEqual([])

    const teacher = await join('teacher')
    const school = await json<{ id: string }>(
      await teacher.request('POST', '/api/spaces', { name: 'CM2', kind: 'class' }),
    )
    await teacher.request('POST', `/api/spaces/${school.id}/accounts`, {
      username: 'pupil',
      displayName: 'Pupil',
      password: 'pupil-password',
    })
    const refused = await teacher.request('DELETE', '/api/me', { password: 'teacher-password' })
    expect(refused.status).toBe(409)
    expect(await json(refused)).toEqual({ error: 'last_manager' })
  })

  it('never deletes the last administrator', async () => {
    const res = await admin.request('DELETE', '/api/me', { password: ADMIN.password })
    expect(res.status).toBe(409)
    expect(await json(res)).toEqual({ error: 'last_admin' })
  })
})
