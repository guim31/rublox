import { componentLabel, createComponent, createScreen, getComponentDef } from '@rublox/catalog'
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
): Target {
  const screen = doc.screens[screenId]
  if (!screen) throw new Error('no screen')
  const node = selected ? screen.components[selected] : undefined
  if (node && selected) {
    if (getComponentDef(node.type)?.container) {
      return { parentId: selected, index: node.children?.length ?? 0 }
    }
    for (const [parentId, parent] of Object.entries(screen.components)) {
      const index = parent.children?.indexOf(selected) ?? -1
      if (index >= 0) return { parentId, index: index + 1 }
    }
  }
  const root = screen.components[screen.rootId]
  return { parentId: screen.rootId, index: root?.children?.length ?? 0 }
}

export function addComponentOfType(
  session: ProjectSession,
  screenId: ScreenId,
  type: string,
  locale: Locale,
  target?: Target,
): ComponentId {
  const doc = session.getDoc()
  const where = target ?? defaultTarget(doc, screenId, useEditor.getState().selected)
  const node = createComponent(type, doc.meta.locale, componentNames(session.ydoc, screenId))
  const id = addComponent(session.ydoc, screenId, node, where.parentId, where.index)
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
