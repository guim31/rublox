import { and, count, desc, eq, ilike, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { inGallery, requireProject } from '../access.ts'
import type { Database } from '../db/index.ts'
import { likes, member, projects, publications, spaceSettings, user } from '../db/schema.ts'
import {
  type ApiEnv,
  fail,
  iso,
  jsonBody,
  queryParams,
  requireAdmin,
  requireUser,
} from '../http.ts'
import { copyDoc, type ProjectPreview, readProject } from '../projects/ydoc.ts'
import type { Services } from '../services.ts'
import { copyAssetRows, insertProject, type RemixOf, remixCredit } from './projects.ts'

/**
 * Whether `userId` may share in the gallery: refused when one of the spaces where they are a
 * plain member did not allow it (`membersCanShareInGallery`, off by default, SPEC § 4.11).
 */
export async function mayShareInGallery(db: Database, userId: string): Promise<boolean> {
  const [blocked] = await db
    .select({ spaceId: member.organizationId })
    .from(member)
    .innerJoin(spaceSettings, eq(spaceSettings.spaceId, member.organizationId))
    .where(
      and(
        eq(member.userId, userId),
        eq(member.role, 'member'),
        eq(spaceSettings.membersCanShareInGallery, false),
      ),
    )
    .limit(1)
  return !blocked
}

/** Most remixes and likes the tree of remixes shows below a project. */
const TREE_LIMIT = 200

type Row = {
  project: typeof projects.$inferSelect
  owner: { displayName: string; username: string | null; avatar: string | null }
  slug: string | null
}

/** A gallery card (SPEC § 4.11). */
function entryOf(
  row: Row,
  counts: { likes: Map<string, number>; remixes: Map<string, number>; liked: Set<string> },
  me: string,
) {
  const { project } = row
  return {
    id: project.id,
    name: project.name,
    description: project.description ?? undefined,
    preview: (project.preview ?? null) as ProjectPreview | null,
    mode: (project.uiMode === 'studio' ? 'studio' : 'junior') as 'junior' | 'studio',
    sharedAt: iso(project.sharedAt) ?? '',
    updatedAt: iso(project.updatedAt) ?? '',
    owner: { ...row.owner, username: row.owner.username ?? '' },
    mine: project.ownerId === me,
    likes: counts.likes.get(project.id) ?? 0,
    liked: counts.liked.has(project.id),
    remixes: counts.remixes.get(project.id) ?? 0,
    remixOf: (project.remixOf ?? null) as RemixOf | null,
    /** The published app, for "Try it" (null: the studio runs the project itself). */
    slug: row.slug,
  }
}

export type GalleryEntryDto = ReturnType<typeof entryOf>

export type RemixNode = {
  id: string
  name: string
  owner: string
  /** Shared in the gallery: it can be opened. */
  visible: boolean
  children: RemixNode[]
}

export function galleryRoutes(services: Services) {
  const { db, collab } = services

  const requireGallery = async () => {
    const settings = await services.settings.get()
    if (!settings.galleryEnabled) fail(403, 'gallery_disabled')
  }

  const owner = {
    displayName: user.name,
    username: user.username,
    avatar: user.avatar,
  }

  const select = () =>
    db
      .select({
        project: projects,
        owner,
        slug: sql<
          string | null
        >`case when ${publications.currentVersionId} is not null then ${publications.slug} end`,
      })
      .from(projects)
      .innerJoin(user, eq(user.id, projects.ownerId))
      .leftJoin(publications, eq(publications.projectId, projects.id))

  const visible = and(
    eq(projects.visibility, 'gallery'),
    isNull(projects.deletedAt),
    isNull(projects.galleryRemovedAt),
  )

  const countsOf = async (ids: string[], me: string) => {
    if (!ids.length) return { likes: new Map(), remixes: new Map(), liked: new Set<string>() }
    const [likeRows, remixRows, mine] = await Promise.all([
      db
        .select({ id: likes.projectId, total: count() })
        .from(likes)
        .where(inArray(likes.projectId, ids))
        .groupBy(likes.projectId),
      db
        .select({ id: projects.remixOfId, total: count() })
        .from(projects)
        .where(and(inArray(projects.remixOfId, ids), isNull(projects.deletedAt)))
        .groupBy(projects.remixOfId),
      db
        .select({ id: likes.projectId })
        .from(likes)
        .where(and(eq(likes.userId, me), inArray(likes.projectId, ids))),
    ])
    return {
      likes: new Map(likeRows.map((row) => [row.id, row.total])),
      remixes: new Map(remixRows.map((row) => [row.id as string, row.total])),
      liked: new Set(mine.map((row) => row.id)),
    }
  }

  /** The gallery project `id`, or 404. */
  const requireEntry = async (id: string) => {
    const [row] = await select().where(and(eq(projects.id, id), visible))
    if (!row) fail(404, 'not_found')
    return row
  }

  /** The remixes below a project, a few levels deep. */
  const tree = async (rootId: string): Promise<RemixNode[]> => {
    const nodes = new Map<string, RemixNode>()
    let level = [rootId]
    let total = 0
    const top: RemixNode[] = []
    for (let depth = 0; depth < 6 && level.length && total < TREE_LIMIT; depth++) {
      const rows = await db
        .select({
          id: projects.id,
          name: projects.name,
          parent: projects.remixOfId,
          visibility: projects.visibility,
          deletedAt: projects.deletedAt,
          galleryRemovedAt: projects.galleryRemovedAt,
          owner: user.name,
        })
        .from(projects)
        .innerJoin(user, eq(user.id, projects.ownerId))
        .where(and(inArray(projects.remixOfId, level), isNull(projects.deletedAt)))
        .orderBy(projects.createdAt)
        .limit(TREE_LIMIT - total)
      total += rows.length
      level = []
      for (const row of rows) {
        const shown = inGallery(row)
        // Private remixes are counted, never named: they belong to their owner.
        const node: RemixNode = {
          id: shown ? row.id : '',
          name: shown ? row.name : '',
          owner: shown ? row.owner : '',
          visible: shown,
          children: [],
        }
        nodes.set(row.id, node)
        level.push(row.id)
        const parent = row.parent === rootId ? null : nodes.get(row.parent ?? '')
        if (parent) parent.children.push(node)
        else top.push(node)
      }
    }
    return top
  }

  return (
    new Hono<ApiEnv>()
      .get(
        '/',
        queryParams(
          z.object({
            sort: z.enum(['recent', 'popular']).default('recent'),
            mode: z.enum(['all', 'junior', 'studio']).default('all'),
            q: z.string().trim().max(100).optional(),
          }),
        ),
        async (c) => {
          const me = requireUser(c)
          await requireGallery()
          const { sort, mode, q } = c.req.valid('query')
          const pattern = q ? `%${q.replace(/[%_\\]/g, (char) => `\\${char}`)}%` : null
          const rows = await select()
            .where(
              and(
                visible,
                mode === 'all'
                  ? undefined
                  : mode === 'studio'
                    ? eq(projects.uiMode, 'studio')
                    : or(isNull(projects.uiMode), eq(projects.uiMode, 'junior')),
                pattern
                  ? or(
                      ilike(projects.name, pattern),
                      ilike(user.name, pattern),
                      ilike(projects.description, pattern),
                    )
                  : undefined,
              ),
            )
            .orderBy(desc(projects.sharedAt))
            .limit(500)
          const counts = await countsOf(
            rows.map((row) => row.project.id),
            me.id,
          )
          const entries = rows.map((row) => entryOf(row, counts, me.id))
          if (sort === 'popular') {
            entries.sort(
              (a, b) =>
                b.likes + 2 * b.remixes - (a.likes + 2 * a.remixes) ||
                b.sharedAt.localeCompare(a.sharedAt),
            )
          }
          const settings = await services.settings.get()
          return c.json({
            entries,
            canShare: await mayShareInGallery(db, me.id),
            enabled: settings.galleryEnabled,
          })
        },
      )
      .get('/:projectId', async (c) => {
        const me = requireUser(c)
        await requireGallery()
        const row = await requireEntry(c.req.param('projectId'))
        const counts = await countsOf([row.project.id], me.id)
        // Ancestors, nearest first, as long as they are still in the gallery.
        const ancestors: RemixOf[] = []
        let credit = (row.project.remixOf ?? null) as RemixOf | null
        const seen = new Set([row.project.id])
        while (credit && ancestors.length < 10 && !seen.has(credit.id)) {
          seen.add(credit.id)
          ancestors.push(credit)
          const [parent] = await db
            .select({
              remixOf: projects.remixOf,
              visibility: projects.visibility,
              deletedAt: projects.deletedAt,
              galleryRemovedAt: projects.galleryRemovedAt,
            })
            .from(projects)
            .where(eq(projects.id, credit.id))
          credit = parent && inGallery(parent) ? ((parent.remixOf ?? null) as RemixOf | null) : null
        }
        const visibleAncestors = await db
          .select({ id: projects.id })
          .from(projects)
          .where(
            and(
              inArray(projects.id, ancestors.length ? ancestors.map((a) => a.id) : ['']),
              visible,
            ),
          )
        const open = new Set(visibleAncestors.map((entry) => entry.id))
        return c.json({
          entry: entryOf(row, counts, me.id),
          ancestors: ancestors.map((ancestor) => ({ ...ancestor, visible: open.has(ancestor.id) })),
          remixes: await tree(row.project.id),
        })
      })
      .put('/:projectId/like', async (c) => {
        const me = requireUser(c)
        await requireGallery()
        const row = await requireEntry(c.req.param('projectId'))
        await db
          .insert(likes)
          .values({ userId: me.id, projectId: row.project.id })
          .onConflictDoNothing()
        return c.json({ ok: true })
      })
      .delete('/:projectId/like', async (c) => {
        const me = requireUser(c)
        await db
          .delete(likes)
          .where(and(eq(likes.userId, me.id), eq(likes.projectId, c.req.param('projectId'))))
        return c.json({ ok: true })
      })
      // "Remix": a copy in my projects that says where it comes from.
      .post(
        '/:projectId/remix',
        jsonBody(z.object({ name: z.string().trim().min(1).max(80) })),
        async (c) => {
          const me = requireUser(c)
          await requireGallery()
          const row = await requireEntry(c.req.param('projectId'))
          const ydoc = await collab.read(row.project.id)
          const source = ydoc && readProject(ydoc)
          if (!source) fail(400, 'invalid_project')
          const now = new Date().toISOString()
          const copy = copyDoc(source, { id: 'pending', name: c.req.valid('json').name, now })
          const id = await insertProject(db, me, copy, {
            keepDates: false,
            remixOf: await remixCredit(db, row.project),
          })
          await copyAssetRows(db, row.project.id, id, me.id)
          return c.json({ id }, 201)
        },
      )
      // ---- Sharing, by the owner -----------------------------------------------------------
      .get('/:projectId/sharing', async (c) => {
        const me = requireUser(c)
        const { project } = await requireProject(db, me.id, c.req.param('projectId'), 'owner')
        const settings = await services.settings.get()
        return c.json({
          enabled: settings.galleryEnabled,
          allowed: await mayShareInGallery(db, me.id),
          shared: project.visibility === 'gallery',
          removed: project.galleryRemovedAt !== null,
        })
      })
      .put('/:projectId/sharing', jsonBody(z.object({ shared: z.boolean() })), async (c) => {
        const me = requireUser(c)
        const { project } = await requireProject(db, me.id, c.req.param('projectId'), 'owner')
        const { shared } = c.req.valid('json')
        if (shared) {
          await requireGallery()
          if (project.deletedAt) fail(409, 'in_trash')
          if (project.galleryRemovedAt) fail(403, 'gallery_removed')
          if (!(await mayShareInGallery(db, me.id))) fail(403, 'gallery_forbidden')
        }
        await db
          .update(projects)
          .set(
            shared
              ? { visibility: 'gallery', sharedAt: project.sharedAt ?? new Date() }
              : { visibility: 'private', sharedAt: null },
          )
          .where(eq(projects.id, project.id))
        return c.json({ ok: true })
      })
      // ---- Administration (SPEC § 4.11: the administrator may take a project out) ---------
      .delete('/:projectId', async (c) => {
        requireAdmin(c)
        const [row] = await db
          .update(projects)
          .set({ visibility: 'private', galleryRemovedAt: new Date() })
          .where(and(eq(projects.id, c.req.param('projectId')), eq(projects.visibility, 'gallery')))
          .returning({ id: projects.id })
        if (!row) fail(404, 'not_found')
        collab.reconnect(row.id)
        return c.json({ ok: true })
      })
      // Lets the owner share it again.
      .post('/:projectId/allow', async (c) => {
        requireAdmin(c)
        await db
          .update(projects)
          .set({ galleryRemovedAt: null })
          .where(
            and(eq(projects.id, c.req.param('projectId')), isNotNull(projects.galleryRemovedAt)),
          )
        return c.json({ ok: true })
      })
  )
}
