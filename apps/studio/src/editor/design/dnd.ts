import { getComponentDef } from '@rublox/catalog'
import type { ComponentId, Screen } from '@rublox/schema'
import { isTouchDragging } from './touch-drag.ts'

/** What is being dragged: a new component from the palette, or an existing one. */
export type DragPayload = { kind: 'new'; type: string } | { kind: 'move'; id: ComponentId }

export const DRAG_MIME = 'application/x-rublox'

// dataTransfer cannot be read during dragover: keep the payload here too.
let current: DragPayload | null = null

export function startDrag(event: React.DragEvent, payload: DragPayload): void {
  // A finger is dragging through the pointer fallback (`touch-drag.ts`): no native drag.
  if (isTouchDragging()) {
    event.preventDefault()
    return
  }
  current = payload
  event.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload))
  event.dataTransfer.effectAllowed = payload.kind === 'new' ? 'copy' : 'move'
}

/** Set by the touch fallback, which has no `dataTransfer` of its own. */
export function setDrag(payload: DragPayload | null): void {
  current = payload
}

export function currentDrag(): DragPayload | null {
  return current
}

export function endDrag(): void {
  current = null
}

export type DropTarget = { parentId: ComponentId; index: number }

export function parentOf(
  screen: Screen,
  id: ComponentId,
): { parentId: ComponentId; index: number } | null {
  for (const [parentId, node] of Object.entries(screen.components)) {
    const index = node.children?.indexOf(id) ?? -1
    if (index >= 0) return { parentId, index }
  }
  return null
}

export function isDescendant(screen: Screen, id: ComponentId, ancestor: ComponentId): boolean {
  if (id === ancestor) return true
  const children = screen.components[ancestor]?.children ?? []
  return children.some((child) => isDescendant(screen, id, child))
}

export function isContainer(screen: Screen, id: ComponentId): boolean {
  const node = screen.components[id]
  return Boolean(node && getComponentDef(node.type)?.container)
}

/** Direction in which a container lays out its children. */
export function axisOf(screen: Screen, id: ComponentId): 'x' | 'y' {
  return screen.components[id]?.type === 'Row' ? 'x' : 'y'
}

/** A drop target is valid unless it puts a component inside itself. */
export function validTarget(screen: Screen, payload: DragPayload, target: DropTarget): boolean {
  if (payload.kind === 'new') return true
  if (payload.id === screen.rootId) return false
  return !isDescendant(screen, target.parentId, payload.id)
}

/**
 * Index among `children` (their rects) where a point falls, along an axis: before the first
 * child whose middle is past the point.
 */
export function indexAt(
  rects: DOMRect[],
  point: { x: number; y: number },
  axis: 'x' | 'y',
): number {
  for (let index = 0; index < rects.length; index++) {
    const rect = rects[index]
    if (!rect) continue
    const middle = axis === 'x' ? rect.left + rect.width / 2 : rect.top + rect.height / 2
    if ((axis === 'x' ? point.x : point.y) < middle) return index
  }
  return rects.length
}
