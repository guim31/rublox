/**
 * The guest-mode database (SPEC § 4.8): the list of projects and the asset files. Each
 * project's Yjs document lives in its own database, managed by y-indexeddb.
 */
const NAME = 'rublox'
const VERSION = 1

export const STORES = { projects: 'projects', assets: 'assets' } as const
type Store = (typeof STORES)[keyof typeof STORES]

let opening: Promise<IDBDatabase> | undefined

function open(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(NAME, VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORES.projects))
        db.createObjectStore(STORES.projects, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(STORES.assets)) db.createObjectStore(STORES.assets)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return opening
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function store(name: Store, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return (await open()).transaction(name, mode).objectStore(name)
}

export async function getAll<T>(name: Store): Promise<T[]> {
  return promisify((await store(name, 'readonly')).getAll()) as Promise<T[]>
}

export async function get<T>(name: Store, key: IDBValidKey): Promise<T | undefined> {
  return promisify((await store(name, 'readonly')).get(key)) as Promise<T | undefined>
}

export async function put(name: Store, value: unknown, key?: IDBValidKey): Promise<void> {
  await promisify((await store(name, 'readwrite')).put(value, key))
}

export async function remove(name: Store, key: IDBValidKey): Promise<void> {
  await promisify((await store(name, 'readwrite')).delete(key))
}
