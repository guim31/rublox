import { getComponentDef } from '@rublox/catalog'
import {
  type Asset,
  addAsset,
  type ComponentClip,
  type ComponentId,
  copyComponents,
  pasteComponents,
  removeComponent,
  type ScreenId,
} from '@rublox/schema'
import { toast } from 'sonner'
import { errorMessage } from '../lib/errors.ts'
import { i18next } from '../lib/i18n.ts'
import { loadAssetFile } from '../storage/assets.ts'
import { defaultTarget } from './actions.ts'
import type { ProjectSession } from './session.ts'
import { useEditor } from './store.ts'

/**
 * Copy and paste of components (SPEC § 4.1), between screens and between projects. The
 * clipboard holds JSON: the system clipboard when the browser lets us write it (copy and
 * paste events), and this browser's storage, so that another project opened later finds it.
 */
export const CLIP_FORMAT = 'rublox/components'
const STORAGE_KEY = 'rublox:clipboard'

export type ClipPayload = {
  format: typeof CLIP_FORMAT
  version: 1
  clips: ComponentClip[]
  /** Assets the copied components use (their files are found again by hash). */
  assets: Record<string, Asset>
}

/** What a copy or a cut takes: the selection, or the selected component. */
export function selectedIds(): ComponentId[] {
  const { selection, selected } = useEditor.getState()
  if (selection.length) return selection
  return selected ? [selected] : []
}

export function makePayload(
  session: ProjectSession,
  screenId: ScreenId,
  ids: ComponentId[],
): ClipPayload | null {
  const clips = copyComponents(session.ydoc, screenId, ids)
  if (!clips.length) return null
  const doc = session.getDoc()
  const text = JSON.stringify(clips)
  const assets = Object.fromEntries(
    Object.entries(doc.assets).filter(([id]) => text.includes(`"${id}"`)),
  )
  return { format: CLIP_FORMAT, version: 1, clips, assets }
}

function remember(text: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, text)
  } catch {
    // Storage full or blocked: the system clipboard still has it.
  }
}

export function readPayload(text: string | null | undefined): ClipPayload | null {
  if (!text) return null
  try {
    const value = JSON.parse(text) as Partial<ClipPayload>
    if (value?.format !== CLIP_FORMAT || !Array.isArray(value.clips)) return null
    return { format: CLIP_FORMAT, version: 1, clips: value.clips, assets: value.assets ?? {} }
  } catch {
    return null
  }
}

/** Copies (or cuts) the selection; returns the JSON written, or null if nothing was selected. */
export function copySelection(
  session: ProjectSession,
  screenId: ScreenId,
  cut = false,
): string | null {
  const payload = makePayload(session, screenId, selectedIds())
  if (!payload) return null
  const text = JSON.stringify(payload)
  remember(text)
  if (cut) {
    session.ydoc.transact(() => {
      for (const clip of payload.clips) removeComponent(session.ydoc, screenId, clip.rootId)
    })
    useEditor.getState().select(null)
  }
  return text
}

/** The last copy made in this browser (for the command palette, without a paste event). */
export function storedPayload(): ClipPayload | null {
  try {
    return readPayload(localStorage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

/** Pastes after the selection (or inside the selected container); selects what was pasted. */
export function pastePayload(
  session: ProjectSession,
  screenId: ScreenId,
  payload: ClipPayload,
): ComponentId[] {
  const doc = session.getDoc()
  const target = defaultTarget(doc, screenId, useEditor.getState().selected)
  if (!target) return []
  const missing = Object.entries(payload.assets)
    .filter(([id]) => !doc.assets[id])
    .map(([, asset]) => asset)
  let pasted: ComponentId[] = []
  session.ydoc.transact(() => {
    for (const [id, asset] of Object.entries(payload.assets)) {
      if (!doc.assets[id]) addAsset(session.ydoc, asset, id)
    }
    pasted = pasteComponents(
      session.ydoc,
      screenId,
      payload.clips,
      target.parentId,
      target.index,
      (type) => getComponentDef(type)?.visible !== false,
    )
  })
  const editor = useEditor.getState()
  editor.select(pasted.at(-1) ?? null)
  if (pasted.length > 1) useEditor.setState({ selection: pasted })
  if (missing.length && pasted.length) void copyAssetFiles(session, missing)
  return pasted
}

/**
 * The files of pasted assets that the project did not have: copied into it (sent to the
 * server for a server project, kept in this browser for a guest one), so that they belong to
 * its owner, count in their quota, go with its export and publication, and outlive the
 * project they come from. The file is read from this browser (a guest project) or the server.
 */
async function copyAssetFiles(session: ProjectSession, assets: Asset[]): Promise<void> {
  for (const asset of assets) {
    try {
      const blob = (await loadAssetFile(asset.sha256)) ?? (await session.loadAssetBlob(asset))
      if (!blob) {
        toast.error(i18next.t('collab.paste.missing', { name: asset.name }))
        continue
      }
      await session.storeAsset(
        new File([blob], asset.name, { type: asset.mime || blob.type }),
        asset.kind,
      )
    } catch (error) {
      toast.error(i18next.t('collab.paste.failed', { name: asset.name }), {
        description: errorMessage(i18next.t, error),
      })
    }
  }
  await session.reloadAssets()
}
