import {
  componentLabel,
  createComponent,
  createScreen,
  getComponentDef,
  resolveProps,
} from '@rublox/catalog'
import type { Locale } from '@rublox/i18n'
import {
  addComponent,
  addScreen,
  type ComponentId,
  componentNames,
  duplicateComponent,
  locateComponent,
  moveComponent,
  type ProjectDoc,
  removeComponent,
  type ScreenId,
  screenNames,
} from '@rublox/schema'
import { canContain, parentOf } from './design/dnd.ts'
import type { ProjectSession } from './session.ts'
import { useEditor } from './store.ts'

export type Target = { parentId: ComponentId; index: number }

/**
 * Where a new component goes: inside the selected container, after the selected component,
 * or at the end of the screen.
 */
export function defaultTarget(
  doc: ProjectDoc,
  screenId: ScreenId,
  selected: ComponentId | null,
  type?: string,
): Target | null {
  const screen = doc.screens[screenId]
  if (!screen) throw new Error('no screen')
  const fits = (parentId: ComponentId) => !type || canContain(screen, parentId, type)
  const end = (parentId: ComponentId) => ({
    parentId,
    index: screen.components[parentId]?.children?.length ?? 0,
  })
  const node = selected ? screen.components[selected] : undefined
  if (node && selected) {
    if (getComponentDef(node.type)?.container && fits(selected)) return end(selected)
    // After the selection, or after the closest ancestor whose parent takes this type.
    let child: ComponentId = selected
    let at = parentOf(screen, child)
    while (at) {
      if (fits(at.parentId)) return { parentId: at.parentId, index: at.index + 1 }
      child = at.parentId
      at = parentOf(screen, child)
    }
  }
  // A sprite goes into the screen's first game scene.
  const parents = type ? getComponentDef(type)?.parents : undefined
  if (parents) {
    const host = Object.entries(screen.components).find(([, n]) => parents.includes(n.type))
    return host ? end(host[0]) : null
  }
  return fits(screen.rootId) ? end(screen.rootId) : null
}

/** Where a new child of a free-layout container goes: its center, a little off each time. */
function freePosition(doc: ProjectDoc, screenId: ScreenId, parentId: ComponentId) {
  const parent = doc.screens[screenId]?.components[parentId]
  if (!parent || !getComponentDef(parent.type)?.freeLayout) return undefined
  const values = resolveProps(parent.type, parent.props, doc.meta.locale)
  const shift = ((parent.children?.length ?? 0) % 6) * 16
  return {
    x: Math.round(Number(values.sceneWidth) / 2 + shift),
    y: Math.round(Number(values.sceneHeight) / 2 + shift),
  }
}

export function addComponentOfType(
  session: ProjectSession,
  screenId: ScreenId,
  type: string,
  locale: Locale,
  target?: Target,
  /** Where it lands in a free-layout container (a drop in a game scene). */
  point?: { x: number; y: number },
): ComponentId {
  const doc = session.getDoc()
  const node = createComponent(type, doc.meta.locale, componentNames(session.ydoc, screenId))
  // Non-visual components (timer, sound…) live under the screen, not in its tree.
  const visible = getComponentDef(type)?.visible !== false
  let id = ''
  session.ydoc.transact(() => {
    if (!visible) {
      id = addComponent(session.ydoc, screenId, node, null)
      return
    }
    let where = target ?? defaultTarget(doc, screenId, useEditor.getState().selected, type)
    // No game scene yet for a sprite: add one first, then the sprite inside.
    const parentType = getComponentDef(type)?.parents?.[0]
    if (!where && parentType) {
      const at = defaultTarget(doc, screenId, useEditor.getState().selected, parentType)
      if (!at) return
      const parent = createComponent(
        parentType,
        doc.meta.locale,
        componentNames(session.ydoc, screenId),
      )
      const parentId = addComponent(session.ydoc, screenId, parent, at.parentId, at.index)
      where = { parentId, index: 0 }
    }
    if (!where) return
    const position = freePosition(session.getDoc(), screenId, where.parentId)
    if (position && !point) Object.assign(node.props, position)
    if (point) Object.assign(node.props, point)
    id = addComponent(session.ydoc, screenId, node, where.parentId, where.index)
  })
  if (!id) return id
  useEditor.getState().select(id)
  useEditor.getState().announce(`${componentLabel(type, locale)} — ${node.name}`)
  return id
}

export function moveComponentTo(
  session: ProjectSession,
  screenId: ScreenId,
  id: ComponentId,
  target: Target,
) {
  moveComponent(session.ydoc, screenId, id, target.parentId, target.index)
}

export function deleteComponent(session: ProjectSession, screenId: ScreenId, id: ComponentId) {
  const screen = session.getDoc().screens[screenId]
  if (!screen || id === screen.rootId) return
  const at = locateComponent(session.ydoc, screenId, id)
  removeComponent(session.ydoc, screenId, id)
  // Select a neighbour, so that Delete can be pressed again.
  const parent = at?.parentId
    ? session.getDoc().screens[screenId]?.components[at.parentId]
    : undefined
  const next = parent?.children?.[Math.min(at?.index ?? 0, (parent.children?.length ?? 1) - 1)]
  useEditor.getState().select(next ?? at?.parentId ?? null)
}

export function duplicate(session: ProjectSession, screenId: ScreenId, id: ComponentId) {
  const screen = session.getDoc().screens[screenId]
  if (!screen || id === screen.rootId) return
  const copy = duplicateComponent(session.ydoc, screenId, id)
  useEditor.getState().select(copy)
}

/** Moves a component one step up or down among its siblings. */
export function nudge(session: ProjectSession, screenId: ScreenId, id: ComponentId, delta: -1 | 1) {
  const at = locateComponent(session.ydoc, screenId, id)
  if (!at?.parentId) return
  const siblings = session.getDoc().screens[screenId]?.components[at.parentId]?.children ?? []
  const index = at.index + delta
  if (index < 0 || index >= siblings.length) return
  moveComponent(session.ydoc, screenId, id, at.parentId, delta > 0 ? index + 1 : index)
}

export function addNewScreen(session: ProjectSession): ScreenId {
  const doc = session.getDoc()
  return addScreen(session.ydoc, createScreen(doc.meta.locale, screenNames(session.ydoc)))
}
