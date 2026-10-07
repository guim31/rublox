import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider'
import { type Asset, type AssetKind, hasProject, setMeta, yDocToProject } from '@rublox/schema'
import type { IndexeddbPersistence } from 'y-indexeddb'
import * as Y from 'yjs'
import { ApiError, api, call, reportSignedOut } from '../lib/api.ts'
import { currentUserId } from '../lib/session.ts'
import { loadAssetFile, storeAssetFile } from '../storage/assets.ts'
import {
  getSummary,
  openProjectDoc,
  type ProjectAccess,
  type ProjectOwner,
  saveSummary,
  summarize,
} from '../storage/projects.ts'
import { downloadAsset, uploadAsset } from '../storage/server-assets.ts'
import { cachedAccess, dropCache, openCache } from '../storage/server-cache.ts'

export type SaveState = 'saved' | 'saving' | 'offline' | 'readonly'

/**
 * Where an open project's document lives and how it is saved: this browser (guest mode) or
 * the server (accounts). The session sees the same interface for both.
 */
export interface DocSource {
  readonly kind: 'guest' | 'server'
  readonly ydoc: Y.Doc
  /** Whether a transaction came from the source itself (loading, server), not an edit. */
  isOwnOrigin(origin: unknown): boolean
  readonly access: ProjectAccess
  readonly owner: ProjectOwner | null
  saveState(): SaveState
  /** Called after each local edit. */
  edited(): void
  storeAsset(file: File, kind: AssetKind): Promise<Asset>
  loadAsset(hash: string): Promise<Blob | undefined>
  /** Saves what is pending and releases the document. */
  close(): Promise<void>
  onChange(listener: () => void): void
}

/** Bookkeeping writes (`updatedAt`): stored, but neither undoable nor counted as an edit. */
export const SUMMARY_ORIGIN = { name: 'summary' }

/** Guest mode (J0): y-indexeddb stores every update right away. */
export class GuestSource implements DocSource {
  readonly kind = 'guest'
  readonly access = 'owner'
  readonly owner = null
  private state: SaveState = 'saved'
  private saveTimer?: ReturnType<typeof setTimeout>
  private summaryTimer?: ReturnType<typeof setTimeout>
  private listener: () => void = () => {}
  private closed = false

  private constructor(
    readonly id: string,
    readonly ydoc: Y.Doc,
    private readonly persistence: IndexeddbPersistence,
  ) {}

  isOwnOrigin(origin: unknown) {
    return origin === this.persistence
  }

  static async open(id: string): Promise<GuestSource> {
    const { ydoc, persistence } = await openProjectDoc(id)
    return new GuestSource(id, ydoc, persistence)
  }

  onChange(listener: () => void) {
    this.listener = listener
  }

  saveState() {
    return this.state
  }

  edited() {
    this.state = 'saving'
    clearTimeout(this.saveTimer)
    // y-indexeddb stores each update right away; show "Saving…" briefly so it is noticed.
    this.saveTimer = setTimeout(() => {
      this.state = 'saved'
      this.listener()
    }, 450)
    clearTimeout(this.summaryTimer)
    this.summaryTimer = setTimeout(() => void this.writeSummary(), 600)
  }

  private async writeSummary(): Promise<void> {
    if (this.closed) return
    setMeta(this.ydoc, { updatedAt: new Date().toISOString() }, SUMMARY_ORIGIN)
    const previous = await getSummary(this.id)
    await saveSummary(summarize(yDocToProject(this.ydoc), previous))
  }

  storeAsset(file: File, kind: AssetKind) {
    return storeAssetFile(file, kind)
  }

  loadAsset(hash: string) {
    return loadAssetFile(hash)
  }

  async close() {
    clearTimeout(this.saveTimer)
    if (this.summaryTimer) {
      clearTimeout(this.summaryTimer)
      await this.writeSummary()
    }
    this.closed = true
    await this.persistence.destroy()
  }
}

/** How long to wait for the server before opening a cached project offline. */
const CONNECT_TIMEOUT = 6000
/** How long closing waits for the last edits to reach the server. */
const CLOSE_TIMEOUT = 3000

/** Why Hocuspocus closes a document whose rights changed (`ResetConnection`). */
const RESET_REASON = 'Reset Connection'

/** Address of the project documents (Hocuspocus, SPEC § 6.7), on the studio origin. */
function collabUrl() {
  return `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/collab`
}

/**
 * A project stored on the server: its Yjs document is kept by Hocuspocus over `/ws/collab`
 * (authenticated by the session cookie), and cached in this browser by y-indexeddb so that
 * edits survive a lost connection or a reload. Viewers and space managers get a read-only
 * connection: they may try things, nothing is sent. J4 adds presence on the same provider.
 */
export class ServerSource implements DocSource {
  readonly kind = 'server'
  private state: SaveState = 'saving'
  private listener: () => void = () => {}
  private readonly blobs = new Map<string, Blob>()

  private constructor(
    readonly id: string,
    readonly ydoc: Y.Doc,
    public access: ProjectAccess,
    readonly owner: ProjectOwner | null,
    private readonly socket: HocuspocusProviderWebsocket,
    readonly provider: HocuspocusProvider,
    private cache: IndexeddbPersistence | null,
  ) {
    provider.on('status', this.refresh)
    provider.on('synced', this.refresh)
    provider.on('unsyncedChanges', this.refresh)
    provider.on('authenticated', ({ scope }: { scope: string }) => {
      if (scope === 'readonly' && !this.readOnly) this.becomeReadOnly()
      this.refresh()
    })
    provider.on('authenticationFailed', ({ reason }: { reason: string }) => this.refused(reason))
    // A change of rights (sharing, trash…) closes the document on the server
    // (`Collab.reconnect`) but keeps the socket: open it again there, which authenticates again.
    provider.on('close', ({ event }: { event?: { reason?: string } }) => {
      if (event?.reason === RESET_REASON) setTimeout(() => socket.attach(provider), 0)
      // The provider is no longer synced once its own close handler ran.
      setTimeout(this.refresh, 0)
    })
    window.addEventListener('beforeunload', this.onBeforeUnload)
    // An open socket notices a lost network only after its ping times out (30 s): follow the
    // browser instead, and connect again as soon as it is back.
    window.addEventListener('offline', this.onOffline)
    window.addEventListener('online', this.onOnline)
    this.refresh()
  }

  private onOffline = () => {
    this.socket.disconnect()
    this.refresh()
  }

  private onOnline = () => {
    void this.socket.connect()
  }

  /**
   * The project, or null when it does not exist or is not visible to this account. Without a
   * connection, a project cached in this browser opens offline.
   */
  static async open(id: string): Promise<ServerSource | null> {
    const userId = currentUserId()
    if (!userId) return null
    let access: ProjectAccess
    let owner: ProjectOwner | null = null
    try {
      const body = await call(api.projects[':projectId'].$get({ param: { projectId: id } }))
      access = body.access
      owner = body.owner ? { ...body.owner, username: body.owner.username ?? '' } : null
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        await dropCache(id)
        return null
      }
      const cached =
        error instanceof ApiError && error.status === 0 ? cachedAccess(id, userId) : null
      if (!cached) {
        if (error instanceof ApiError && error.status === 403) return null
        throw error
      }
      access = cached
    }
    const ydoc = new Y.Doc()
    const writable = access === 'owner' || access === 'editor'
    // A read-only copy is never cached: trying things out must not outlive the tab.
    const cache = writable ? await openCache(id, ydoc, access, userId) : null
    if (!writable) await dropCache(id)
    const socket = new HocuspocusProviderWebsocket({ url: collabUrl() })
    const provider = new HocuspocusProvider({ websocketProvider: socket, name: id, document: ydoc })
    provider.attach()
    const outcome = await new Promise<'synced' | 'refused' | 'timeout'>((resolve) => {
      const done = (result: 'synced' | 'refused' | 'timeout') => {
        clearTimeout(timer)
        provider.off('synced', onSynced)
        provider.off('authenticationFailed', onRefused)
        resolve(result)
      }
      const onSynced = () => done('synced')
      const onRefused = ({ reason }: { reason: string }) => {
        if (reason === 'signed-out') reportSignedOut()
        done('refused')
      }
      const timer = setTimeout(() => done('timeout'), CONNECT_TIMEOUT)
      provider.on('synced', onSynced)
      provider.on('authenticationFailed', onRefused)
    })
    if (outcome === 'refused' || (outcome === 'timeout' && !hasProject(ydoc))) {
      provider.destroy()
      socket.destroy()
      await cache?.destroy()
      if (outcome === 'refused') await dropCache(id)
      ydoc.destroy()
      if (outcome === 'timeout') throw new ApiError(0, 'network')
      return null
    }
    return new ServerSource(id, ydoc, access, owner, socket, provider, cache)
  }

  get readOnly() {
    return this.access !== 'owner' && this.access !== 'editor'
  }

  /** Transactions applied by the provider (server) or the cache are not local edits. */
  isOwnOrigin(origin: unknown) {
    return origin === this.provider || (this.cache !== null && origin === this.cache)
  }

  onChange(listener: () => void) {
    this.listener = listener
  }

  saveState() {
    return this.state
  }

  private refresh = () => {
    const connected = this.provider.isSynced && this.provider.isAuthenticated
    const next: SaveState = this.readOnly
      ? 'readonly'
      : !connected
        ? 'offline'
        : this.provider.hasUnsyncedChanges
          ? 'saving'
          : 'saved'
    if (next === this.state) return
    this.state = next
    this.listener()
  }

  private becomeReadOnly() {
    this.access = 'viewer'
    const cache = this.cache
    this.cache = null
    void cache?.destroy().then(() => dropCache(this.id))
  }

  /** The server stopped accepting this tab: signed out, or the project is no longer visible. */
  private refused(reason: string) {
    if (reason === 'signed-out') reportSignedOut()
    if (!this.readOnly) this.becomeReadOnly()
    this.refresh()
  }

  edited() {
    this.refresh()
  }

  private onBeforeUnload = (event: BeforeUnloadEvent) => {
    // Without a cache (read-only), nothing is pending; with one, the edits are kept anyway,
    // but warn while they have not reached the server.
    if (!this.readOnly && this.provider.hasUnsyncedChanges && this.state !== 'offline') {
      event.preventDefault()
    }
  }

  async storeAsset(file: File) {
    const asset = await uploadAsset(this.id, file)
    this.blobs.set(asset.sha256, file)
    return asset
  }

  async loadAsset(hash: string) {
    const cached = this.blobs.get(hash)
    if (cached) return cached
    const blob = await downloadAsset(hash)
    if (blob) this.blobs.set(hash, blob)
    return blob
  }

  /** Resolves once the server has every local edit (or after a few seconds offline). */
  async flushed() {
    const deadline = Date.now() + CLOSE_TIMEOUT
    while (
      this.provider.hasUnsyncedChanges &&
      this.provider.isAuthenticated &&
      Date.now() < deadline
    ) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }

  async close() {
    window.removeEventListener('beforeunload', this.onBeforeUnload)
    window.removeEventListener('offline', this.onOffline)
    window.removeEventListener('online', this.onOnline)
    await this.flushed()
    this.provider.destroy()
    this.socket.destroy()
    await this.cache?.destroy()
  }
}
