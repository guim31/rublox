import {
  hasProject,
  type ProjectDoc,
  projectDocSchema,
  projectToYDoc,
  setMeta,
  Y_ROOTS,
  yDocToProject,
} from '@rublox/schema'
import * as Y from 'yjs'

/** Server-side writes (rename from the dashboard, restore): a fixed Yjs origin. */
export const SERVER_ORIGIN = { name: 'server' }

/** What the dashboard draws for a project without opening it (`ProjectSummary.preview`). */
export type ProjectPreview = {
  screen: ProjectDoc['screens'][string]
  theme: ProjectDoc['settings']['theme']
  locale: ProjectDoc['meta']['locale']
}

export function loadYDoc(state: Uint8Array): Y.Doc {
  const ydoc = new Y.Doc({ gc: true })
  Y.applyUpdate(ydoc, state, SERVER_ORIGIN)
  return ydoc
}

export function encodeState(ydoc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(ydoc)
}

/** The validated JSON form of a document, or null when it is not a valid project. */
export function readProject(ydoc: Y.Doc): ProjectDoc | null {
  if (!hasProject(ydoc)) return null
  const parsed = projectDocSchema.safeParse(yDocToProject(ydoc))
  return parsed.success ? parsed.data : null
}

export function previewOf(doc: ProjectDoc): ProjectPreview | null {
  const start =
    doc.screens[doc.settings.navigation.startScreen] ?? doc.screens[doc.screenOrder[0] ?? '']
  return start ? { screen: start, theme: doc.settings.theme, locale: doc.meta.locale } : null
}

/** Sets the fields of `meta` the server owns (id, name, dates). */
export function writeMeta(
  ydoc: Y.Doc,
  patch: Partial<Pick<ProjectDoc['meta'], 'name' | 'description' | 'updatedAt'>> & {
    id?: string
    createdAt?: string
  },
) {
  ydoc.transact(() => {
    const meta = ydoc.getMap(Y_ROOTS.meta)
    if (patch.id) meta.set('id', patch.id)
    if (patch.createdAt) meta.set('createdAt', patch.createdAt)
    // `setMeta` deletes the keys set to undefined: pass only the given ones.
    const fields = { name: patch.name, description: patch.description, updatedAt: patch.updatedAt }
    setMeta(
      ydoc,
      Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)),
      SERVER_ORIGIN,
    )
  }, SERVER_ORIGIN)
}

/** A brand-new document holding a copy of `doc` (duplication, import), under a new id. */
export function copyDoc(doc: ProjectDoc, meta: { id: string; name: string; now: string }): Y.Doc {
  return projectToYDoc({
    ...structuredClone(doc),
    meta: { ...doc.meta, id: meta.id, name: meta.name, createdAt: meta.now, updatedAt: meta.now },
  })
}

/**
 * Replaces the whole content of `ydoc` by `doc` in one transaction (restoring a version). The
 * change is an ordinary Yjs edit, so open editors merge it instead of forking the history.
 * The project keeps its id and creation date.
 */
export function replaceContent(ydoc: Y.Doc, doc: ProjectDoc, updatedAt: string) {
  const meta = ydoc.getMap(Y_ROOTS.meta)
  const id = meta.get('id') as string
  const createdAt = meta.get('createdAt') as string
  ydoc.transact(() => {
    for (const name of Object.values(Y_ROOTS)) {
      if (name === Y_ROOTS.screenOrder) {
        const order = ydoc.getArray(name)
        order.delete(0, order.length)
      } else {
        const map = ydoc.getMap(name)
        for (const key of [...map.keys()]) map.delete(key)
      }
    }
    projectToYDoc({ ...doc, meta: { ...doc.meta, id, createdAt, updatedAt } }, ydoc)
  }, SERVER_ORIGIN)
}
