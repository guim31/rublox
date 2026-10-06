import { count, countDistinct, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { isManagerRole } from '../access.ts'
import {
  createAccount,
  displayNameSchema,
  emailSchema,
  passwordSchema,
  setPassword,
  usernameSchema,
} from '../accounts.ts'
import { realEmail } from '../auth.ts'
import {
  assets,
  member,
  organization,
  projects,
  session,
  spaceSettings,
  user,
} from '../db/schema.ts'
import { type ApiEnv, fail, iso, jsonBody, queryParams, requireAdmin } from '../http.ts'
import type { Services } from '../services.ts'
import { settingsSchema } from '../settings.ts'
import type { SpaceKind } from './me.ts'

const newUserInput = z.object({
  username: usernameSchema,
  displayName: displayNameSchema,
  password: passwordSchema,
  email: z.union([emailSchema, z.literal('')]).optional(),
  role: z.enum(['user', 'admin']).default('user'),
})

const userPatch = z.object({
  displayName: displayNameSchema.optional(),
  role: z.enum(['user', 'admin']).optional(),
  disabled: z.boolean().optional(),
})

/** Administration (SPEC § 4.13): every route requires the `admin` role. */
export function adminRoutes(services: Services) {
  const { db } = services
  return new Hono<ApiEnv>()
    .use(async (c, next) => {
      requireAdmin(c)
      await next()
    })
    .get(
      '/users',
      queryParams(z.object({ q: z.string().trim().max(100).optional() })),
      async (c) => {
        const { q } = c.req.valid('query')
        const pattern = q ? `%${q.replace(/[%_\\]/g, (char) => `\\${char}`)}%` : null
        const rows = await db
          .select()
          .from(user)
          .where(
            pattern
              ? or(
                  ilike(user.username, pattern),
                  ilike(user.name, pattern),
                  ilike(user.email, pattern),
                )
              : undefined,
          )
          .orderBy(desc(user.createdAt))
          .limit(500)
        const ids = rows.map((row) => row.id)
        const [spaces, usage, lastSeen] = ids.length
          ? await Promise.all([
              db
                .select({ userId: member.userId, name: organization.name, role: member.role })
                .from(member)
                .innerJoin(organization, eq(organization.id, member.organizationId))
                .where(inArray(member.userId, ids)),
              db
                .select({
                  ownerId: assets.ownerId,
                  bytes: sql<number>`coalesce(sum(${assets.size}), 0)`.mapWith(Number),
                })
                .from(assets)
                .where(inArray(assets.ownerId, ids))
                .groupBy(assets.ownerId),
              db
                .select({
                  userId: session.userId,
                  at: sql<Date>`max(${session.updatedAt})`.mapWith((value) => new Date(value)),
                })
                .from(session)
                .where(inArray(session.userId, ids))
                .groupBy(session.userId),
            ])
          : [[], [], []]
        return c.json({
          users: rows.map((row) => ({
            id: row.id,
            username: row.username ?? '',
            displayName: row.name,
            email: realEmail(row.email),
            avatar: row.avatar,
            role: (row.role === 'admin' ? 'admin' : 'user') as 'admin' | 'user',
            disabled: row.banned === true,
            managed: row.managedBySpaceId !== null,
            createdAt: iso(row.createdAt) ?? '',
            lastSeenAt: iso(lastSeen.find((entry) => entry.userId === row.id)?.at),
            storageBytes: usage.find((entry) => entry.ownerId === row.id)?.bytes ?? 0,
            spaces: spaces
              .filter((entry) => entry.userId === row.id)
              .map((entry) => ({ name: entry.name, manager: isManagerRole(entry.role) })),
          })),
        })
      },
    )
    .post('/users', jsonBody(newUserInput), async (c) => {
      const input = c.req.valid('json')
      const id = await createAccount(services, db, { ...input, email: input.email || null })
      return c.json({ id }, 201)
    })
    .patch('/users/:userId', jsonBody(userPatch), async (c) => {
      const me = requireAdmin(c)
      const targetId = c.req.param('userId')
      const patch = c.req.valid('json')
      // An administrator never locks themself out.
      if (targetId === me.id && (patch.disabled || patch.role === 'user')) fail(409, 'self')
      const values: Partial<typeof user.$inferInsert> = { updatedAt: new Date() }
      if (patch.displayName) values.name = patch.displayName
      if (patch.role) values.role = patch.role
      if (patch.disabled !== undefined) {
        values.banned = patch.disabled
        values.banReason = null
        values.banExpires = null
      }
      const [row] = await db.update(user).set(values).where(eq(user.id, targetId)).returning()
      if (!row) fail(404, 'not_found')
      if (patch.disabled) await db.delete(session).where(eq(session.userId, targetId))
      return c.json({ ok: true })
    })
    .post(
      '/users/:userId/password',
      jsonBody(z.object({ password: passwordSchema })),
      async (c) => {
        const targetId = c.req.param('userId')
        const [row] = await db.select({ id: user.id }).from(user).where(eq(user.id, targetId))
        if (!row) fail(404, 'not_found')
        await setPassword(services, targetId, c.req.valid('json').password)
        return c.json({ ok: true })
      },
    )
    .delete('/users/:userId', async (c) => {
      const me = requireAdmin(c)
      const targetId = c.req.param('userId')
      if (targetId === me.id) fail(409, 'self')
      const deleted = await db.delete(user).where(eq(user.id, targetId)).returning({ id: user.id })
      if (deleted.length === 0) fail(404, 'not_found')
      return c.json({ ok: true })
    })
    .get('/spaces', async (c) => {
      const rows = await db
        .select({
          id: organization.id,
          name: organization.name,
          kind: spaceSettings.kind,
          createdAt: organization.createdAt,
          members: countDistinct(member.userId),
        })
        .from(organization)
        .leftJoin(spaceSettings, eq(spaceSettings.spaceId, organization.id))
        .leftJoin(member, eq(member.organizationId, organization.id))
        .groupBy(organization.id, spaceSettings.kind)
        .orderBy(organization.name)
      const managers = rows.length
        ? await db
            .select({ spaceId: member.organizationId, name: user.name, role: member.role })
            .from(member)
            .innerJoin(user, eq(user.id, member.userId))
            .where(
              inArray(
                member.organizationId,
                rows.map((row) => row.id),
              ),
            )
        : []
      return c.json({
        spaces: rows.map((row) => ({
          id: row.id,
          name: row.name,
          kind: (row.kind ?? 'team') as SpaceKind,
          createdAt: iso(row.createdAt) ?? '',
          memberCount: row.members,
          managers: managers
            .filter((entry) => entry.spaceId === row.id && isManagerRole(entry.role))
            .map((entry) => entry.name),
        })),
      })
    })
    .get('/settings', async (c) => c.json({ settings: await services.settings.get() }))
    .patch('/settings', jsonBody(settingsSchema.partial()), async (c) =>
      c.json({ settings: await services.settings.update(c.req.valid('json')) }),
    )
    .get('/stats', async (c) => {
      const [[users], [spaces], [live], [trashed], diskBytes] = await Promise.all([
        db.select({ total: count() }).from(user),
        db.select({ total: count() }).from(organization),
        db.select({ total: count() }).from(projects).where(isNull(projects.deletedAt)),
        db.select({ total: count() }).from(projects).where(sql`${projects.deletedAt} is not null`),
        services.files.usage(),
      ])
      return c.json({
        users: users?.total ?? 0,
        spaces: spaces?.total ?? 0,
        projects: live?.total ?? 0,
        trashedProjects: trashed?.total ?? 0,
        diskBytes,
      })
    })
}
