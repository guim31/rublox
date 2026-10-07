import { getComponentDef, SCREEN_TYPE } from '@rublox/catalog'
import type { ComponentId, Locale, ProjectDoc } from '@rublox/schema'

/** Components of a project in reading order: screens in order, each screen's tree depth first. */
export function componentsInOrder(
  doc: ProjectDoc,
): { id: ComponentId; type: string; name: string }[] {
  const result: { id: ComponentId; type: string; name: string }[] = []
  for (const screenId of doc.screenOrder) {
    const screen = doc.screens[screenId]
    if (!screen) continue
    const visit = (id: ComponentId) => {
      const node = screen.components[id]
      if (!node) return
      result.push({ id, type: node.type, name: node.name })
      for (const child of node.children ?? []) visit(child)
    }
    visit(screen.rootId)
    for (const id of screen.nonVisual) visit(id)
  }
  return result
}

/** The name of the n-th component of a type (1-based), or the name it will get. */
export function nameOf(doc: ProjectDoc, type: string, n: number, locale: Locale): string {
  if (type === SCREEN_TYPE || type === 'screen') {
    const id = doc.screenOrder[n - 1]
    const screen = id ? doc.screens[id] : undefined
    if (screen) return screen.name
  } else {
    const found = componentsInOrder(doc).filter((c) => c.type === type)[n - 1]
    if (found) return found.name
  }
  const prefix = getComponentDef(type === 'screen' ? SCREEN_TYPE : type)?.strings[locale].prefix
  return `${prefix ?? type}${n}`
}

/**
 * Fills a tutorial text: `{{Button}}` is the name of the first Button, `{{Text.2}}` of the
 * second Text, `{{screen.2}}` of the second screen. Names follow the project's language.
 */
export function fillNames(text: string, doc: ProjectDoc): string {
  return text.replace(/\{\{\s*(\w+)(?:\.(\d+))?\s*\}\}/g, (_, type: string, n?: string) =>
    nameOf(doc, type, n ? Number(n) : 1, doc.meta.locale),
  )
}

export type Segment = { kind: 'text' | 'strong' | 'block'; text: string }

/** Splits `**bold**` and `[block label]` (drawn like a block) from plain text. */
export function richText(text: string): Segment[] {
  const segments: Segment[] = []
  const pattern = /\*\*(.+?)\*\*|\[(.+?)\]/g
  let last = 0
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (match.index > last) segments.push({ kind: 'text', text: text.slice(last, match.index) })
    if (match[1] !== undefined) segments.push({ kind: 'strong', text: match[1] })
    else segments.push({ kind: 'block', text: match[2] ?? '' })
    last = match.index + match[0].length
  }
  if (last < text.length) segments.push({ kind: 'text', text: text.slice(last) })
  return segments
}
