import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { bootstrapAdmin } from '../src/accounts.ts'
import { invites, user } from '../src/db/schema.ts'
import { hashInviteCode } from '../src/routes/invites.ts'
import { ADMIN, type Client, createTestServer, json, type TestServer } from './server.ts'

let server: TestServer
let admin: Client

beforeAll(async () => {
  server = await createTestServer()
  admin = await server.signIn(ADMIN.username, ADMIN.password)
})
afterAll(() => server.close())

async function invite(body: Record<string, unknown> = {}) {
  const res = await admin.request('POST', '/api/invites', body)
  expect(res.status).toBe(201)
  return json<{ id: string; code: string }>(res)
}

describe('first start', () => {
  it('creates the administrator from the environment, once', async () => {
    const [row] = await server.services.db.select().from(user).where(eq(user.username, 'admin'))
    expect(row?.role).toBe('admin')
    expect(
      await bootstrapAdmin(server.services, { username: 'other', password: 'password-2' }),
    ).toBe('exists')
  })

  it('answers /api/me with 200 and no user when signed out (never 401)', async () => {
    const res = await server.client().request('GET', '/api/me')
    expect(res.status).toBe(200)
    expect(await json(res)).toEqual({ user: null, spaces: [] })
  })

  it('returns the profile when signed in', async () => {
    const res = await admin.api.me.$get()
    const body = await res.json()
    expect(body.user).toMatchObject({ username: 'admin', isAdmin: true, email: null })
  })
})

describe('sessions', () => {
  it('lasts a year', async () => {
    const res = await admin.request('GET', '/api/auth/get-session')
    const body = await json<{ session: { expiresAt: string } }>(res)
    const days = (Date.parse(body.session.expiresAt) - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(364)
  })

  it('lists active sessions and revokes one', async () => {
    const other = await server.signIn(ADMIN.username, ADMIN.password)
    const list = await json<{ token: string }[]>(
      await admin.request('GET', '/api/auth/list-sessions'),
    )
    expect(list.length).toBeGreaterThanOrEqual(2)
    const token = other.cookies.get('better-auth.session_token')?.split('.')[0]
    expect(token).toBeTruthy()
    const res = await admin.request('POST', '/api/auth/revoke-session', { token })
    expect(res.status).toBe(200)
    expect(await json(await other.request('GET', '/api/me'))).toMatchObject({ user: null })
  })

  it('keeps open registration and the Better Auth admin endpoints closed', async () => {
    const anonymous = server.client()
    for (const [method, path] of [
      ['POST', '/api/auth/sign-up/email'],
      ['POST', '/api/auth/admin/create-user'],
      ['POST', '/api/auth/organization/create'],
      ['POST', '/api/auth/update-user'],
      ['POST', '/api/auth/delete-user'],
    ] as const) {
      expect((await anonymous.request(method, path, {})).status, path).toBe(404)
      expect((await admin.request(method, path, {})).status, path).toBe(404)
    }
  })
})

describe('invitations', () => {
  it('stores only a keyed hash of the code', async () => {
    const { id, code } = await invite()
    const [row] = await server.services.db.select().from(invites).where(eq(invites.id, id))
    expect(row?.codeHash).toBe(hashInviteCode(server.config.secret, code))
    expect(JSON.stringify(row)).not.toContain(code)
  })

  it('creates an account, signs it in, and counts the use', async () => {
    const { code } = await invite({ maxUses: 1, note: 'Parent' })
    const visitor = server.client('198.51.100.7')
    const check = await visitor.request('POST', '/api/invites/check', { code })
    expect(check.status).toBe(200)
    const res = await visitor.request('POST', '/api/invites/accept', {
      code,
      username: 'Camille',
      displayName: 'Camille',
      password: 'camille-password',
    })
    expect(res.status).toBe(201)
    const me = await json<{ user: { username: string; role: string } }>(
      await visitor.request('GET', '/api/me'),
    )
    expect(me.user).toMatchObject({ username: 'camille', role: 'user' })

    const again = await server.client('198.51.100.8').request('POST', '/api/invites/accept', {
      code,
      username: 'other',
      displayName: 'Other',
      password: 'other-password',
    })
    expect(again.status).toBe(404)
    const list = await json<{
      invites: { note: string; uses: number; status: string; usedBy: { username: string }[] }[]
    }>(await admin.request('GET', '/api/invites'))
    const used = list.invites.find((entry) => entry.note === 'Parent')
    expect(used).toMatchObject({ uses: 1, status: 'used', usedBy: [{ username: 'camille' }] })
  })

  it('refuses revoked and expired invitations', async () => {
    const revoked = await invite()
    expect((await admin.request('DELETE', `/api/invites/${revoked.id}`)).status).toBe(200)
    const visitor = server.client('198.51.100.20')
    expect(
      (await visitor.request('POST', '/api/invites/check', { code: revoked.code })).status,
    ).toBe(404)
    const expired = await invite()
    await server.services.db
      .update(invites)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(invites.id, expired.id))
    expect(
      (await visitor.request('POST', '/api/invites/check', { code: expired.code })).status,
    ).toBe(404)
  })

  it('rejects a taken username without using the invitation', async () => {
    const { id, code } = await invite()
    const res = await server.client('198.51.100.30').request('POST', '/api/invites/accept', {
      code,
      username: 'admin',
      displayName: 'Admin bis',
      password: 'some-password',
    })
    expect(res.status).toBe(409)
    const [row] = await server.services.db.select().from(invites).where(eq(invites.id, id))
    expect(row?.uses).toBe(0)
  })

  it('gives the invitation role: an admin invitation makes an admin', async () => {
    const { code } = await invite({ role: 'admin' })
    const visitor = server.client('198.51.100.40')
    await visitor.request('POST', '/api/invites/accept', {
      code,
      username: 'second-admin',
      displayName: 'Second',
      password: 'second-password',
    })
    const me = await json<{ user: { isAdmin: boolean } }>(await visitor.request('GET', '/api/me'))
    expect(me.user.isAdmin).toBe(true)
  })
})

describe('brute force (SPEC § 4.7)', () => {
  it('blocks an address after 5 failures in 15 minutes, even with the right password', async () => {
    const attacker = server.client('192.0.2.99')
    for (let i = 0; i < 5; i++) {
      expect((await attacker.signIn(ADMIN.username, 'wrong-password')).status).toBe(401)
    }
    expect((await attacker.signIn(ADMIN.username, ADMIN.password)).status).toBe(429)
    // Invitation codes share the limit.
    expect(
      (await attacker.request('POST', '/api/invites/check', { code: 'x'.repeat(20) })).status,
    ).toBe(429)
    // Another address is not affected.
    expect((await server.client('192.0.2.100').signIn(ADMIN.username, ADMIN.password)).status).toBe(
      200,
    )
  })

  it('ignores X-Real-IP and X-Forwarded-For unless TRUST_PROXY is set', async () => {
    const attacker = server.client('192.0.2.150')
    for (let i = 0; i < 5; i++) {
      await attacker.request(
        'POST',
        '/api/auth/sign-in/username',
        { username: 'admin', password: 'nope-nope' },
        { 'x-real-ip': `10.0.0.${i}`, 'x-forwarded-for': `10.1.0.${i}` },
      )
    }
    expect((await attacker.signIn(ADMIN.username, ADMIN.password)).status).toBe(429)
  })

  it('reads X-Real-IP behind a trusted proxy', async () => {
    const proxied = await createTestServer({ TRUST_PROXY: 'true' })
    try {
      const proxy = proxied.client('10.0.0.1')
      for (let i = 0; i < 5; i++) {
        await proxy.request(
          'POST',
          '/api/auth/sign-in/username',
          { username: 'admin', password: 'nope-nope' },
          { 'x-real-ip': '203.0.113.50' },
        )
      }
      const blocked = await proxy.request('POST', '/api/auth/sign-in/username', ADMIN, {
        'x-real-ip': '203.0.113.50',
      })
      expect(blocked.status).toBe(429)
      const other = await proxy.request('POST', '/api/auth/sign-in/username', ADMIN, {
        'x-real-ip': '203.0.113.51',
        'x-forwarded-for': '203.0.113.50',
      })
      expect(other.status).toBe(200)
    } finally {
      await proxied.close()
    }
  })
})

describe('origin check', () => {
  it('refuses changes coming from another origin', async () => {
    const res = await admin.request(
      'POST',
      '/api/spaces',
      { name: 'X', kind: 'team' },
      {
        origin: 'http://evil.example.com',
      },
    )
    expect(res.status).toBe(403)
  })
})

describe('profile', () => {
  it('updates the display name, avatar, language, mode and theme', async () => {
    const res = await admin.api.me.$patch({
      json: {
        displayName: 'Guilhem',
        avatar: 'fox',
        locale: 'en',
        uiMode: 'studio',
        theme: 'dark',
      },
    })
    expect(res.status).toBe(200)
    const { user: profile } = await (await admin.api.me.$get()).json()
    expect(profile).toMatchObject({
      displayName: 'Guilhem',
      avatar: 'fox',
      locale: 'en',
      uiMode: 'studio',
      theme: 'dark',
    })
  })

  it('sets an optional e-mail, which then works for signing in', async () => {
    await admin.api.me.$patch({ json: { email: 'admin@example.com' } })
    const res = await server.client('203.0.113.77').request('POST', '/api/auth/sign-in/email', {
      email: 'admin@example.com',
      password: ADMIN.password,
    })
    expect(res.status).toBe(200)
  })

  it('validates the input', async () => {
    const res = await admin.request('PATCH', '/api/me', { uiMode: 'expert' })
    expect(res.status).toBe(400)
  })
})
