import type { AppBundle, DataCredential, ProjectDoc } from '@rublox/schema'
import { and, eq } from 'drizzle-orm'
import { projectAccess } from '../access.ts'
import type { Collab } from '../collab.ts'
import type { Database } from '../db/index.ts'
import { liveLinks, projects, publications, publicationVersions } from '../db/schema.ts'
import { liveTokenHash } from '../live.ts'
import { readProject } from '../projects/ydoc.ts'
import type { Tickets } from './secrets.ts'

/** Whose app is calling: its project and the project as that app knows it. */
export type DataSource = {
  projectId: string
  /** The open project (editor, live test) or the frozen one (a published app). */
  doc: ProjectDoc
  kind: DataCredential['kind']
}

type Deps = {
  db: Database
  collab: Pick<Collab, 'read'>
  tickets: Tickets
  secret: string
}

/**
 * Checks what an app shows to use the services of the apps origin (SPEC § 6.9): a ticket of
 * the editor for a project that is not in the trash and still open to its account, a "test on my phone" link that is
 * neither revoked nor expired, or the slug of a published app. Null otherwise.
 */
export async function resolveCredential(
  deps: Deps,
  credential: DataCredential,
): Promise<DataSource | null> {
  const { db } = deps
  if (credential.kind === 'app') {
    const [row] = await db
      .select({ publication: publications, deletedAt: projects.deletedAt })
      .from(publications)
      .innerJoin(projects, eq(projects.id, publications.projectId))
      .where(eq(publications.slug, credential.slug))
    const versionId = row?.publication.currentVersionId
    if (!row || !versionId || row.deletedAt) return null
    const [version] = await db
      .select({ bundle: publicationVersions.bundle })
      .from(publicationVersions)
      .where(
        and(
          eq(publicationVersions.id, versionId),
          eq(publicationVersions.publicationId, row.publication.id),
        ),
      )
    if (!version) return null
    return {
      projectId: row.publication.projectId,
      doc: (version.bundle as AppBundle).doc,
      kind: 'app',
    }
  }

  let projectId: string
  if (credential.kind === 'editor') {
    const userId = deps.tickets.verify(credential.project, credential.ticket)
    if (!userId) return null
    // Still shared with that account (not taken back, not only through the gallery).
    const found = await projectAccess(db, userId, credential.project)
    if (!found || found.access === 'gallery') return null
    projectId = credential.project
  } else {
    const [link] = await db
      .select()
      .from(liveLinks)
      .where(eq(liveLinks.tokenHash, liveTokenHash(deps.secret, credential.token)))
    if (!link || link.revokedAt || link.expiresAt.getTime() <= Date.now()) return null
    projectId = link.projectId
  }
  const [project] = await db
    .select({ deletedAt: projects.deletedAt })
    .from(projects)
    .where(eq(projects.id, projectId))
  if (!project || project.deletedAt) return null
  const ydoc = await deps.collab.read(projectId)
  const doc = ydoc ? readProject(ydoc) : null
  return doc ? { projectId, doc, kind: credential.kind } : null
}
