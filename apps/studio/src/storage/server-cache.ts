import { IndexeddbPersistence } from 'y-indexeddb'
import type * as Y from 'yjs'
import type { ProjectAccess } from './projects.ts'

/**
 * Offline cache of the server projects (y-indexeddb): edits made while the connection is
 * down survive a reload and leave when it comes back. Only for projects the account may
 * write; emptied at sign-out, since the browser may be shared.
 */
const INDEX_KEY = 'rublox-server-cache'
const dbName = (id: string) => `rublox-cache-${id}`

type CacheIndex = Record<string, { access: ProjectAccess; userId: string }>

function readIndex(): CacheIndex {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) ?? '{}') as CacheIndex
  } catch {
    return {}
  }
}

function writeIndex(index: CacheIndex) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index))
  } catch {
    // Storage full or blocked: the cache only helps, it is not needed.
  }
}

/** The access `userId` last had to a cached project (to open it offline). */
export function cachedAccess(id: string, userId: string): ProjectAccess | null {
  const entry = readIndex()[id]
  return entry?.userId === userId ? entry.access : null
}

/**
 * Loads the cached state of a project into `ydoc` and keeps the cache up to date. A copy
 * cached for another account is dropped first: its edits are not this account's.
 */
export async function openCache(id: string, ydoc: Y.Doc, access: ProjectAccess, userId: string) {
  const previous = readIndex()[id]
  if (previous && previous.userId !== userId) await deleteDatabase(dbName(id))
  writeIndex({ ...readIndex(), [id]: { access, userId } })
  const persistence = new IndexeddbPersistence(dbName(id), ydoc)
  await persistence.whenSynced
  return persistence
}

/** Forgets one cached project (no longer writable, deleted). */
export async function dropCache(id: string) {
  const { [id]: _, ...rest } = readIndex()
  writeIndex(rest)
  await deleteDatabase(dbName(id))
}

/** Empties the whole cache (sign-out). */
export async function clearCache() {
  const ids = Object.keys(readIndex())
  writeIndex({})
  await Promise.all(ids.map((id) => deleteDatabase(dbName(id))))
}

function deleteDatabase(name: string) {
  return new Promise<void>((resolve) => {
    try {
      const request = indexedDB.deleteDatabase(name)
      request.onsuccess = request.onerror = request.onblocked = () => resolve()
    } catch {
      resolve()
    }
  })
}
