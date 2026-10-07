import type { ProjectDoc } from '@rublox/schema'
import { desc, eq } from 'drizzle-orm'
import type * as Y from 'yjs'
import type { Database } from '../db/index.ts'
import { projectDocs, projects, projectVersions } from '../db/schema.ts'
import { uuidv7 } from '../ids.ts'
import { encodeState, loadYDoc, previewOf } from './ydoc.ts'

/** An automatic snapshot at most every 10 minutes of activity (SPEC § 4.8). */
export const SNAPSHOT_INTERVAL_MS = 10 * 60 * 1000

/** The stored Yjs state of a project, or null when there is none. */
export async function loadStoredDoc(db: Database, projectId: string): Promise<Y.Doc | null> {
  const [row] = await db
    .select({ state: projectDocs.state })
    .from(projectDocs)
    .where(eq(projectDocs.projectId, projectId))
  return row ? loadYDoc(row.state) : null
}

/**
 * Stores a document that `readProject` validated, and refreshes the dashboard fields of the
 * project. Returns false when the project no longer exists (deleted meanwhile).
 */
export async function storeDoc(
  db: Database,
  projectId: string,
  ydoc: Y.Doc,
  doc: ProjectDoc,
): Promise<boolean> {
  const now = new Date()
  const updated = await db
    .update(projects)
    .set({
      name: doc.meta.name.slice(0, 80) || '…',
      description: doc.meta.description ?? null,
      preview: previewOf(doc),
      updatedAt: now,
    })
    .where(eq(projects.id, projectId))
    .returning({ id: projects.id })
  if (updated.length === 0) return false
  const state = encodeState(ydoc)
  await db
    .insert(projectDocs)
    .values({ projectId, state, json: doc, updatedAt: now })
    .onConflictDoUpdate({
      target: projectDocs.projectId,
      set: { state, json: doc, updatedAt: now },
    })
  return true
}

export async function snapshot(
  db: Database,
  projectId: string,
  json: ProjectDoc,
  createdById: string | null,
  name: string | null,
) {
  await db.insert(projectVersions).values({ id: uuidv7(), projectId, name, json, createdById })
}

/** Takes an automatic snapshot unless one is less than 10 minutes old. */
export async function autoSnapshot(
  db: Database,
  projectId: string,
  json: ProjectDoc,
  userId: string | null,
) {
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
