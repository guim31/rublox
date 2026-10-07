import { createHmac } from 'node:crypto'
import { and, desc, eq, gt, inArray, isNull, lt, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { managedSpaceIds, requireMembership } from '../access.ts'
import {
  createAccount,
  displayNameSchema,
  emailSchema,
  passwordSchema,
  usernameSchema,
} from '../accounts.ts'
import { CLIENT_IP_HEADER } from '../auth.ts'
import { invites, inviteUses, member, organization, spaceSettings, user } from '../db/schema.ts'
import { type ApiEnv, fail, isAdmin, iso, jsonBody, requireUser } from '../http.ts'
import { randomToken, uuidv7 } from '../ids.ts'
import type { Services } from '../services.ts'
import type { SpaceKind } from './me.ts'

const DAY_MS = 24 * 3600 * 1000

/** Codes are stored as an HMAC keyed with `RUBLOX_SECRET`: a database leak gives no link. */
export function hashInviteCode(secret: string, code: string): string {
  return createHmac('sha256', secret).update(`invite:${code}`).digest('hex')
}

const inviteInput = z
  .object({
    note: z.string().trim().max(120).optional(),
    role: z.enum(['user', 'admin']).default('user'),
    spaceId: z.string().optional(),
    spaceRole: z.enum(['manager', 'member']).optional(),
    maxUses: z.number().int().min(1).max(1000).default(1),
    /** Null: never expires. */
    expiresInDays: z.number().int().min(1).max(365).nullable().default(7),
  })
  .refine((value) => !value.spaceId || value.spaceRole, { path: ['spaceRole'] })

const acceptInput = z.object({
  code: z.string().min(10).max(100),
  username: usernameSchema,
  displayName: displayNameSchema,
  password: passwordSchema,
  email: z.union([emailSchema, z.literal('')]).optional(),
})

type InviteRow = typeof invites.$inferSelect

export function inviteStatus(invite: InviteRow, now = new Date()) {
  if (invite.revokedAt) return 'revoked' as const
  if (invite.expiresAt && invite.expiresAt <= now) return 'expired' as const
  if (invite.uses >= invite.maxUses) return 'used' as const
  return 'active' as const
}

/** Conditions of a usable invitation, for an atomic `update … returning`. */
const usable = () =>
  and(
    isNull(invites.revokedAt),
    or(isNull(invites.expiresAt), gt(invites.expiresAt, new Date())),
    lt(invites.uses, invites.maxUses),
  )

export function invitesRoutes(services: Services) {
  const { db, config, guard } = services

  /** The invitation behind a code, or a failure counted by the brute-force guard. */
  const findUsable = async (code: string, ip: string) => {
    const [row] = await db
      .select()
      .from(invites)
      .leftJoin(organization, eq(organization.id, invites.spaceId))
      .leftJoin(spaceSettings, eq(spaceSettings.spaceId, invites.spaceId))
      .where(and(eq(invites.codeHash, hashInviteCode(config.secret, code)), usable()))
    if (!row) {
      guard.fail(ip)
      fail(404, 'invalid_invite')
    }
    return row
  }

  return (
    new Hono<ApiEnv>()
      .get('/', async (c) => {
        const me = requireUser(c)
        const spaces = isAdmin(me) ? null : await managedSpaceIds(db, me.id)
        if (spaces && spaces.length === 0) return c.json({ invites: [] })
        const rows = await db
          .select({
            invite: invites,
            spaceName: organization.name,
            createdBy: user.name,
          })
          .from(invites)
          .leftJoin(organization, eq(organization.id, invites.spaceId))
          .leftJoin(user, eq(user.id, invites.createdById))
          .where(spaces ? inArray(invites.spaceId, spaces) : undefined)
          .orderBy(desc(invites.createdAt))
        const ids = rows.map((row) => row.invite.id)
        const used = ids.length
          ? await db
              .select({
                inviteId: inviteUses.inviteId,
                username: user.username,
                displayName: user.name,
                usedAt: inviteUses.usedAt,
              })
              .from(inviteUses)
              .innerJoin(user, eq(user.id, inviteUses.userId))
              .where(inArray(inviteUses.inviteId, ids))
          : []
        return c.json({
          invites: rows.map(({ invite, spaceName, createdBy }) => ({
            id: invite.id,
            note: invite.note,
            role: invite.role as 'user' | 'admin',
            spaceId: invite.spaceId,
            spaceName,
            spaceRole: invite.spaceRole as 'manager' | 'member' | null,
            maxUses: invite.maxUses,
            uses: invite.uses,
            expiresAt: iso(invite.expiresAt),
            createdAt: iso(invite.createdAt) ?? '',
            createdBy,
            status: inviteStatus(invite),
            usedBy: used
              .filter((entry) => entry.inviteId === invite.id)
              .map((entry) => ({
                username: entry.username ?? '',
                displayName: entry.displayName,
                usedAt: iso(entry.usedAt) ?? '',
              })),
          })),
        })
      })
      // Admins invite anyone; managers invite into the spaces they manage.
      .post('/', jsonBody(inviteInput), async (c) => {
        const me = requireUser(c)
        const input = c.req.valid('json')
        if (!isAdmin(me)) {
          if (!input.spaceId || input.role !== 'user') fail(403, 'forbidden')
          await requireMembership(db, input.spaceId, me.id, 'manager')
        } else if (input.spaceId) {
          const [space] = await db
            .select({ id: organization.id })
            .from(organization)
            .where(eq(organization.id, input.spaceId))
          if (!space) fail(404, 'not_found')
        }
        const code = randomToken()
        const id = uuidv7()
        await db.insert(invites).values({
          id,
          codeHash: hashInviteCode(config.secret, code),
          note: input.note || null,
          createdById: me.id,
          role: input.role,
          spaceId: input.spaceId ?? null,
          spaceRole: input.spaceId ? (input.spaceRole ?? 'member') : null,
          maxUses: input.maxUses,
          expiresAt: input.expiresInDays
            ? new Date(Date.now() + input.expiresInDays * DAY_MS)
            : null,
        })
        // The code is shown once: only its hash is kept.
        return c.json({ id, code }, 201)
      })
      .delete('/:inviteId', async (c) => {
        const me = requireUser(c)
        const [invite] = await db
          .select()
          .from(invites)
          .where(eq(invites.id, c.req.param('inviteId')))
        if (!invite) fail(404, 'not_found')
        if (!isAdmin(me)) {
          if (!invite.spaceId) fail(404, 'not_found')
          await requireMembership(db, invite.spaceId, me.id, 'manager')
        }
        await db
          .update(invites)
          .set({ revokedAt: invite.revokedAt ?? new Date() })
          .where(eq(invites.id, invite.id))
        return c.json({ ok: true })
      })
      // Public: what the sign-up page shows before the form.
      .post('/check', jsonBody(z.object({ code: z.string().min(1).max(100) })), async (c) => {
        const row = await findUsable(c.req.valid('json').code, c.get('clientIp'))
        return c.json({
          role: row.invites.role as 'user' | 'admin',
          space: row.organization
            ? {
                name: row.organization.name,
                kind: (row.space_settings?.kind ?? 'team') as SpaceKind,
                role: (row.invites.spaceRole ?? 'member') as 'manager' | 'member',
              }
            : null,
        })
      })
      // Public: creates the account, uses the invitation once, and signs in.
      .post('/accept', jsonBody(acceptInput), async (c) => {
        const input = c.req.valid('json')
        const ip = c.get('clientIp')
        const found = await findUsable(input.code, ip)
        await db.transaction(async (tx) => {
          const [claimed] = await tx
            .update(invites)
            .set({ uses: sql`${invites.uses} + 1` })
            .where(and(eq(invites.id, found.invites.id), usable()))
            .returning()
          if (!claimed) fail(404, 'invalid_invite')
          const userId = await createAccount(services, tx, {
            username: input.username,
            displayName: input.displayName,
            password: input.password,
            email: input.email || null,
            role: claimed.role === 'admin' ? 'admin' : 'user',
          })
          await tx.insert(inviteUses).values({ inviteId: claimed.id, userId })
          if (claimed.spaceId) {
            await tx.insert(member).values({
              id: uuidv7(),
              organizationId: claimed.spaceId,
              userId,
              role: claimed.spaceRole === 'manager' ? 'admin' : 'member',
            })
          }
        })
        // Sign in with the new credentials: Better Auth sets the session cookie. It reads the
        // address Rublox resolved, never one the client sent (SPEC § 0.10).
        const headers = new Headers(c.req.raw.headers)
        headers.set(CLIENT_IP_HEADER, c.get('clientIp'))
        const response = await services.auth.api.signInUsername({
          body: { username: input.username, password: input.password },
          headers,
          asResponse: true,
        })
        for (const cookie of response.headers.getSetCookie()) {
          c.header('Set-Cookie', cookie, { append: true })
        }
        return c.json({ ok: true as const }, 201)
      })
  )
}
