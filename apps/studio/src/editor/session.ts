import { hasProject, type ProjectDoc, setMeta, Y_ROOTS, yDocToProject } from '@rublox/schema'
import type { IndexeddbPersistence } from 'y-indexeddb'
import * as Y from 'yjs'
import { loadAssetFile } from '../storage/assets.ts'
import { getSummary, openProjectDoc, saveSummary, summarize } from '../storage/projects.ts'

/** Transactions written by the Blockly ⇄ Yjs bridge (undoable, but not echoed back to Blockly). */
export const BLOCKLY_ORIGIN = { name: 'blockly' }

/** Bookkeeping writes (`updatedAt`): stored, but neither undoable nor counted as an edit. */
const SUMMARY_ORIGIN = { name: 'summary' }

export type SaveState = 'saved' | 'saving'

/**
 * An open project: its Yjs document stored in IndexedDB, the undo stack (SPEC § 6.4), and a
 * JSON snapshot (`ProjectDoc`) that the interface reads. Every edit goes through the schema
 * operations on `ydoc`.
 */
export class ProjectSession {
  readonly undo: Y.UndoManager
  private doc: ProjectDoc
  private readonly listeners = new Set<() => void>()
  private saveState: SaveState = 'saved'
  private saveTimer?: ReturnType<typeof setTimeout>
  private summaryTimer?: ReturnType<typeof setTimeout>
  private readonly assetUrls = new Map<string, string>()
  private assetsVersion = 0
  private disposed = false

  private constructor(
    readonly id: string,
    readonly ydoc: Y.Doc,
    private readonly persistence: IndexeddbPersistence,
  ) {
    this.doc = yDocToProject(ydoc)
    this.undo = new Y.UndoManager(
      [
        ydoc.getMap(Y_ROOTS.meta),
        ydoc.getMap(Y_ROOTS.settings),
        ydoc.getArray(Y_ROOTS.screenOrder),
        ydoc.getMap(Y_ROOTS.screens),
        ydoc.getMap(Y_ROOTS.blocks),
        ydoc.getMap(Y_ROOTS.variables),
        ydoc.getMap(Y_ROOTS.assets),
      ],
      { captureTimeout: 400, trackedOrigins: new Set([null, BLOCKLY_ORIGIN]) },
    )
    this.undo.on('stack-item-added', () => this.emit())
    this.undo.on('stack-item-popped', () => this.emit())
    ydoc.on('update', this.onUpdate)
    void this.loadAssets()
  }

  static async open(id: string): Promise<ProjectSession | null> {
    const { ydoc, persistence } = await openProjectDoc(id)
    if (!hasProject(ydoc)) {
      await persistence.destroy()
      ydoc.destroy()
      return null
    }
    return new ProjectSession(id, ydoc, persistence)
  }

  private onUpdate = (_update: Uint8Array, origin: unknown) => {
    this.doc = yDocToProject(this.ydoc)
    if (origin !== this.persistence && origin !== SUMMARY_ORIGIN) {
      this.saveState = 'saving'
      clearTimeout(this.saveTimer)
      // y-indexeddb stores each update right away; show "Saving…" briefly so it is noticed.
      this.saveTimer = setTimeout(() => {
        this.saveState = 'saved'
        this.emit()
      }, 450)
      clearTimeout(this.summaryTimer)
      this.summaryTimer = setTimeout(() => void this.writeSummary(), 600)
    }
    if (Object.keys(this.doc.assets).some((id) => !this.assetUrls.has(id))) void this.loadAssets()
    this.emit()
  }

  private async writeSummary(): Promise<void> {
    if (this.disposed) return
    setMeta(this.ydoc, { updatedAt: new Date().toISOString() }, SUMMARY_ORIGIN)
    const previous = await getSummary(this.id)
    await saveSummary(summarize(this.doc, previous))
  }

  private async loadAssets(): Promise<void> {
    let changed = false
    for (const [id, asset] of Object.entries(this.doc.assets)) {
      if (this.assetUrls.has(id)) continue
      const blob = await loadAssetFile(asset.sha256)
      if (blob && !this.disposed) {
        this.assetUrls.set(id, URL.createObjectURL(blob))
        changed = true
      }
    }
    if (changed) {
      this.assetsVersion += 1
      this.emit()
    }
  }

  /** URL of an image property: an asset of the project, or an https: address. */
  assetUrl = (value: string): string | undefined => {
    return this.assetUrls.get(value) ?? (/^https:\/\//i.test(value) ? value : undefined)
  }

  /** The asset files, for the preview (changes when an asset is added). */
  async assetBlobs(): Promise<Record<string, Blob>> {
    const result: Record<string, Blob> = {}
    for (const [id, asset] of Object.entries(this.doc.assets)) {
      const blob = await loadAssetFile(asset.sha256)
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
  getSaveState = () => this.saveState
  canUndo = () => this.undo.canUndo()
  canRedo = () => this.undo.canRedo()

  private emit(): void {
    for (const listener of this.listeners) listener()
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    clearTimeout(this.saveTimer)
    if (this.summaryTimer) {
      clearTimeout(this.summaryTimer)
      await this.writeSummary()
    }
    this.disposed = true
    this.ydoc.off('update', this.onUpdate)
    this.undo.destroy()
    for (const url of this.assetUrls.values()) URL.revokeObjectURL(url)
    await this.persistence.destroy()
    this.ydoc.destroy()
    this.listeners.clear()
  }
}
