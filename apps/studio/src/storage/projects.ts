import { createProject as newProjectDoc } from '@rublox/catalog'
import {
  hasProject,
  type Locale,
  newId,
  type ProjectDoc,
  projectToYDoc,
  type Screen,
  setMeta,
  type Theme,
  type UiMode,
  yDocToProject,
} from '@rublox/schema'
import { clearDocument, IndexeddbPersistence } from 'y-indexeddb'
import * as Y from 'yjs'
import { get, getAll, put, remove, STORES } from './db.ts'

/** What the caller may do with a project (server projects; guest projects are `owner`). */
export type ProjectAccess = 'owner' | 'editor' | 'viewer' | 'manager'

export type ProjectOwner = {
  id: string
  displayName: string
  username: string
  avatar: string | null
}

/** What the dashboard shows of a project, without opening its document. */
export type ProjectSummary = {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  favorite: boolean
  /** In the trash since then (restorable for 30 days). */
  deletedAt: string | null
  /** The start screen, drawn as the card's thumbnail. */
  preview: { screen: Screen; theme: Theme; locale: Locale } | null
  /** Server projects only. */
  access?: ProjectAccess
  owner?: ProjectOwner
  /** The space through which a manager sees the project. */
  spaceId?: string | null
}

export const TRASH_DAYS = 30

const docName = (id: string) => `rublox-project-${id}`

export function summarize(doc: ProjectDoc, previous?: Partial<ProjectSummary>): ProjectSummary {
  const start =
    doc.screens[doc.settings.navigation.startScreen] ?? doc.screens[doc.screenOrder[0] ?? '']
  return {
    id: doc.meta.id,
    name: doc.meta.name,
    description: doc.meta.description,
    createdAt: doc.meta.createdAt,
    updatedAt: doc.meta.updatedAt,
    favorite: previous?.favorite ?? false,
    deletedAt: previous?.deletedAt ?? null,
    preview: start ? { screen: start, theme: doc.settings.theme, locale: doc.meta.locale } : null,
  }
}

export async function listProjects(): Promise<ProjectSummary[]> {
  return getAll<ProjectSummary>(STORES.projects)
}

export async function getSummary(id: string): Promise<ProjectSummary | undefined> {
  return get<ProjectSummary>(STORES.projects, id)
}

export async function saveSummary(summary: ProjectSummary): Promise<void> {
  await put(STORES.projects, summary)
}

export async function updateSummary(id: string, patch: Partial<ProjectSummary>): Promise<void> {
  const current = await getSummary(id)
  if (current) await saveSummary({ ...current, ...patch })
}

/** A project's document, loaded from this browser. Call `destroy` when done. */
export async function openProjectDoc(
  id: string,
): Promise<{ ydoc: Y.Doc; persistence: IndexeddbPersistence }> {
  const ydoc = new Y.Doc()
  const persistence = new IndexeddbPersistence(docName(id), ydoc)
  await persistence.whenSynced
  return { ydoc, persistence }
}

async function storeDoc(doc: ProjectDoc): Promise<void> {
  const ydoc = projectToYDoc(doc)
  const persistence = new IndexeddbPersistence(docName(doc.meta.id), ydoc)
  await persistence.whenSynced
  await persistence.destroy()
  ydoc.destroy()
}

/** Stores a project built elsewhere (a tutorial's starting project…) in this browser. */
export async function importProjectDoc(doc: ProjectDoc): Promise<string> {
  await storeDoc(doc)
  await saveSummary(summarize(doc))
  return doc.meta.id
}

export async function createProject(input: {
  name: string
  locale: Locale
  mode: UiMode
}): Promise<string> {
  const doc = newProjectDoc(input)
  await storeDoc(doc)
  await saveSummary(summarize(doc))
  return doc.meta.id
}

/** Applies a change to a closed project's document (rename from the dashboard…). */
async function withDoc<T>(id: string, change: (ydoc: Y.Doc) => T): Promise<T> {
  const { ydoc, persistence } = await openProjectDoc(id)
  try {
    return change(ydoc)
  } finally {
    // Let y-indexeddb write the update before closing.
    await new Promise((resolve) => setTimeout(resolve, 50))
    await persistence.destroy()
    ydoc.destroy()
  }
}

export async function renameProject(id: string, name: string): Promise<void> {
  const updatedAt = new Date().toISOString()
  await withDoc(id, (ydoc) => setMeta(ydoc, { name, updatedAt }))
  await updateSummary(id, { name, updatedAt })
}

export async function duplicateProject(id: string, name: string): Promise<string> {
  const source = await withDoc(id, (ydoc) => (hasProject(ydoc) ? yDocToProject(ydoc) : null))
  if (!source) throw new Error('project not found')
  const now = new Date().toISOString()
  const copy: ProjectDoc = {
    ...structuredClone(source),
    meta: { ...source.meta, id: newId(), name, createdAt: now, updatedAt: now },
  }
  await storeDoc(copy)
  await saveSummary(summarize(copy))
  return copy.meta.id
}

export async function setFavorite(id: string, favorite: boolean): Promise<void> {
  await updateSummary(id, { favorite })
}

export async function moveToTrash(id: string): Promise<void> {
  await updateSummary(id, { deletedAt: new Date().toISOString() })
}

export async function restoreFromTrash(id: string): Promise<void> {
  await updateSummary(id, { deletedAt: null })
}

export async function deleteForever(id: string): Promise<void> {
  await clearDocument(docName(id))
  await remove(STORES.projects, id)
}

/** Empties trash entries older than 30 days. */
export async function purgeExpired(now = Date.now()): Promise<void> {
  const limit = TRASH_DAYS * 24 * 3600 * 1000
  for (const project of await listProjects()) {
    if (project.deletedAt && now - Date.parse(project.deletedAt) > limit)
      await deleteForever(project.id)
  }
}
