import type { IndexeddbPersistence } from 'y-indexeddb'
import * as Y from 'yjs'
import { fromBase64, toBase64 } from '../lib/base64.ts'

/**
 * Edits of a project kept in this browser that IndexedDB has not confirmed yet.
 *
 * y-indexeddb writes each edit at once, but in a transaction that commits a little later; a
 * transaction still running when the page unloads is aborted. An edit followed at once by a
 * navigation (signing in, a reload, a closed tab) was lost. Each edit is first written here,
 * synchronously (`localStorage` survives the unload), and removed once IndexedDB confirmed
 * it; whatever is left is applied again when the project is opened (Yjs updates can be
 * applied twice).
 */
export class UpdateJournal {
  constructor(
    private readonly name: string,
    private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = localStorage,
  ) {}

  private get key() {
    return `rublox:pending:${this.name}`
  }

  /** The updates not confirmed yet, oldest first. */
  read(): Uint8Array[] {
    try {
      const raw = this.storage.getItem(this.key)
      return raw ? (JSON.parse(raw) as string[]).map(fromBase64) : []
    } catch {
      return []
    }
  }

  /** The entries as last read or written here: an edit appends without reading them again. */
  private cache: string[] | null = null

  private write(entries: string[]) {
    this.cache = entries
    try {
      if (entries.length) this.storage.setItem(this.key, JSON.stringify(entries))
      else this.storage.removeItem(this.key)
    } catch {
      // Storage full or forbidden: the edit still goes to IndexedDB, as before the journal.
    }
  }

  private entries(): string[] {
    if (this.cache) return this.cache
    try {
      return JSON.parse(this.storage.getItem(this.key) ?? '[]') as string[]
    } catch {
      return []
    }
  }

  /** Notes an update; returns how many are waiting now. */
  add(update: Uint8Array): number {
    const entries = [...this.entries(), toBase64(update)]
    this.write(entries)
    return entries.length
  }

  /** Forgets the first `count` updates (confirmed by IndexedDB). */
  drop(count: number) {
    this.write(this.entries().slice(count))
  }

  clear() {
    this.write([])
  }
}

/** Resolves once every write already started on `persistence` is committed. */
export function written(persistence: IndexeddbPersistence): Promise<void> {
  const db = persistence.db
  if (!db) return Promise.resolve()
  return new Promise((resolve, reject) => {
    // Transactions on the same store run in order: a later one completes after the writes.
    const transaction = db.transaction(['updates'], 'readonly')
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

/** Applies again what a previous page left unconfirmed, and waits for IndexedDB to keep it. */
export async function replayJournal(
  ydoc: Y.Doc,
  persistence: IndexeddbPersistence,
  journal: UpdateJournal,
): Promise<void> {
  const pending = journal.read()
  if (!pending.length) return
  Y.transact(ydoc, () => {
    for (const update of pending) Y.applyUpdate(ydoc, update)
  })
  await written(persistence)
  journal.drop(pending.length)
}

/**
 * Journals the edits of an open project until IndexedDB confirms them. `flush()` resolves
 * once every edit made so far is in IndexedDB.
 */
export function journalEdits(
  ydoc: Y.Doc,
  persistence: IndexeddbPersistence,
  journal: UpdateJournal,
) {
  let waiting = 0
  let scheduled: ReturnType<typeof setTimeout> | undefined
  const flush = async () => {
    const count = waiting
    if (!count) return
    await written(persistence)
    journal.drop(count)
    waiting = Math.max(0, waiting - count)
  }
  const onUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === persistence) return
    waiting = journal.add(update)
    // Confirmed as soon as IndexedDB has it: the journal stays short, even during a drag.
    clearTimeout(scheduled)
    scheduled = setTimeout(() => void flush().catch(() => {}), 0)
  }
  ydoc.on('update', onUpdate)
  return {
    flush,
    dispose() {
      clearTimeout(scheduled)
      ydoc.off('update', onUpdate)
    },
  }
}
