import { type Asset, type AssetKind, setMeta, yDocToProject } from '@rublox/schema'
import type { IndexeddbPersistence } from 'y-indexeddb'
import * as Y from 'yjs'
import { ApiError, api, call } from '../lib/api.ts'
import { fromBase64, toBase64 } from '../lib/base64.ts'
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

export type SaveState = 'saved' | 'saving' | 'offline' | 'readonly'

/**
 * Where an open project's document lives and how it is saved: this browser (guest mode) or
 * the server (accounts). The session sees the same interface for both.
 */
export interface DocSource {
  readonly kind: 'guest' | 'server'
  readonly ydoc: Y.Doc
  /** Origin of the transactions the source applies itself (loading, server answers). */
  readonly origin: unknown
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

  get origin() {
    return this.persistence
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

const SERVER_ORIGIN = { name: 'server' }
const EMPTY_UPDATE = Y.encodeStateAsUpdate(new Y.Doc())
const PUSH_DELAY = 600
const PULL_INTERVAL = 15_000
const MAX_RETRY = 30_000

/**
 * A project stored on the server (J1). Edits are merged with Yjs: the studio sends what the
 * server lacks (relative to the last state vector it received) and gets back what it lacks.
 * Collaboration in real time comes with Hocuspocus (J4); until then the document is also
 * pulled every 15 seconds and when the tab comes back.
 */
export class ServerSource implements DocSource {
  readonly kind = 'server'
  readonly origin = SERVER_ORIGIN
  private serverVector: Uint8Array
  private state: SaveState
  private dirty = false
  private inflight: Promise<void> | null = null
  private timer?: ReturnType<typeof setTimeout>
  private retryDelay = 0
  private readonly pullTimer: ReturnType<typeof setInterval>
  private listener: () => void = () => {}
  private closed = false
  private readonly blobs = new Map<string, Blob>()

  private constructor(
    readonly id: string,
    readonly ydoc: Y.Doc,
    public access: ProjectAccess,
    readonly owner: ProjectOwner | null,
  ) {
    this.serverVector = Y.encodeStateVector(ydoc)
    this.state = this.readOnly ? 'readonly' : 'saved'
    this.pullTimer = setInterval(() => {
      if (document.visibilityState === 'visible') void this.sync()
    }, PULL_INTERVAL)
    window.addEventListener('focus', this.onFocus)
    window.addEventListener('online', this.onFocus)
    window.addEventListener('beforeunload', this.onBeforeUnload)
  }

  /** The project, or null when it does not exist or is not visible to this account. */
  static async open(id: string): Promise<ServerSource | null> {
    try {
      const body = await call(api.projects[':projectId'].$get({ param: { projectId: id } }))
      const ydoc = new Y.Doc()
      Y.applyUpdate(ydoc, fromBase64(body.state), SERVER_ORIGIN)
      const owner = body.owner ? { ...body.owner, username: body.owner.username ?? '' } : null
      return new ServerSource(id, ydoc, body.access, owner)
    } catch (error) {
      if (error instanceof ApiError && (error.status === 404 || error.status === 403)) return null
      throw error
    }
  }

  get readOnly() {
    return this.access !== 'owner' && this.access !== 'editor'
  }

  onChange(listener: () => void) {
    this.listener = listener
  }

  saveState() {
    return this.state
  }

  private setState(state: SaveState) {
    if (this.state === state) return
    this.state = state
    this.listener()
  }

  edited() {
    if (this.readOnly) return
    this.dirty = true
    if (this.state !== 'offline') this.setState('saving')
    this.schedule(PUSH_DELAY)
  }

  private schedule(delay: number) {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.sync(), delay)
  }

  private onFocus = () => void this.sync()

  private onBeforeUnload = (event: BeforeUnloadEvent) => {
    if (this.dirty || this.inflight) event.preventDefault()
  }

  /** One round trip; edits made meanwhile leave with the next one. */
  async sync(): Promise<void> {
    if (this.closed && !this.dirty) return
    if (this.inflight) {
      await this.inflight
      if (!this.dirty) return
    }
    const sentVector = Y.encodeStateVector(this.ydoc)
    const update = this.readOnly
      ? EMPTY_UPDATE
      : Y.encodeStateAsUpdate(this.ydoc, this.serverVector)
    const pushing = this.dirty
    this.dirty = false
    this.inflight = (async () => {
      try {
        const answer = await call(
          api.projects[':projectId'].sync.$post({
            param: { projectId: this.id },
            json: { update: toBase64(update), stateVector: toBase64(sentVector) },
          }),
        )
        Y.applyUpdate(this.ydoc, fromBase64(answer.update), SERVER_ORIGIN)
        this.serverVector = sentVector
        this.retryDelay = 0
        this.setState(this.readOnly ? 'readonly' : this.dirty ? 'saving' : 'saved')
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          this.access = 'viewer'
          this.setState('readonly')
          return
        }
        if (error instanceof ApiError && error.status === 401) return
        // Network or server trouble: keep the edits and try again, waiting longer each time.
        if (pushing) this.dirty = true
        this.setState('offline')
        this.retryDelay = Math.min(MAX_RETRY, this.retryDelay ? this.retryDelay * 2 : 2000)
        if (!this.closed) this.schedule(this.retryDelay)
      } finally {
        this.inflight = null
      }
    })()
    await this.inflight
    if (this.dirty && !this.closed && this.retryDelay === 0) this.schedule(PUSH_DELAY)
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

  async close() {
    clearTimeout(this.timer)
    clearInterval(this.pullTimer)
    window.removeEventListener('focus', this.onFocus)
    window.removeEventListener('online', this.onFocus)
    window.removeEventListener('beforeunload', this.onBeforeUnload)
    if (this.dirty) await this.sync().catch(() => {})
    this.closed = true
  }
}
