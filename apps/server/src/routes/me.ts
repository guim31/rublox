import { and, eq, ne } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { isManagerRole } from '../access.ts'
import { displayNameSchema, emailSchema } from '../accounts.ts'
import { placeholderEmail, realEmail } from '../auth.ts'
import { account, member, organization, spaceSettings, user } from '../db/schema.ts'
import { type ApiEnv, fail, isAdmin, jsonBody, requireUser, type SessionUser } from '../http.ts'
import { deleteAccount, exportAccount } from '../privacy.ts'
import type { Services } from '../services.ts'
import { mayShareInGallery } from './gallery.ts'

export const AVATAR_PATTERN = /^[a-z0-9-]{1,32}$/

/** The profile the studio reads (SPEC § 4.7). */
export function profileOf(row: SessionUser | typeof user.$inferSelect) {
  return {
    id: row.id,
    username: row.username ?? '',
    displayName: row.name,
    email: realEmail(row.email),
    avatar: row.avatar ?? null,
    locale: oneOf(row.locale, ['fr', 'en'] as const),
    uiMode: oneOf(row.uiMode, ['junior', 'studio'] as const),
    theme: oneOf(row.theme, ['light', 'dark', 'system'] as const),
    role: (row.role === 'admin' ? 'admin' : 'user') as 'admin' | 'user',
    isAdmin: isAdmin({ role: row.role ?? null, banned: row.banned ?? null }),
    managedBySpaceId: row.managedBySpaceId ?? null,
  }
}

export type Profile = ReturnType<typeof profileOf>

function oneOf<const T extends string>(value: string | null | undefined, allowed: readonly T[]) {
  return (allowed as readonly string[]).includes(value ?? '') ? (value as T) : null
}

const profilePatch = z.object({
  displayName: displayNameSchema.optional(),
  avatar: z.string().regex(AVATAR_PATTERN).nullable().optional(),
  locale: z.enum(['fr', 'en']).optional(),
  uiMode: z.enum(['junior', 'studio']).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  /** An empty string removes the address. Not for member accounts (they have none). */
  email: z.union([emailSchema, z.literal('')]).optional(),
})

export function meRoutes(services: Services) {
  const { db } = services
  return (
    new Hono<ApiEnv>()
      .get('/', async (c) => {
        // Never 401: "signed out" is an ordinary answer here (SPEC § 6.9).
        const session = c.get('session')
        if (!session) return c.json({ user: null, spaces: [] })
        const spaces = await db
          .select({
            id: organization.id,
            name: organization.name,
            kind: spaceSettings.kind,
            role: member.role,
          })
          .from(member)
          .innerJoin(organization, eq(organization.id, member.organizationId))
          .leftJoin(spaceSettings, eq(spaceSettings.spaceId, organization.id))
          .where(eq(member.userId, session.user.id))
          .orderBy(organization.name)
        const settings = await services.settings.get()
        return c.json({
          user: profileOf(session.user),
          spaces: spaces.map((space) => ({
            id: space.id,
            name: space.name,
            kind: (space.kind ?? 'team') as SpaceKind,
            manager: isManagerRole(space.role),
          })),
          instance: { name: settings.instanceName, maxUploadMb: settings.maxUploadMb },
          features: {
            gallery: settings.galleryEnabled,
            galleryShare: settings.galleryEnabled && (await mayShareInGallery(db, session.user.id)),
            // Absent without `ANTHROPIC_API_KEY`: the studio shows no trace of the assistant.
            ai: services.ai ? await services.ai.status(session.user.id) : null,
          },
        })
      })
      // RGPD (SPEC § 4.7): everything about the account, as a JSON file.
      .get('/export', async (c) => {
        const me = requireUser(c)
        const data = await exportAccount(services, me.id)
        c.header(
          'Content-Disposition',
          `attachment; filename="rublox-${me.username ?? me.id}.json"`,
        )
        return c.json(data)
      })
      // Deleting one's own account asks for the password again. Member accounts are deleted by
      // their manager.
      .delete('/', jsonBody(z.object({ password: z.string().min(1).max(256) })), async (c) => {
        const me = requireUser(c)
        if (me.managedBySpaceId) fail(403, 'managed_account')
        const ip = c.get('clientIp')
        const wait = services.guard.retryAfter(ip)
        if (wait > 0) {
          c.header('Retry-After', String(wait))
          fail(429, 'too_many_attempts')
        }
        const [credential] = await db
          .select({ hash: account.password })
          .from(account)
          .where(and(eq(account.userId, me.id), eq(account.providerId, 'credential')))
        const context = await services.auth.$context
        const valid = credential?.hash
          ? await context.password.verify({
              hash: credential.hash,
              password: c.req.valid('json').password,
            })
          : false
        if (!valid) {
          services.guard.fail(ip)
          fail(400, 'wrong_password')
        }
        await deleteAccount(services, me.id)
        return c.json({ ok: true })
      })
      .patch('/', jsonBody(profilePatch), async (c) => {
        const me = requireUser(c)
        const patch = c.req.valid('json')
        const values: Partial<typeof user.$inferInsert> = { updatedAt: new Date() }
        if (patch.displayName !== undefined) values.name = patch.displayName
        if (patch.avatar !== undefined) values.avatar = patch.avatar
        if (patch.locale !== undefined) values.locale = patch.locale
        if (patch.uiMode !== undefined) values.uiMode = patch.uiMode
        if (patch.theme !== undefined) values.theme = patch.theme
        if (patch.email !== undefined) {
          if (me.managedBySpaceId) fail(403, 'managed_account')
          if (patch.email) {
            const [taken] = await db
              .select({ id: user.id })
              .from(user)
              .where(and(eq(user.email, patch.email), ne(user.id, me.id)))
            if (taken) fail(409, 'email_taken')
            values.email = patch.email
          } else {
            values.email = placeholderEmail()
          }
          values.emailVerified = false
        }
        const [row] = await db.update(user).set(values).where(eq(user.id, me.id)).returning()
        if (!row) fail(404, 'not_found')
        return c.json({ user: profileOf(row) })
      })
  )
}

export type SpaceKind = 'family' | 'class' | 'team'
