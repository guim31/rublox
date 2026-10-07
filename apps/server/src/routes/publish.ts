import {
  APP_ICON_FILES,
  type AppIconKey,
  type AppSettings,
  appBundleSchema,
  appSettingsSchema,
  assetHashes,
  isValidSlug,
  slugify,
} from '@rublox/schema'
import { and, desc, eq, gt, inArray, isNull, max } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { canWrite, requireProject } from '../access.ts'
import type { Database } from '../db/index.ts'
import {
  assets,
  liveLinks,
  member,
  publications,
  publicationVersions,
  spaceSettings,
  user,
} from '../db/schema.ts'
import { sha256 } from '../files.ts'
import { type ApiEnv, fail, fromBase64, iso, jsonBody, requireUser } from '../http.ts'
import { randomToken, uuidv7 } from '../ids.ts'
import { liveTokenHash } from '../live.ts'
import type { Services } from '../services.ts'
import { MB } from '../settings.ts'
import { sniff } from '../sniff.ts'

/** How long a "Test on my phone" link works (SPEC § 4.3: temporary). */
export const LIVE_LINK_HOURS = 8
const MAX_ICON_BYTES = 2 * MB
const ICON_KEYS = Object.values(APP_ICON_FILES).map((file) => file.key) as AppIconKey[]

const base64Png = z
  .string()
  .max(Math.ceil((MAX_ICON_BYTES * 4) / 3) + 4)
  .regex(/^[A-Za-z0-9+/]*={0,2}$/)

export const publishSchema = z.object({
  slug: z.string().trim().toLowerCase().max(40),
  settings: appSettingsSchema,
  bundle: appBundleSchema,
  icons: z.object({ '192': base64Png, '512': base64Png, maskable: base64Png, apple: base64Png }),
})

/**
 * Whether `userId` may publish: refused when one of the spaces where they are a plain member
 * forbids it (`membersCanPublish`, set by its managers, SPEC § 4.7).
 */
export async function mayPublish(db: Database, userId: string): Promise<boolean> {
  const [blocked] = await db
    .select({ spaceId: member.organizationId })
    .from(member)
    .innerJoin(spaceSettings, eq(spaceSettings.spaceId, member.organizationId))
    .where(
      and(
        eq(member.userId, userId),
        eq(member.role, 'member'),
        eq(spaceSettings.membersCanPublish, false),
      ),
    )
    .limit(1)
  return !blocked
}

/**
 * Both the one who publishes and the project's owner must have the right: a member whose
 * space forbids publishing cannot get around it by sharing the project with someone who may
 * (SPEC § 0.10).
 */
export async function mayPublishProject(
  db: Database,
  userId: string,
  ownerId: string,
): Promise<boolean> {
  return (await mayPublish(db, userId)) && (ownerId === userId || (await mayPublish(db, ownerId)))
}

async function publicationOf(db: Database, projectId: string) {
  const [row] = await db.select().from(publications).where(eq(publications.projectId, projectId))
  return row ?? null
}

async function slugTaken(db: Database, slug: string, projectId: string): Promise<boolean> {
  const [row] = await db
    .select({ projectId: publications.projectId })
    .from(publications)
    .where(eq(publications.slug, slug))
  return Boolean(row && row.projectId !== projectId)
}

/** Publication (SPEC § 4.6) and live test links (§ 4.3) of a project, under `/projects`. */
export function publishRoutes(services: Services) {
  const { db, config } = services
  const appUrl = (slug: string) => `${config.appsUrl}/a/${slug}/`

  return (
    new Hono<ApiEnv>()
      .get('/:projectId/publication', async (c) => {
        const me = requireUser(c)
        const { project, access } = await requireProject(
          db,
          me.id,
          c.req.param('projectId'),
          'read',
        )
        const publication = await publicationOf(db, project.id)
        const versions = publication
          ? await db
              .select({
                id: publicationVersions.id,
                number: publicationVersions.number,
                settings: publicationVersions.settings,
                createdAt: publicationVersions.createdAt,
                author: user.name,
              })
              .from(publicationVersions)
              .leftJoin(user, eq(user.id, publicationVersions.createdById))
              .where(eq(publicationVersions.publicationId, publication.id))
              .orderBy(desc(publicationVersions.number))
              .limit(100)
          : []
        const current = versions.find((v) => v.id === publication?.currentVersionId)
        return c.json({
          slug: publication?.slug ?? null,
          suggestedSlug: publication?.slug ?? (await freeSlug(db, project.name, project.id)),
          url: publication ? appUrl(publication.slug) : null,
          published: Boolean(publication?.currentVersionId),
          canPublish:
            (access === 'owner' || access === 'editor') &&
            !project.deletedAt &&
            (await mayPublishProject(db, me.id, project.ownerId)),
          /** The settings of the last version, to fill the dialog again. */
          settings: (versions[0]?.settings ?? null) as AppSettings | null,
          current: current ? { id: current.id, number: current.number } : null,
          versions: versions.map((v) => ({
            id: v.id,
            number: v.number,
            name: (v.settings as AppSettings).name,
            createdAt: iso(v.createdAt) ?? '',
            author: v.author,
            current: v.id === publication?.currentVersionId,
          })),
        })
      })
      .get('/:projectId/publication/slug/:slug', async (c) => {
        const me = requireUser(c)
        const { project } = await requireProject(db, me.id, c.req.param('projectId'), 'read')
        const slug = c.req.param('slug').toLowerCase()
        return c.json({
          valid: isValidSlug(slug),
          available: isValidSlug(slug) && !(await slugTaken(db, slug, project.id)),
        })
      })
      // Publishes a new version: frozen settings, project, generated code and icons.
      .put('/:projectId/publication', jsonBody(publishSchema), async (c) => {
        const me = requireUser(c)
        const { project } = await requireProject(db, me.id, c.req.param('projectId'), 'write')
        if (project.deletedAt) fail(409, 'in_trash')
        if (!(await mayPublishProject(db, me.id, project.ownerId))) fail(403, 'publish_forbidden')
        const input = c.req.valid('json')
        const { doc } = input.bundle
        const existing = await publicationOf(db, project.id)
        // The address never changes once chosen (SPEC § 4.6).
        const slug = existing?.slug ?? input.slug
        if (!isValidSlug(slug)) fail(400, 'invalid')
        if (await slugTaken(db, slug, project.id)) fail(409, 'slug_taken')

        // Every file the app uses must already be a file of this project.
        const needed = assetHashes(doc)
        if (needed.length > 0) {
          const rows = await db
            .select({ sha256: assets.sha256 })
            .from(assets)
            .where(and(eq(assets.projectId, project.id), inArray(assets.sha256, needed)))
          const known = new Set(rows.map((row) => row.sha256))
          if (needed.some((hash) => !known.has(hash))) fail(400, 'missing_asset')
        }
        const { icon } = input.settings
        if (icon.kind === 'asset' && doc.assets[icon.assetId]?.kind !== 'image') {
          fail(400, 'invalid')
        }

        const icons = {} as Record<AppIconKey, string>
        for (const key of ICON_KEYS) {
          const bytes = fromBase64(input.icons[key])
          if (bytes.length > MAX_ICON_BYTES || sniff(bytes)?.mime !== 'image/png') {
            fail(400, 'invalid')
          }
          const hash = sha256(bytes)
          await services.files.put(hash, bytes)
          icons[key] = hash
        }

        const result = await db.transaction(async (tx) => {
          let publicationId = existing?.id
          if (!publicationId) {
            publicationId = uuidv7()
            await tx.insert(publications).values({ id: publicationId, projectId: project.id, slug })
          }
          const [last] = await tx
            .select({ number: max(publicationVersions.number) })
            .from(publicationVersions)
            .where(eq(publicationVersions.publicationId, publicationId))
          const number = (last?.number ?? 0) + 1
          const versionId = uuidv7()
          await tx.insert(publicationVersions).values({
            id: versionId,
            publicationId,
            number,
            settings: input.settings,
            bundle: input.bundle,
            icons,
            createdById: me.id,
          })
          await tx
            .update(publications)
            .set({ currentVersionId: versionId, updatedAt: new Date() })
            .where(eq(publications.id, publicationId))
          return { number }
        })
        return c.json({ slug, url: appUrl(slug), version: result.number }, 201)
      })
      // Serves an earlier version again (and publishes again when the app was unpublished).
      .post('/:projectId/publication/versions/:versionId/current', async (c) => {
        const me = requireUser(c)
        const { project } = await requireProject(db, me.id, c.req.param('projectId'), 'write')
        if (project.deletedAt) fail(409, 'in_trash')
        if (!(await mayPublishProject(db, me.id, project.ownerId))) fail(403, 'publish_forbidden')
        const publication = await publicationOf(db, project.id)
        if (!publication) fail(404, 'not_found')
        const [version] = await db
          .select({ id: publicationVersions.id })
          .from(publicationVersions)
          .where(
            and(
              eq(publicationVersions.publicationId, publication.id),
              eq(publicationVersions.id, c.req.param('versionId')),
            ),
          )
        if (!version) fail(404, 'not_found')
        await db
          .update(publications)
          .set({ currentVersionId: version.id, updatedAt: new Date() })
          .where(eq(publications.id, publication.id))
        return c.json({ ok: true })
      })
      // Unpublishes: the address answers "no longer published"; versions and slug are kept.
      .delete('/:projectId/publication', async (c) => {
        const me = requireUser(c)
        // Also from the trash: taking an app offline for good changes nothing in the project.
        const { project, access } = await requireProject(
          db,
          me.id,
          c.req.param('projectId'),
          'read',
        )
        if (!canWrite(access)) fail(403, 'forbidden')
        await db
          .update(publications)
          .set({ currentVersionId: null, updatedAt: new Date() })
          .where(eq(publications.projectId, project.id))
        return c.json({ ok: true })
      })
      // ---- Test on my phone (SPEC § 4.3) -----------------------------------------------------
      // A new link replaces the caller's previous links to this project.
      .post('/:projectId/live', async (c) => {
        const me = requireUser(c)
        const { project } = await requireProject(db, me.id, c.req.param('projectId'), 'read')
        const now = new Date()
        const previous = await db
          .update(liveLinks)
          .set({ revokedAt: now })
          .where(
            and(
              eq(liveLinks.projectId, project.id),
              eq(liveLinks.createdById, me.id),
              isNull(liveLinks.revokedAt),
              gt(liveLinks.expiresAt, now),
            ),
          )
          .returning({ id: liveLinks.id })
        for (const link of previous) services.live.end(link.id, 'revoked')
        const token = randomToken(24)
        const id = uuidv7()
        const expiresAt = new Date(now.getTime() + LIVE_LINK_HOURS * 3600 * 1000)
        await db.insert(liveLinks).values({
          id,
          tokenHash: liveTokenHash(config.secret, token),
          projectId: project.id,
          createdById: me.id,
          expiresAt,
        })
        return c.json(
          { id, token, url: `${config.appsUrl}/live/${token}`, expiresAt: expiresAt.toISOString() },
          201,
        )
      })
      .delete('/:projectId/live/:linkId', async (c) => {
        const me = requireUser(c)
        const { project, access } = await requireProject(
          db,
          me.id,
          c.req.param('projectId'),
          'read',
        )
        const linkId = c.req.param('linkId')
        const [link] = await db
          .select()
          .from(liveLinks)
          .where(and(eq(liveLinks.id, linkId), eq(liveLinks.projectId, project.id)))
        // Its creator or the project's owner may revoke a link.
        if (!link || (link.createdById !== me.id && access !== 'owner')) fail(404, 'not_found')
        await db.update(liveLinks).set({ revokedAt: new Date() }).where(eq(liveLinks.id, link.id))
        services.live.end(link.id, 'revoked')
        return c.json({ ok: true })
      })
  )
}

/** The icon files of every publication version (kept when the trash is emptied). */
export async function publishedIconFiles(db: Database): Promise<string[]> {
  const rows = await db.select({ icons: publicationVersions.icons }).from(publicationVersions)
  return rows.flatMap((row) => Object.values(row.icons as Record<string, string>))
}

/** A free slug for a project, from its name. */
async function freeSlug(db: Database, name: string, projectId: string): Promise<string> {
  const base = slugify(name)
  for (let n = 1; n < 50; n++) {
    const candidate = n === 1 ? base : `${base.slice(0, 36)}-${n}`
    if (isValidSlug(candidate) && !(await slugTaken(db, candidate, projectId))) return candidate
  }
  return slugify(`${name}-${randomToken(3)}`)
}
