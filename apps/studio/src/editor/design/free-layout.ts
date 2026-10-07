import { getComponentDef, resolveProps } from '@rublox/catalog'
import { type ComponentId, type Screen, type ScreenId, setProp } from '@rublox/schema'
import type { ProjectSession } from '../session.ts'

/**
 * Components placed freely by `x` and `y` in a free-layout container (the children of a game
 * scene, SPEC § 4.1): helpers for the canvas and the keyboard.
 */

export function parentId(screen: Screen, id: ComponentId): ComponentId | undefined {
  for (const [candidate, node] of Object.entries(screen.components)) {
    if (node.children?.includes(id)) return candidate
  }
  return undefined
}

export function isFreeLayout(screen: Screen, id: ComponentId | undefined): boolean {
  const node = id ? screen.components[id] : undefined
  return Boolean(node && getComponentDef(node.type)?.freeLayout)
}

/** The free-layout container of a component, when it sits in one. */
export function freeParent(screen: Screen, id: ComponentId | null): ComponentId | undefined {
  if (!id) return undefined
  const parent = parentId(screen, id)
  return parent && isFreeLayout(screen, parent) ? parent : undefined
}

/** What the canvas handles can change on a free component. */
export function freeAbilities(type: string) {
  const props = getComponentDef(type)?.props ?? {}
  return {
    resize:
      'width' in props && 'height' in props
        ? ('box' as const)
        : 'size' in props
          ? ('size' as const)
          : null,
    rotate: 'rotation' in props,
  }
}

/** The values of a component, defaults resolved, in the project's language. */
export function valuesOf(screen: Screen, id: ComponentId, locale: 'fr' | 'en') {
  const node = screen.components[id]
  return node ? resolveProps(node.type, node.props, locale) : {}
}

const round = (n: number) => Math.round(n)

/** Writes several properties in one transaction (one undo step). */
export function setProps(
  session: ProjectSession,
  screenId: ScreenId,
  id: ComponentId,
  props: Record<string, number>,
): void {
  session.ydoc.transact(() => {
    for (const [key, value] of Object.entries(props)) {
      setProp(session.ydoc, screenId, id, key, Number.isFinite(value) ? round(value) : undefined)
    }
  })
}

/**
 * The keyboard on a free component: arrows move it (Shift: 10 at a time), Alt + arrows
 * resize it, R / Shift + R turn it. Returns whether the key was used.
 */
export function freeKey(
  session: ProjectSession,
  screenId: ScreenId,
  id: ComponentId,
  event: KeyboardEvent,
): boolean {
  const doc = session.getDoc()
  const screen = doc.screens[screenId]
  const node = screen?.components[id]
  if (!screen || !node || node.locked || !freeParent(screen, id)) return false
  const values = valuesOf(screen, id, doc.meta.locale)
  const n = (key: string) => Number(values[key]) || 0
  const step = event.shiftKey ? 10 : 1
  const arrows: Record<string, [number, number]> = {
    arrowleft: [-1, 0],
    arrowright: [1, 0],
    arrowup: [0, -1],
    arrowdown: [0, 1],
  }
  const key = event.key.toLowerCase()
  const arrow = arrows[key]
  const abilities = freeAbilities(node.type)
  if (arrow && event.altKey) {
    if (abilities.resize === 'box') {
      setProps(session, screenId, id, {
        width: Math.max(1, n('width') + arrow[0] * step),
        height: Math.max(1, n('height') - arrow[1] * step),
      })
    } else if (abilities.resize === 'size') {
      setProps(session, screenId, id, {
        size: Math.max(1, n('size') + (arrow[0] - arrow[1]) * step),
      })
    } else return false
    return true
  }
  if (arrow) {
    setProps(session, screenId, id, { x: n('x') + arrow[0] * step, y: n('y') + arrow[1] * step })
    return true
  }
  if (key === 'r' && abilities.rotate && !event.metaKey && !event.ctrlKey) {
    setProps(session, screenId, id, { rotation: n('rotation') + (event.shiftKey ? -15 : 15) })
    return true
  }
  return false
}
