import { projectDocSchema } from '@rublox/schema'
import { and, desc, eq, inArray, isNotNull, isNull, lt, ne, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { Hono } from 'hono'
import { validator } from 'hono/validator'
import type * as Y from 'yjs'
import { z } from 'zod'
import { inGallery, MANAGER_ROLES, type ProjectAccess, requireProject } from '../access.ts'
import type { Database } from '../db/index.ts'
import {
  assets,
  member,
  projectDocs,
  projectFavorites,
  projectMembers,
  projects,
  projectVersions,
  user,
} from '../db/schema.ts'
import { sha256 } from '../files.ts'
import {
  type ApiEnv,
  fail,
  fromBase64,
  iso,
  jsonBody,
  requireUser,
  type SessionUser,
} from '../http.ts'
import { uuidv7 } from '../ids.ts'
import { snapshot } from '../projects/store.ts'
import {
  copyDoc,
  encodeState,
  loadYDoc,
  type ProjectPreview,
  previewOf,
  readProject,
  replaceContent,
  writeMeta,
} from '../projects/ydoc.ts'
import type { Services } from '../services.ts'
import { MB } from '../settings.ts'
import { sniff } from '../sniff.ts'
import { publishedIconFiles } from './publish.ts'

export const TRASH_DAYS = 30
export { SNAPSHOT_INTERVAL_MS } from '../projects/store.ts'

/** Largest document accepted (base64 of the Yjs state). */
const MAX_STATE_CHARS = 30 * MB

const base64 = z
  .string()
  .max(MAX_STATE_CHARS)
  .regex(/^[A-Za-z0-9+/]*={0,2}$/)
const nameSchema = z.string().trim().min(1).max(80)

type ProjectRow = typeof projects.$inferSelect

/** "Remix of X by Y" (J6), kept on the copy. */
export type RemixOf = { id: string; name: string; owner: string }

/** Creates a project from a document state (new project, import, duplicate, remix). */
export async function insertProject(
  db: Database,
  owner: SessionUser,
  ydoc: Y.Doc,
  options: { keepDates: boolean; name?: string; remixOf?: RemixOf },
) {
  const doc = readProject(ydoc)
  if (!doc) fail(400, 'invalid_project')
  const id = uuidv7()
  const now = new Date().toISOString()
  writeMeta(ydoc, {
    id,
    name: (options.name ?? doc.meta.name).slice(0, 80) || '…',
    ...(options.keepDates ? {} : { createdAt: now, updatedAt: now }),
  })
  const final = readProject(ydoc)
  if (!final) fail(400, 'invalid_project')
  const createdAt = new Date(final.meta.createdAt)
  await db.transaction(async (tx) => {
    await tx.insert(projects).values({
      id,
      ownerId: owner.id,
      spaceId: owner.managedBySpaceId ?? null,
      name: final.meta.name,
      description: final.meta.description ?? null,
      preview: previewOf(final),
      uiMode: final.meta.mode,
      ...(options.remixOf ? { remixOfId: options.remixOf.id, remixOf: options.remixOf } : {}),
      createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
      updatedAt: new Date(),
    })
    await tx.insert(projectDocs).values({ projectId: id, state: encodeState(ydoc), json: final })
  })
  return id
}

export function projectsRoutes(services: Services) {
  const { db, collab } = services

  /** The validated current document of a project (the live one when it is open). */
  const currentDoc = async (projectId: string) => {
    const ydoc = await collab.read(projectId)
    const doc = ydoc && readProject(ydoc)
    if (!doc) fail(400, 'invalid_project')
    return doc
  }

  const summaries = async (me: SessionUser) => {
    const owner = alias(user, 'owner')
    const columns = {
      project: projects,
      owner: {
        id: owner.id,
        displayName: owner.name,
        username: owner.username,
        avatar: owner.avatar,
      },
    }
    const owned = await db
      .select({ ...columns, role: sql<string>`'owner'` })
      .from(projects)
      .innerJoin(owner, eq(owner.id, projects.ownerId))
      .where(eq(projects.ownerId, me.id))
    const shared = await db
      .select({ ...columns, role: projectMembers.role })
      .from(projectMembers)
      .innerJoin(projects, eq(projects.id, projectMembers.projectId))
      .innerJoin(owner, eq(owner.id, projects.ownerId))
      .where(and(eq(projectMembers.userId, me.id), isNull(projects.deletedAt)))
    // Projects of the members of the spaces I manage (read-only).
    const ownerMembership = alias(member, 'owner_membership')
    const myMembership = alias(member, 'my_membership')
    const managed = await db
      .selectDistinctOn([projects.id], {
        ...columns,
        role: sql<string>`'manager'`,
        viaSpaceId: myMembership.organizationId,
      })
      .from(projects)
      .innerJoin(owner, eq(owner.id, projects.ownerId))
      .innerJoin(
        ownerMembership,
        and(eq(ownerMembership.userId, projects.ownerId), eq(ownerMembership.role, 'member')),
      )
      .innerJoin(
        myMembership,
        and(
          eq(myMembership.organizationId, ownerMembership.organizationId),
          eq(myMembership.userId, me.id),
          inArray(myMembership.role, [...MANAGER_ROLES]),
        ),
      )
      .where(and(isNull(projects.deletedAt), ne(projects.ownerId, me.id)))
    const favorites = new Set(
      (
        await db
          .select({ projectId: projectFavorites.projectId })
          .from(projectFavorites)
          .where(eq(projectFavorites.userId, me.id))
      ).map((row) => row.projectId),
    )
    const seen = new Set<string>()
    const all = [
      ...owned,
      ...shared,
      ...managed.map((row) => ({ ...row, spaceId: row.viaSpaceId })),
    ]
    return all
      .filter((row) => !seen.has(row.project.id) && seen.add(row.project.id))
      .map((row) => summaryOf(row.project, row.role as ProjectAccess, row.owner, favorites))
  }

  return (
    new Hono<ApiEnv>()
      .get('/', async (c) => {
        const me = requireUser(c)
        return c.json({ projects: await summaries(me) })
      })
      // A new project, or a guest project brought into the account (`import`): the studio
      // builds the document, the server validates it and gives it its id.
      .post(
        '/',
        jsonBody(
          z.object({
            state: base64,
            import: z.boolean().default(false),
            favorite: z.boolean().default(false),
          }),
        ),
        async (c) => {
          const me = requireUser(c)
          const input = c.req.valid('json')
          let ydoc: Y.Doc
          try {
            ydoc = loadYDoc(fromBase64(input.state))
          } catch {
            fail(400, 'invalid_project')
          }
          const id = await insertProject(db, me, ydoc, { keepDates: input.import })
          if (input.favorite) {
            await db.insert(projectFavorites).values({ userId: me.id, projectId: id })
          }
          return c.json({ id }, 201)
        },
      )
      // What the editor needs before opening the document on `/ws/collab`.
      .get('/:projectId', async (c) => {
        const me = requireUser(c)
        const { project, access } = await requireProject(
          db,
          me.id,
          c.req.param('projectId'),
          'view',
        )
        const [owner] = await db
          .select({
            id: user.id,
            displayName: user.name,
            username: user.username,
            avatar: user.avatar,
          })
          .from(user)
          .where(eq(user.id, project.ownerId))
        return c.json({
          id: project.id,
          name: project.name,
          access,
          deletedAt: iso(project.deletedAt),
          owner: owner ?? null,
          remixOf: (project.remixOf ?? null) as RemixOf | null,
          inGallery: inGallery(project),
        })
      })
      .patch(
        '/:projectId',
        jsonBody(
          z.object({
            name: nameSchema.optional(),
            description: z.string().max(500).optional(),
            favorite: z.boolean().optional(),
          }),
        ),
        async (c) => {
          const me = requireUser(c)
          const projectId = c.req.param('projectId')
          const patch = c.req.valid('json')
          const found = await requireProject(
            db,
            me.id,
            projectId,
            patch.name !== undefined || patch.description !== undefined ? 'write' : 'read',
          )
          if (patch.favorite === true) {
            await db
              .insert(projectFavorites)
              .values({ userId: me.id, projectId })
              .onConflictDoNothing()
          } else if (patch.favorite === false) {
            await db
              .delete(projectFavorites)
              .where(
                and(eq(projectFavorites.userId, me.id), eq(projectFavorites.projectId, projectId)),
              )
          }
          if (patch.name !== undefined || patch.description !== undefined) {
            await collab.edit(found.project.id, me.id, (ydoc) =>
              writeMeta(ydoc, {
                name: patch.name,
                description: patch.description,
                updatedAt: new Date().toISOString(),
              }),
            )
          }
          return c.json({ ok: true })
        },
      )
      .post('/:projectId/duplicate', jsonBody(z.object({ name: nameSchema })), async (c) => {
        const me = requireUser(c)
        const { project, access } = await requireProject(
          db,
          me.id,
          c.req.param('projectId'),
          'view',
        )
        const source = await currentDoc(project.id)
        const now = new Date().toISOString()
        const ydoc = copyDoc(source, { id: 'pending', name: c.req.valid('json').name, now })
        // A copy of someone else's gallery project is a remix: it keeps the credit.
        const id = await insertProject(db, me, ydoc, {
          keepDates: true,
          remixOf: access === 'gallery' ? await remixCredit(db, project) : undefined,
        })
        await copyAssetRows(db, project.id, id, me.id)
        return c.json({ id }, 201)
      })
      .post('/:projectId/trash', async (c) => {
        const me = requireUser(c)
        const { project } = await requireProject(db, me.id, c.req.param('projectId'), 'owner')
        await db.update(projects).set({ deletedAt: new Date() }).where(eq(projects.id, project.id))
        collab.reconnect(project.id)
        return c.json({ ok: true })
      })
      .post('/:projectId/restore', async (c) => {
        const me = requireUser(c)
        const { project } = await requireProject(db, me.id, c.req.param('projectId'), 'owner')
        await db.update(projects).set({ deletedAt: null }).where(eq(projects.id, project.id))
        collab.reconnect(project.id)
        return c.json({ ok: true })
      })
      .delete('/:projectId', async (c) => {
        const me = requireUser(c)
        const { project } = await requireProject(db, me.id, c.req.param('projectId'), 'owner')
        await db.delete(projects).where(eq(projects.id, project.id))
        collab.reconnect(project.id)
        return c.json({ ok: true })
      })
      // ---- Sharing (SPEC § 4.8) --------------------------------------------------------------
      .get('/:projectId/members', async (c) => {
        const me = requireUser(c)
        const { project } = await requireProject(db, me.id, c.req.param('projectId'), 'read')
        const rows = await db
          .select({
            id: user.id,
            username: user.username,
            displayName: user.name,
            avatar: user.avatar,
            role: projectMembers.role,
          })
          .from(projectMembers)
          .innerJoin(user, eq(user.id, projectMembers.userId))
          .where(eq(projectMembers.projectId, project.id))
          .orderBy(user.name)
        return c.json({
          members: rows.map((row) => ({
            ...row,
            username: row.username ?? '',
            role: row.role as 'editor' | 'viewer',
          })),
        })
      })
      .put(
        '/:projectId/members',
        jsonBody(
          z.object({
            username: z.string().trim().toLowerCase().min(1).max(64),
            role: z.enum(['editor', 'viewer']),
          }),
        ),
        async (c) => {
          const me = requireUser(c)
          const { project } = await requireProject(db, me.id, c.req.param('projectId'), 'owner')
          const input = c.req.valid('json')
          const [target] = await db
            .select({ id: user.id })
            .from(user)
            .where(eq(user.username, input.username))
          if (!target) fail(404, 'not_found')
          if (target.id === me.id) fail(409, 'self')
          await db
            .insert(projectMembers)
            .values({ projectId: project.id, userId: target.id, role: input.role })
            .onConflictDoUpdate({
              target: [projectMembers.projectId, projectMembers.userId],
              set: { role: input.role },
            })
          collab.reconnect(project.id)
          return c.json({ ok: true })
        },
      )
      .delete('/:projectId/members/:userId', async (c) => {
        const me = requireUser(c)
        const targetId = c.req.param('userId')
        // The owner removes anyone; a member may leave.
        await requireProject(
          db,
          me.id,
          c.req.param('projectId'),
          targetId === me.id ? 'read' : 'owner',
        )
        await db
          .delete(projectMembers)
          .where(
            and(
              eq(projectMembers.projectId, c.req.param('projectId')),
              eq(projectMembers.userId, targetId),
            ),
          )
        collab.reconnect(c.req.param('projectId'))
        return c.json({ ok: true })
      })
      // Gives the project to one of its members; the former owner becomes an editor. The AI of
      // the published app and the gallery sharing are switched off (SPEC § 0.10).
      .post('/:projectId/owner', jsonBody(z.object({ userId: z.string() })), async (c) => {
        const me = requireUser(c)
        const { project } = await requireProject(db, me.id, c.req.param('projectId'), 'owner')
        const { userId } = c.req.valid('json')
        const [target] = await db
          .select({ role: projectMembers.role, managedBySpaceId: user.managedBySpaceId })
          .from(projectMembers)
          .innerJoin(user, eq(user.id, projectMembers.userId))
          .where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, userId)))
        if (!target) fail(404, 'not_found')
        await db.transaction(async (tx) => {
          await tx
            .delete(projectMembers)
            .where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, userId)))
          await tx
            .insert(projectMembers)
            .values({ projectId: project.id, userId: me.id, role: 'editor' })
            .onConflictDoNothing()
          await tx
            .update(projects)
            // What the former owner chose is not the new owner's choice: the AI of the published
            // app would be billed to them, and the gallery would show their project.
            .set({
              ownerId: userId,
              spaceId: target.managedBySpaceId ?? null,
              appAiAllowed: false,
              visibility: 'private',
            })
            .where(eq(projects.id, project.id))
          await tx.update(assets).set({ ownerId: userId }).where(eq(assets.projectId, project.id))
        })
        collab.reconnect(project.id)
        return c.json({ ok: true })
      })
      // ---- Versions (SPEC § 4.8) -------------------------------------------------------------
      .get('/:projectId/versions', async (c) => {
        const me = requireUser(c)
        const { project } = await requireProject(db, me.id, c.req.param('projectId'), 'read')
        const rows = await db
          .select({
            id: projectVersions.id,
            name: projectVersions.name,
            createdAt: projectVersions.createdAt,
            author: user.name,
          })
          .from(projectVersions)
          .leftJoin(user, eq(user.id, projectVersions.createdById))
          .where(eq(projectVersions.projectId, project.id))
          .orderBy(desc(projectVersions.createdAt))
          .limit(200)
        return c.json({
          versions: rows.map((row) => ({
            id: row.id,
            name: row.name,
            createdAt: iso(row.createdAt) ?? '',
            author: row.author,
          })),
        })
      })
      .post(
        '/:projectId/versions',
        jsonBody(z.object({ name: z.string().trim().min(1).max(80) })),
        async (c) => {
          const me = requireUser(c)
          const { project } = await requireProject(db, me.id, c.req.param('projectId'), 'write')
          const doc = await currentDoc(project.id)
          await snapshot(db, project.id, doc, me.id, c.req.valid('json').name)
          return c.json({ ok: true }, 201)
        },
      )
      .get('/:projectId/versions/:versionId', async (c) => {
        const me = requireUser(c)
        const { project } = await requireProject(db, me.id, c.req.param('projectId'), 'read')
        const [row] = await db
          .select()
          .from(projectVersions)
          .where(
            and(
              eq(projectVersions.projectId, project.id),
              eq(projectVersions.id, c.req.param('versionId')),
            ),
          )
        if (!row) fail(404, 'not_found')
        const doc = row.json as Parameters<typeof previewOf>[0]
        return c.json({
          id: row.id,
          name: row.name,
          preview: previewOf(doc) as ProjectPreview | null,
        })
      })
      // Restoring never destroys: the current state is kept as a version first.
      .post('/:projectId/versions/:versionId/restore', async (c) => {
        const me = requireUser(c)
        const { project } = await requireProject(db, me.id, c.req.param('projectId'), 'write')
        const [row] = await db
          .select()
          .from(projectVersions)
          .where(
            and(
              eq(projectVersions.projectId, project.id),
              eq(projectVersions.id, c.req.param('versionId')),
            ),
          )
        if (!row) fail(404, 'not_found')
        const parsed = projectDocSchema.safeParse(row.json)
        if (!parsed.success) fail(400, 'invalid_project')
        const current = await currentDoc(project.id)
        await snapshot(db, project.id, current, me.id, null)
        await collab.edit(project.id, me.id, (ydoc) =>
          replaceContent(ydoc, parsed.data, new Date().toISOString()),
        )
        return c.json({ ok: true })
      })
      // ---- Assets (SPEC § 4.1, § 6.9) --------------------------------------------------------
      .post(
        '/:projectId/assets',
        validator('form', (value) => {
          const file = value.file
          if (!(file instanceof File)) fail(400, 'invalid')
          return { file }
        }),
        async (c) => {
          const me = requireUser(c)
          const { project } = await requireProject(db, me.id, c.req.param('projectId'), 'write')
          const settings = await services.settings.get()
          const maxBytes = Math.round(settings.maxUploadMb * MB)
          const { file } = c.req.valid('form')
          if (file.size > maxBytes) fail(413, 'too_large')
          const bytes = new Uint8Array(await file.arrayBuffer())
          const type = sniff(bytes)
          if (!type) fail(415, 'unsupported_type')
          const hash = sha256(bytes)
          const ownerId = project.ownerId
          const [already] = await db
            .select({ id: assets.id })
            .from(assets)
            .where(and(eq(assets.ownerId, ownerId), eq(assets.sha256, hash)))
            .limit(1)
          if (!already) {
            const used = await storageUsed(db, ownerId)
            if (used + bytes.length > settings.storageQuotaMb * MB) fail(413, 'quota_exceeded')
          }
          await services.files.put(hash, bytes)
          await db
            .insert(assets)
            .values({
              id: uuidv7(),
              ownerId,
              projectId: project.id,
              sha256: hash,
              kind: type.kind,
              mime: type.mime,
              size: bytes.length,
            })
            .onConflictDoNothing()
          return c.json(
            {
              name: (file.name || 'file').slice(0, 120),
              kind: type.kind,
              mime: type.mime,
              size: bytes.length,
              sha256: hash,
            },
            201,
          )
        },
      )
      .get('/:projectId/storage', async (c) => {
        const me = requireUser(c)
        const { project } = await requireProject(db, me.id, c.req.param('projectId'), 'read')
        const settings = await services.settings.get()
        return c.json({
          usedBytes: await storageUsed(db, project.ownerId),
          quotaBytes: Math.round(settings.storageQuotaMb * MB),
          maxUploadBytes: Math.round(settings.maxUploadMb * MB),
        })
      })
  )
}

/** The credit a remix keeps: the original's name and its owner's display name. */
export async function remixCredit(
  db: Database,
  project: { id: string; name: string; ownerId: string },
): Promise<RemixOf> {
  const [owner] = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, project.ownerId))
  return { id: project.id, name: project.name, owner: owner?.name ?? '' }
}

/** Bytes an account uses: each distinct file counted once. */
export async function storageUsed(db: Database, ownerId: string): Promise<number> {
  const result = await db.execute<{ total: string | number | null }>(
    sql`select coalesce(sum(size), 0) as total from (select distinct on (${assets.sha256}) ${assets.size} as size from ${assets} where ${assets.ownerId} = ${ownerId}) files`,
  )
  const rows = (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as {
    total: string | number | null
  }[]
  return Number(rows[0]?.total ?? 0)
}

export async function copyAssetRows(db: Database, fromId: string, toId: string, ownerId: string) {
  const rows = await db.select().from(assets).where(eq(assets.projectId, fromId))
  for (const row of rows) {
    await db
      .insert(assets)
      .values({ ...row, id: uuidv7(), projectId: toId, ownerId, createdAt: new Date() })
      .onConflictDoNothing()
  }
}

type OwnerInfo = { id: string; displayName: string; username: string | null; avatar: string | null }

export function summaryOf(
  project: ProjectRow & { spaceId: string | null },
  access: ProjectAccess,
  owner: OwnerInfo,
  favorites: Set<string>,
) {
  return {
    id: project.id,
    name: project.name,
    description: project.description ?? undefined,
    createdAt: iso(project.createdAt) ?? '',
    updatedAt: iso(project.updatedAt) ?? '',
    deletedAt: iso(project.deletedAt),
    favorite: favorites.has(project.id),
    preview: (project.preview ?? null) as ProjectPreview | null,
    access,
    owner: { ...owner, username: owner.username ?? '' },
    spaceId: project.spaceId,
    /** "Remix of X by Y" (J6). */
    remixOf: (project.remixOf ?? null) as RemixOf | null,
  }
}

export type ProjectSummaryDto = ReturnType<typeof summaryOf>

/** Empties the trash (30 days) and removes the files no project uses any more. */
export async function purgeTrash(services: Services, now = Date.now()) {
  const limit = new Date(now - TRASH_DAYS * 24 * 3600 * 1000)
  const purged = await services.db
    .delete(projects)
    .where(and(isNotNull(projects.deletedAt), lt(projects.deletedAt, limit)))
    .returning({ id: projects.id })
  const used = new Set(
    (await services.db.selectDistinct({ sha256: assets.sha256 }).from(assets)).map(
      (row) => row.sha256,
    ),
  )
  for (const hash of await publishedIconFiles(services.db)) used.add(hash)
  const removedFiles = await services.files.prune((hash) => used.has(hash))
  return { projects: purged.length, files: removedFiles }
}
