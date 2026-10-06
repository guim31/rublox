import { and, count, desc, eq, inArray, isNull } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { isManagerRole, requireManagedAccount, requireMembership } from '../access.ts'
import {
  createAccount,
  displayNameSchema,
  passwordSchema,
  setPassword,
  usernameSchema,
} from '../accounts.ts'
import { member, organization, projects, spaceSettings, user } from '../db/schema.ts'
import { type ApiEnv, fail, iso, jsonBody, requireUser } from '../http.ts'
import { uuidv7 } from '../ids.ts'
import type { Services } from '../services.ts'
import type { SpaceKind } from './me.ts'

export const spaceKindSchema = z.enum(['family', 'class', 'team'])

const spaceInput = z.object({
  name: z.string().trim().min(1).max(60),
  kind: spaceKindSchema,
})

const spacePatch = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  kind: spaceKindSchema.optional(),
  membersCanPublish: z.boolean().optional(),
  membersCanUseAi: z.boolean().optional(),
  membersCanShareInGallery: z.boolean().optional(),
})

const memberAccountInput = z.object({
  username: usernameSchema,
  displayName: displayNameSchema,
  password: passwordSchema,
})

export function spacesRoutes(services: Services) {
  const { db } = services

  const managerCount = async (spaceId: string) => {
    const [row] = await db
      .select({ total: count() })
      .from(member)
      .where(and(eq(member.organizationId, spaceId), inArray(member.role, ['owner', 'admin'])))
    return row?.total ?? 0
  }

  return (
    new Hono<ApiEnv>()
      .get('/', async (c) => {
        const me = requireUser(c)
        const rows = await db
          .select({
            id: organization.id,
            name: organization.name,
            kind: spaceSettings.kind,
            role: member.role,
          })
          .from(member)
          .innerJoin(organization, eq(organization.id, member.organizationId))
          .leftJoin(spaceSettings, eq(spaceSettings.spaceId, organization.id))
          .where(eq(member.userId, me.id))
          .orderBy(organization.name)
        const ids = rows.map((row) => row.id)
        const counts = ids.length
          ? await db
              .select({ spaceId: member.organizationId, total: count() })
              .from(member)
              .where(inArray(member.organizationId, ids))
              .groupBy(member.organizationId)
          : []
        return c.json({
          spaces: rows.map((row) => ({
            id: row.id,
            name: row.name,
            kind: (row.kind ?? 'team') as SpaceKind,
            manager: isManagerRole(row.role),
            memberCount: counts.find((entry) => entry.spaceId === row.id)?.total ?? 0,
          })),
        })
      })
      // Any account except member accounts may create a space, and manages it.
      .post('/', jsonBody(spaceInput), async (c) => {
        const me = requireUser(c)
        if (me.managedBySpaceId) fail(403, 'managed_account')
        const input = c.req.valid('json')
        const id = uuidv7()
        await db.transaction(async (tx) => {
          await tx.insert(organization).values({ id, name: input.name, slug: id })
          await tx.insert(spaceSettings).values({
            spaceId: id,
            kind: input.kind,
            // Families publish freely; classes ask the teacher first (SPEC § 10).
            membersCanPublish: input.kind !== 'class',
          })
          await tx.insert(member).values({
            id: uuidv7(),
            organizationId: id,
            userId: me.id,
            role: 'owner',
          })
        })
        return c.json({ id }, 201)
      })
      .get('/:spaceId', async (c) => {
        const me = requireUser(c)
        const spaceId = c.req.param('spaceId')
        const mine = await requireMembership(db, spaceId, me.id, 'member')
        const manager = isManagerRole(mine.role)
        const [space] = await db
          .select()
          .from(organization)
          .leftJoin(spaceSettings, eq(spaceSettings.spaceId, organization.id))
          .where(eq(organization.id, spaceId))
        if (!space) fail(404, 'not_found')
        const members = await db
          .select({
            id: user.id,
            username: user.username,
            displayName: user.name,
            avatar: user.avatar,
            role: member.role,
            managedBySpaceId: user.managedBySpaceId,
            disabled: user.banned,
          })
          .from(member)
          .innerJoin(user, eq(user.id, member.userId))
          .where(eq(member.organizationId, spaceId))
          .orderBy(user.name)
        // Managers see the projects of the members (SPEC § 4.7).
        const memberIds = members.filter((m) => !isManagerRole(m.role)).map((m) => m.id)
        const spaceProjects =
          manager && memberIds.length > 0
            ? await db
                .select({
                  id: projects.id,
                  name: projects.name,
                  ownerId: projects.ownerId,
                  updatedAt: projects.updatedAt,
                  preview: projects.preview,
                })
                .from(projects)
                .where(and(inArray(projects.ownerId, memberIds), isNull(projects.deletedAt)))
                .orderBy(desc(projects.updatedAt))
            : []
        return c.json({
          space: {
            id: space.organization.id,
            name: space.organization.name,
            kind: (space.space_settings?.kind ?? 'team') as SpaceKind,
            membersCanPublish: space.space_settings?.membersCanPublish ?? true,
            membersCanUseAi: space.space_settings?.membersCanUseAi ?? false,
            membersCanShareInGallery: space.space_settings?.membersCanShareInGallery ?? false,
          },
          manager,
          members: members.map((m) => ({
            id: m.id,
            username: m.username ?? '',
            displayName: m.displayName,
            avatar: m.avatar,
            manager: isManagerRole(m.role),
            owner: m.role === 'owner',
            managed: m.managedBySpaceId === spaceId,
            disabled: m.disabled === true,
          })),
          projects: spaceProjects.map((p) => ({
            id: p.id,
            name: p.name,
            ownerId: p.ownerId,
            updatedAt: iso(p.updatedAt) ?? '',
            preview: p.preview as unknown,
          })),
        })
      })
      .patch('/:spaceId', jsonBody(spacePatch), async (c) => {
        const me = requireUser(c)
        const spaceId = c.req.param('spaceId')
        await requireMembership(db, spaceId, me.id, 'manager')
        const { name, kind, ...rights } = c.req.valid('json')
        if (name) await db.update(organization).set({ name }).where(eq(organization.id, spaceId))
        const settings = { ...(kind ? { kind } : {}), ...rights }
        if (Object.keys(settings).length > 0) {
          await db
            .insert(spaceSettings)
            .values({ spaceId, kind: kind ?? 'team', ...rights })
            .onConflictDoUpdate({ target: spaceSettings.spaceId, set: settings })
        }
        return c.json({ ok: true })
      })
      .delete('/:spaceId', async (c) => {
        const me = requireUser(c)
        const spaceId = c.req.param('spaceId')
        const mine = await requireMembership(db, spaceId, me.id, 'manager')
        if (mine.role !== 'owner') fail(403, 'forbidden')
        const [managed] = await db
          .select({ total: count() })
          .from(user)
          .where(eq(user.managedBySpaceId, spaceId))
        // Member accounts belong to their space: they are deleted first, explicitly.
        if ((managed?.total ?? 0) > 0) fail(409, 'space_has_accounts')
        await db.delete(organization).where(eq(organization.id, spaceId))
        return c.json({ ok: true })
      })
      // A member account: no e-mail, password chosen by the manager (SPEC § 4.7).
      .post('/:spaceId/accounts', jsonBody(memberAccountInput), async (c) => {
        const me = requireUser(c)
        const spaceId = c.req.param('spaceId')
        await requireMembership(db, spaceId, me.id, 'manager')
        const input = c.req.valid('json')
        const id = await db.transaction(async (tx) => {
          const userId = await createAccount(services, tx, {
            ...input,
            managedBySpaceId: spaceId,
            uiMode: 'junior',
            locale: me.locale === 'en' ? 'en' : 'fr',
          })
          await tx
            .insert(member)
            .values({ id: uuidv7(), organizationId: spaceId, userId, role: 'member' })
          return userId
        })
        return c.json({ id }, 201)
      })
      .post(
        '/:spaceId/accounts/:userId/password',
        jsonBody(z.object({ password: passwordSchema })),
        async (c) => {
          const me = requireUser(c)
          const target = await requireManagedAccount(
            db,
            me,
            c.req.param('spaceId'),
            c.req.param('userId'),
          )
          await setPassword(services, target.id, c.req.valid('json').password)
          return c.json({ ok: true })
        },
      )
      .delete('/:spaceId/accounts/:userId', async (c) => {
        const me = requireUser(c)
        const target = await requireManagedAccount(
          db,
          me,
          c.req.param('spaceId'),
          c.req.param('userId'),
        )
        await db.delete(user).where(eq(user.id, target.id))
        return c.json({ ok: true })
      })
      .patch(
        '/:spaceId/members/:userId',
        jsonBody(z.object({ manager: z.boolean() })),
        async (c) => {
          const me = requireUser(c)
          const spaceId = c.req.param('spaceId')
          const targetId = c.req.param('userId')
          await requireMembership(db, spaceId, me.id, 'manager')
          const target = await requireMembership(db, spaceId, targetId, 'member')
          const { manager } = c.req.valid('json')
          if (target.role === 'owner') fail(403, 'forbidden')
          if (manager) {
            const [row] = await db.select().from(user).where(eq(user.id, targetId))
            if (row?.managedBySpaceId) fail(403, 'managed_account')
          } else if (isManagerRole(target.role) && (await managerCount(spaceId)) <= 1) {
            fail(409, 'last_manager')
          }
          await db
            .update(member)
            .set({ role: manager ? 'admin' : 'member' })
            .where(eq(member.id, target.id))
          return c.json({ ok: true })
        },
      )
      // Removes someone from the space (or leaves it). Member accounts are deleted instead.
      .delete('/:spaceId/members/:userId', async (c) => {
        const me = requireUser(c)
        const spaceId = c.req.param('spaceId')
        const targetId = c.req.param('userId')
        if (targetId !== me.id) await requireMembership(db, spaceId, me.id, 'manager')
        const target = await requireMembership(db, spaceId, targetId, 'member')
        const [row] = await db.select().from(user).where(eq(user.id, targetId))
        if (row?.managedBySpaceId === spaceId) fail(409, 'managed_account')
        if (target.role === 'owner' && targetId !== me.id) fail(403, 'forbidden')
        if (isManagerRole(target.role) && (await managerCount(spaceId)) <= 1) {
          fail(409, 'last_manager')
        }
        await db.delete(member).where(eq(member.id, target.id))
        return c.json({ ok: true })
      })
  )
}
