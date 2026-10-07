import type { HocuspocusProvider } from '@hocuspocus/provider'
import type { ComponentId, WorkspaceKey } from '@rublox/schema'
import { useSyncExternalStore } from 'react'
import type { EditorTab } from '../routes/p.$projectId.tsx'
import { useSession } from './context.tsx'

type Awareness = NonNullable<HocuspocusProvider['awareness']>

/** Who a peer is: written by the server from their session (`collab.ts`), never by them. */
export type PeerUser = { id: string; name: string; avatar: string | null; readOnly: boolean }

/** Where a peer is: tab and screen (or `app` in Blocks). */
export type PeerView = { tab: EditorTab; screen: WorkspaceKey }

/** What an editor shares with the others (SPEC § 4.9): the awareness state of its tab. */
export type PresenceState = {
  user?: PeerUser
  view?: PeerView
  /** Selected components (Design). */
  selection?: ComponentId[]
  /** Selected block (Blocks). */
  block?: string | null
}

/** Another tab open on the project. */
export type Peer = {
  clientId: number
  user: PeerUser
  color: PeerColor
  view: PeerView | null
  selection: ComponentId[]
  block: string | null
}

/** One person, with every tab they have open. */
export type Person = { user: PeerUser; color: PeerColor; peers: Peer[] }

/**
 * The colours of the people present: dark enough for white text on them (4.5:1), and lifted
 * in the dark theme where they draw a line (`--peer` / `--peer-line`, see `peerStyle`).
 */
export const PEER_COLORS = [
  '#c2255c',
  '#0b7285',
  '#5f3dc4',
  '#c2410c',
  '#237032',
  '#1864ab',
  '#862e9c',
  '#8a6100',
] as const
export type PeerColor = (typeof PEER_COLORS)[number]

function hash(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (Math.imul(h, 31) + text.charCodeAt(i)) | 0
  return Math.abs(h)
}

/**
 * One colour per person, the same in every tab: each person prefers the colour of their id,
 * and when two prefer the same one, the next free colour goes to the later id. Everybody
 * computes it from the same set of people, so everybody agrees.
 */
export function assignColors(userIds: string[]): Map<string, PeerColor> {
  const colors = new Map<string, PeerColor>()
  const taken = new Set<number>()
  for (const id of [...new Set(userIds)].sort()) {
    let index = hash(id) % PEER_COLORS.length
    for (let tries = 0; taken.has(index) && tries < PEER_COLORS.length; tries++) {
      index = (index + 1) % PEER_COLORS.length
    }
    taken.add(index)
    colors.set(id, PEER_COLORS[index] ?? PEER_COLORS[0])
  }
  return colors
}

/**
 * The presence of a server project: this tab's state (where it is, what it selects) and the
 * other tabs open on it, over the awareness of the Hocuspocus provider. Guest projects have
 * none.
 */
export class Presence {
  private peers: Peer[] = []
  private people: Person[] = []
  /** Every user seen in this project, by client id, also after they left (who edited what). */
  private readonly known = new Map<number, PeerUser>()
  private readonly listeners = new Set<() => void>()

  constructor(
    private readonly awareness: Awareness,
    /** This tab's account: its other tabs are not shown as someone else. */
    private readonly userId: string | null,
  ) {
    awareness.on('change', this.refresh)
    this.refresh()
  }

  get clientId(): number {
    return this.awareness.clientID
  }

  private refresh = () => {
    const states = this.awareness.getStates() as Map<number, PresenceState>
    const users: string[] = []
    for (const [clientId, state] of states) {
      if (!state.user) continue
      this.known.set(clientId, state.user)
      users.push(state.user.id)
    }
    if (this.userId) users.push(this.userId)
    const colors = assignColors(users)
    const peers: Peer[] = []
    for (const [clientId, state] of states) {
      const user = state.user
      if (clientId === this.clientId || !user || user.id === this.userId) continue
      peers.push({
        clientId,
        user,
        color: colors.get(user.id) ?? PEER_COLORS[0],
        view: state.view ?? null,
        selection: Array.isArray(state.selection) ? state.selection.slice(0, 50) : [],
        block: typeof state.block === 'string' ? state.block : null,
      })
    }
    peers.sort((a, b) => a.user.name.localeCompare(b.user.name) || a.clientId - b.clientId)
    const next = JSON.stringify(peers)
    if (next === JSON.stringify(this.peers)) return
    this.peers = peers
    const people = new Map<string, Person>()
    for (const peer of peers) {
      const person = people.get(peer.user.id)
      if (person) person.peers.push(peer)
      else people.set(peer.user.id, { user: peer.user, color: peer.color, peers: [peer] })
    }
    this.people = [...people.values()]
    for (const listener of this.listeners) listener()
  }

  /** The user behind a client id (a document change, an awareness state), if ever seen. */
  userOf(clientId: number): PeerUser | null {
    return this.known.get(clientId) ?? null
  }

  colorOf(userId: string): PeerColor {
    return this.people.find((person) => person.user.id === userId)?.color ?? PEER_COLORS[0]
  }

  set(patch: Omit<PresenceState, 'user'>) {
    const current = (this.awareness.getLocalState() ?? {}) as PresenceState
    const changed = Object.entries(patch).some(
      ([key, value]) =>
        JSON.stringify(current[key as keyof PresenceState]) !== JSON.stringify(value),
    )
    if (changed) this.awareness.setLocalState({ ...current, ...patch })
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getPeers = () => this.peers
  getPeople = () => this.people

  dispose() {
    this.awareness.off('change', this.refresh)
    this.listeners.clear()
  }
}

const NO_PEERS: Peer[] = []
const NO_PEOPLE: Person[] = []
const noop = () => () => {}

/** The other tabs open on the project (none for a guest project). */
export function usePeers(): Peer[] {
  const presence = useSession().presence
  return useSyncExternalStore(presence?.subscribe ?? noop, presence?.getPeers ?? (() => NO_PEERS))
}

/** The other people in the project, each with their tabs. */
export function usePeople(): Person[] {
  const presence = useSession().presence
  return useSyncExternalStore(presence?.subscribe ?? noop, presence?.getPeople ?? (() => NO_PEOPLE))
}

/** CSS variables of a peer's colour: `--peer` (fills, white text), `--peer-line` (lines). */
export function peerStyle(color: PeerColor): React.CSSProperties {
  return { '--peer': color } as React.CSSProperties
}
