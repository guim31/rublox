import {
  type BadgeId,
  type ChallengeProgress,
  EMPTY_PROGRESS,
  type ExploreProgress,
  type LearningProgress,
  type ProgressStore,
  type TutorialProgress,
} from '@rublox/learn'

/**
 * The learning progression, in its own IndexedDB database so that it never conflicts with the
 * projects' (`db.ts`).
 */
const NAME = 'rublox-learning'
const STORE = 'progress'

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

async function read(key: string): Promise<LearningProgress> {
  const db = await open()
  const value = await promisify(db.transaction(STORE, 'readonly').objectStore(STORE).get(key))
  // Records written before J9 have no `explore`.
  return { ...structuredClone(EMPTY_PROGRESS), ...(value as Partial<LearningProgress>) }
}

async function write(key: string, progress: LearningProgress): Promise<void> {
  const db = await open()
  await promisify(db.transaction(STORE, 'readwrite').objectStore(STORE).put(progress, key))
}

/**
 * The progression kept in this browser, one record per account (`guest` without one), so that
 * people sharing a computer do not share badges. Read, change, write: the record is small.
 */
export function browserProgressStore(key = 'guest'): ProgressStore {
  const update = async (change: (progress: LearningProgress) => boolean | undefined) => {
    const progress = await read(key)
    const changed = change(progress)
    if (changed !== false) await write(key, progress)
    return changed
  }
  return {
    load: () => read(key),
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
    saveExplore: async (entry: ExploreProgress) => {
      await update((progress) => {
        progress.explore[entry.id] = entry
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
    clear: () => write(key, structuredClone(EMPTY_PROGRESS)),
  }
}
