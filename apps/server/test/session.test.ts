import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { session } from '../src/db/schema.ts'
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

beforeAll(async () => {
  server = await createTestServer()
  admin = await server.signIn(ADMIN.username, ADMIN.password)
})
afterAll(() => server.close())

/** What the studio may call while it still believes it is signed in. */
const STUDIO_CALLS: [string, string, unknown?][] = [
  ['GET', '/api/projects'],
  ['POST', '/api/projects', { state: newProjectState('Late') }],
  ['GET', '/api/spaces'],
  ['GET', '/api/invites'],
  ['GET', '/api/admin/users'],
  ['PATCH', '/api/me', { displayName: 'Late' }],
  ['GET', '/api/auth/list-sessions'],
  ['GET', '/api/auth/passkey/list-user-passkeys'],
  ['POST', '/api/auth/revoke-other-sessions', {}],
  [
    'POST',
    '/api/auth/change-password',
    { currentPassword: 'x'.repeat(8), newPassword: 'y'.repeat(8) },
  ],
]

describe('a lost session never answers 401 (SPEC § 6.9)', () => {
  it.each(['expired', 'revoked'])('when it %s', async (how) => {
    const c = await server.signIn(ADMIN.username, ADMIN.password, '203.0.113.50')
    if (how === 'expired') {
      await server.services.db.update(session).set({ expiresAt: new Date(Date.now() - 1000) })
    } else {
      await admin.request('POST', '/api/auth/revoke-other-sessions', {})
    }
    const me = await c.request('GET', '/api/me')
    expect(me.status).toBe(200)
    expect((await json(me)).user).toBeNull()
    for (const [method, path, body] of STUDIO_CALLS) {
      const res = await c.request(method, path, body)
      expect({ path, status: res.status }).toEqual({ path, status: 403 })
      expect(await json(res)).toEqual({ error: 'signed_out' })
    }
    // The admin signs in again for the next case (the expiry hit every session).
    admin = await server.signIn(ADMIN.username, ADMIN.password)
  })

  it('keeps the 401 of a wrong password: the reverse proxy is meant to see it', async () => {
    expect((await server.client('203.0.113.51').signIn(ADMIN.username, 'nope-nope')).status).toBe(
      401,
    )
  })
})
