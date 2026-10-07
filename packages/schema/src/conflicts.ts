import type * as Y from 'yjs'

/** How long one's write of a stack counts as "being edited" for conflict notices. */
export const CONFLICT_WINDOW = 15_000

/**
 * The Yjs item holding a map entry: who wrote it (`id.client`) and which entry it replaced
 * when it was written (`origin`). Yjs has no public accessor for it.
 */
function entryItem<T>(map: Y.Map<T>, key: string): Y.Item | null {
  return (map as unknown as { _map: Map<string, Y.Item> })._map.get(key) ?? null
}

/** The client (Yjs client id) that wrote a map entry's current value. */
export function entryWriter<T>(map: Y.Map<T>, key: string): number | null {
  return entryItem(map, key)?.id.client ?? null
}

/**
 * Conflicts on stacks of blocks (SPEC § 4.9): two people changed the same stack, the last
 * save wins. Each stack remembers the item of one's last write. A remote write records, as
 * its `origin`, the entry it replaced when it was made: when that is one's write, it built on
 * it (nothing lost); otherwise it never saw one's version, which is gone, and the interface
 * says so, and who won. Feed it the events of one workspace's stacks map.
 */
export class StackConflicts {
  private readonly mine = new Map<string, { item: Y.ID; at: number }>()

  constructor(private readonly window = CONFLICT_WINDOW) {}

  /** One's own write of stacks (a local transaction on the stacks map). */
  wrote<T>(event: Y.YMapEvent<T>, now = Date.now()) {
    for (const [stack, change] of event.changes.keys) {
      const item = entryItem(event.target, stack)
      if (change.action !== 'delete' && item) this.mine.set(stack, { item: item.lastId, at: now })
      else this.mine.delete(stack)
    }
  }

  /** The stacks one lost in a remote write, with the client that won (null: a deletion). */
  lost<T>(event: Y.YMapEvent<T>, now = Date.now()): { stack: string; client: number | null }[] {
    const lost: { stack: string; client: number | null }[] = []
    for (const [stack, change] of event.changes.keys) {
      const mine = this.mine.get(stack)
      if (!mine) continue
      this.mine.delete(stack)
      if (now - mine.at > this.window) continue
      const winner = change.action === 'delete' ? null : entryItem(event.target, stack)
      const origin = winner?.origin
      const builtOnMine = origin?.client === mine.item.client && origin.clock === mine.item.clock
      if (!builtOnMine) lost.push({ stack, client: winner ? winner.id.client : null })
    }
    return lost
  }
}
