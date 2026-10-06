import { projectDocSchema } from '@rublox/schema'
import { and, desc, eq, inArray, isNotNull, isNull, lt, ne, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { Hono } from 'hono'
import { validator } from 'hono/validator'
import * as Y from 'yjs'
import { z } from 'zod'
import { MANAGER_ROLES, type ProjectAccess, requireProject } from '../access.ts'
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
  toBase64,
} from '../http.ts'
import { uuidv7 } from '../ids.ts'
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

export const TRASH_DAYS = 30
/** An automatic snapshot at most every 10 minutes of activity (SPEC § 4.8). */
export const SNAPSHOT_INTERVAL_MS = 10 * 60 * 1000
/** Largest document accepted (base64 of the Yjs state). */
const MAX_STATE_CHARS = 30 * MB

const base64 = z
  .string()
  .max(MAX_STATE_CHARS)
  .regex(/^[A-Za-z0-9+/]*={0,2}$/)
const nameSchema = z.string().trim().min(1).max(80)

type ProjectRow = typeof projects.$inferSelect

/** One write at a time per project: syncs are read-modify-write of the Yjs state. */
const queues = new Map<string, Promise<unknown>>()
function serialize<T>(projectId: string, run: () => Promise<T>): Promise<T> {
  const previous = queues.get(projectId) ?? Promise.resolve()
  const next = previous.catch(() => {}).then(run)
  queues.set(projectId, next)
  next
    .finally(() => {
      if (queues.get(projectId) === next) queues.delete(projectId)
    })
    .catch(() => {})
  return next
}

async function loadState(db: Database, projectId: string): Promise<Y.Doc> {
  const [row] = await db
    .select({ state: projectDocs.state })
    .from(projectDocs)
    .where(eq(projectDocs.projectId, projectId))
  if (!row) fail(404, 'not_found')
  return loadYDoc(row.state)
}

/** Stores the document and refreshes the dashboard fields of the project. */
async function saveState(db: Database, projectId: string, ydoc: Y.Doc) {
  const doc = readProject(ydoc)
  if (!doc) fail(400, 'invalid_project')
  const now = new Date()
  await db
    .insert(projectDocs)
    .values({ projectId, state: encodeState(ydoc), json: doc, updatedAt: now })
    .onConflictDoUpdate({
      target: projectDocs.projectId,
      set: { state: encodeState(ydoc), json: doc, updatedAt: now },
    })
  await db
    .update(projects)
    .set({
      name: doc.meta.name.slice(0, 80) || '…',
      description: doc.meta.description ?? null,
      preview: previewOf(doc),
      updatedAt: now,
    })
    .where(eq(projects.id, projectId))
  return doc
}

async function snapshot(
  db: Database,
  projectId: string,
  json: unknown,
  createdById: string,
  name: string | null,
) {
  await db.insert(projectVersions).values({ id: uuidv7(), projectId, name, json, createdById })
}

/** Takes an automatic snapshot unless one is less than 10 minutes old. */
async function autoSnapshot(db: Database, projectId: string, json: unknown, userId: string) {
  const [last] = await db
    .select({ createdAt: projectVersions.createdAt })
    .from(projectVersions)
    .where(eq(projectVersions.projectId, projectId))
    .orderBy(desc(projectVersions.createdAt))
    .limit(1)
  if (!last || Date.now() - last.createdAt.getTime() >= SNAPSHOT_INTERVAL_MS) {
    await snapshot(db, projectId, json, userId, null)
  }
}

/** Creates a project from a document state (new project, import, duplicate). */
async function insertProject(
  db: Database,
  owner: SessionUser,
  ydoc: Y.Doc,
  options: { keepDates: boolean; name?: string },
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
      createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
      updatedAt: new Date(),
    })
    await tx.insert(projectDocs).values({ projectId: id, state: encodeState(ydoc), json: final })
  })
  return id
}

export function projectsRoutes(services: Services) {
  const { db } = services

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
      .get('/:projectId', async (c) => {
        const me = requireUser(c)
        const { project, access } = await requireProject(
          db,
          me.id,
          c.req.param('projectId'),
          'read',
        )
        const ydoc = await loadState(db, project.id)
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
          access,
          deletedAt: iso(project.deletedAt),
          owner: owner ?? null,
          state: toBase64(encodeState(ydoc)),
        })
      })
      // Two-way Yjs sync over HTTP: the studio sends what the server may lack (relative to the
      // last state vector it got) and its own state vector; the server merges, stores, and
      // answers with what the studio lacks. Yjs updates are idempotent, so a retry is harmless.
      .post(
        '/:projectId/sync',
        jsonBody(z.object({ update: base64, stateVector: base64 })),
        async (c) => {
          const me = requireUser(c)
          const projectId = c.req.param('projectId')
          const { update, stateVector } = c.req.valid('json')
          const found = await requireProject(db, me.id, projectId, 'read')
          const answer = await serialize(projectId, async () => {
            const ydoc = await loadState(db, projectId)
            const before = Y.encodeStateVector(ydoc)
            const bytes = fromBase64(update)
            if (bytes.length > 2) {
              if (found.access !== 'owner' && found.access !== 'editor') fail(403, 'forbidden')
              try {
                Y.applyUpdate(ydoc, bytes)
              } catch {
                fail(400, 'invalid_project')
              }
            }
            if (!sameBytes(before, Y.encodeStateVector(ydoc))) {
              // The id belongs to the server, whatever the client wrote.
              if (ydoc.getMap('meta').get('id') !== projectId) writeMeta(ydoc, { id: projectId })
              const doc = await saveState(db, projectId, ydoc)
              await autoSnapshot(db, projectId, doc, me.id)
            }
            try {
              return Y.encodeStateAsUpdate(ydoc, fromBase64(stateVector))
            } catch {
              return Y.encodeStateAsUpdate(ydoc)
            }
          })
          return c.json({ update: toBase64(answer) })
        },
      )
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
            await serialize(found.project.id, async () => {
              const ydoc = await loadState(db, projectId)
              writeMeta(ydoc, {
                name: patch.name,
                description: patch.description,
                updatedAt: new Date().toISOString(),
              })
              await saveState(db, projectId, ydoc)
            })
          }
          return c.json({ ok: true })
        },
      )
      .post('/:projectId/duplicate', jsonBody(z.object({ name: nameSchema })), async (c) => {
        const me = requireUser(c)
        const { project } = await requireProject(db, me.id, c.req.param('projectId'), 'read')
        const source = readProject(await loadState(db, project.id))
        if (!source) fail(400, 'invalid_project')
        const now = new Date().toISOString()
        const ydoc = copyDoc(source, { id: 'pending', name: c.req.valid('json').name, now })
        const id = await insertProject(db, me, ydoc, { keepDates: true })
        await copyAssetRows(db, project.id, id, me.id)
        return c.json({ id }, 201)
      })
      .post('/:projectId/trash', async (c) => {
        const me = requireUser(c)
        const { project } = await requireProject(db, me.id, c.req.param('projectId'), 'owner')
        await db.update(projects).set({ deletedAt: new Date() }).where(eq(projects.id, project.id))
        return c.json({ ok: true })
      })
      .post('/:projectId/restore', async (c) => {
        const me = requireUser(c)
        const { project } = await requireProject(db, me.id, c.req.param('projectId'), 'owner')
        await db.update(projects).set({ deletedAt: null }).where(eq(projects.id, project.id))
        return c.json({ ok: true })
      })
      .delete('/:projectId', async (c) => {
        const me = requireUser(c)
        const { project } = await requireProject(db, me.id, c.req.param('projectId'), 'owner')
        await db.delete(projects).where(eq(projects.id, project.id))
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
        return c.json({ ok: true })
      })
      // Gives the project to one of its members; the former owner becomes an editor.
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
            .set({ ownerId: userId, spaceId: target.managedBySpaceId ?? null })
            .where(eq(projects.id, project.id))
          await tx.update(assets).set({ ownerId: userId }).where(eq(assets.projectId, project.id))
        })
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
          const doc = readProject(await loadState(db, project.id))
          if (!doc) fail(400, 'invalid_project')
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
        await serialize(project.id, async () => {
          const ydoc = await loadState(db, project.id)
          const current = readProject(ydoc)
          const parsed = projectDocSchema.safeParse(row.json)
          const target = parsed.success ? parsed.data : null
          if (!target) fail(400, 'invalid_project')
          if (current) await snapshot(db, project.id, current, me.id, null)
          replaceContent(ydoc, target, new Date().toISOString())
          await saveState(db, project.id, ydoc)
        })
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

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, i) => byte === b[i])
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

async function copyAssetRows(db: Database, fromId: string, toId: string, ownerId: string) {
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
  const removedFiles = await services.files.prune((hash) => used.has(hash))
  return { projects: purged.length, files: removedFiles }
}
