import {
  type BadgeId,
  type ChallengeProgress,
  EMPTY_PROGRESS,
  type LearningProgress,
  type ProgressStore,
  type TutorialProgress,
} from '@rublox/learn'

/**
 * The learning progression of this browser (guest mode), in its own IndexedDB database so
 * that it never conflicts with the projects' (`db.ts`). One record holds everything.
 */
const NAME = 'rublox-learning'
const STORE = 'progress'
const KEY = 'me'

let opening: Promise<IDBDatabase> | undefined

function open(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE)
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

async function read(): Promise<LearningProgress> {
  const db = await open()
  const value = await promisify(db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY))
  return { ...structuredClone(EMPTY_PROGRESS), ...(value as Partial<LearningProgress>) }
}

async function write(progress: LearningProgress): Promise<void> {
  const db = await open()
  await promisify(db.transaction(STORE, 'readwrite').objectStore(STORE).put(progress, KEY))
}

/** Read, change, write: the record is small and changes are rare. */
async function update(change: (progress: LearningProgress) => boolean | undefined) {
  const progress = await read()
  const changed = change(progress)
  if (changed !== false) await write(progress)
  return changed
}

export const browserProgressStore: ProgressStore = {
  load: read,
  saveTutorial: async (entry: TutorialProgress) => {
    await update((progress) => {
      progress.tutorials[entry.id] = entry
      return true
    })
  },
  saveChallenge: async (entry: ChallengeProgress) => {
    await update((progress) => {
      progress.challenges[entry.id] = entry
      return true
    })
  },
  award: async (id: BadgeId, at = new Date()) => {
    const awarded = await update((progress) => {
      if (progress.badges[id]) return false
      progress.badges[id] = { id, awardedAt: at.toISOString() }
      return true
    })
    return awarded === true
  },
  clear: () => write(structuredClone(EMPTY_PROGRESS)),
}
