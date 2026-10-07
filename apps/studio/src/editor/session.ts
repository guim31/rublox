import {
  type Asset,
  type AssetKind,
  createUndoManager,
  hasProject,
  type ProjectDoc,
  yDocToProject,
} from '@rublox/schema'
import type * as Y from 'yjs'
import { currentUserId } from '../lib/session.ts'
import { Presence } from './presence.ts'
import {
  type DocSource,
  GuestSource,
  type SaveState,
  ServerSource,
  SUMMARY_ORIGIN,
} from './sources.ts'

export type { SaveState } from './sources.ts'

/** How many times a missing asset file is looked for again (1 s, 2 s… apart). */
const ASSET_RETRIES = 5

/** Transactions written by the Blockly ⇄ Yjs bridge (undoable, but not echoed back to Blockly). */
export const BLOCKLY_ORIGIN = { name: 'blockly' }

/**
 * An open project: its Yjs document (stored in this browser or on the server, see
 * `sources.ts`), the undo stack (SPEC § 6.4), and a JSON snapshot (`ProjectDoc`) that the
 * interface reads. Every edit goes through the schema operations on `ydoc`.
 */
export class ProjectSession {
  readonly undo: Y.UndoManager
  readonly ydoc: Y.Doc
  /** Who else has the project open (server projects only, SPEC § 4.9). */
  readonly presence: Presence | null
  private doc: ProjectDoc
  private readonly listeners = new Set<() => void>()
  private readonly assetUrls = new Map<string, string>()
  private assetsVersion = 0
  private disposed = false

  private constructor(
    readonly id: string,
    readonly source: DocSource,
  ) {
    const ydoc = source.ydoc
    this.ydoc = ydoc
    this.doc = yDocToProject(ydoc)
    // Only this tab's edits: the others' (provider, cache) are not taken back.
    this.undo = createUndoManager(ydoc, [BLOCKLY_ORIGIN])
    const awareness = source instanceof ServerSource ? source.provider.awareness : null
    this.presence = awareness ? new Presence(awareness, currentUserId()) : null
    this.undo.on('stack-item-added', () => this.emit())
    this.undo.on('stack-item-popped', () => this.emit())
    ydoc.on('update', this.onUpdate)
    source.onChange(() => this.emit())
    void this.loadAssets()
  }

  /**
   * Opens a project of this browser (`guest`) or of the server. Null when it does not exist
   * (or, on the server, is not visible to this account).
   */
  static async open(id: string, kind: 'guest' | 'server'): Promise<ProjectSession | null> {
    const source = kind === 'server' ? await ServerSource.open(id) : await GuestSource.open(id)
    if (!source) return null
    if (!hasProject(source.ydoc)) {
      await source.close()
      source.ydoc.destroy()
      return null
    }
    return new ProjectSession(id, source)
  }

  /** Viewers and space managers may look and try, not save. */
  get readOnly(): boolean {
    return this.source.access !== 'owner' && this.source.access !== 'editor'
  }

  private onUpdate = (_update: Uint8Array, origin: unknown) => {
    this.doc = yDocToProject(this.ydoc)
    if (!this.source.isOwnOrigin(origin) && origin !== SUMMARY_ORIGIN) this.source.edited()
    const ids = Object.keys(this.doc.assets)
    if (ids.some((id) => !this.assetUrls.has(id))) {
      // A new asset: its file gets a fresh round of tries.
      if (ids.some((id) => !this.seenAssets.has(id))) this.assetTries = 0
      void this.loadAssets()
    }
    this.emit()
  }

  /** Keeps a file for the project: in this browser, or sent to the server. */
  storeAsset(file: File, kind: AssetKind): Promise<Asset> {
    return this.source.storeAsset(file, kind)
  }

  /** The file of an asset, wherever this project keeps it. */
  loadAssetBlob(asset: Asset): Promise<Blob | undefined> {
    return this.source.loadAsset(asset.sha256)
  }

  /** Looks again for the files of assets that had none (copied in after a paste). */
  reloadAssets(): Promise<void> {
    return this.loadAssets()
  }

  private async loadAssets(): Promise<void> {
    let changed = false
    let missing = false
    for (const [id, asset] of Object.entries(this.doc.assets)) {
      this.seenAssets.add(id)
      if (this.assetUrls.has(id)) continue
      const blob = await this.source.loadAsset(asset.sha256)
      if (blob && !this.disposed) {
        this.assetUrls.set(id, URL.createObjectURL(blob))
        changed = true
      } else missing = true
    }
    if (changed) {
      this.assetsVersion += 1
      this.emit()
    }
    // Someone else's new asset can reach the document before its file reaches the server
    // (it is being sent): look again a few times.
    clearTimeout(this.assetRetry)
    if (missing && !this.disposed && this.assetTries < ASSET_RETRIES) {
      this.assetTries += 1
      this.assetRetry = setTimeout(() => void this.loadAssets(), 1000 * this.assetTries)
    } else if (!missing) this.assetTries = 0
  }

  private assetRetry?: ReturnType<typeof setTimeout>
  private assetTries = 0
  private readonly seenAssets = new Set<string>()

  /** URL of an image property: an asset of the project, or an https: address. */
  assetUrl = (value: string): string | undefined => {
    return this.assetUrls.get(value) ?? (/^https:\/\//i.test(value) ? value : undefined)
  }

  /** The asset files, for the preview (changes when an asset is added). */
  async assetBlobs(): Promise<Record<string, Blob>> {
    const result: Record<string, Blob> = {}
    for (const [id, asset] of Object.entries(this.doc.assets)) {
      const blob = await this.source.loadAsset(asset.sha256)
      if (blob) result[id] = blob
    }
    return result
  }

  getAssetsVersion = () => this.assetsVersion

  // External store for React

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getDoc = () => this.doc
  getSaveState = (): SaveState => this.source.saveState()
  canUndo = () => this.undo.canUndo()
  canRedo = () => this.undo.canRedo()

  private emit(): void {
    for (const listener of this.listeners) listener()
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    clearTimeout(this.assetRetry)
    this.ydoc.off('update', this.onUpdate)
    this.undo.destroy()
    this.presence?.dispose()
    for (const url of this.assetUrls.values()) URL.revokeObjectURL(url)
    await this.source.close()
    this.ydoc.destroy()
    this.listeners.clear()
  }
}
