import { createComponent, createProject, createScreen, isLocalized } from '@rublox/catalog'
import type { Locale, ProjectDoc, UiMode } from '@rublox/schema'
import { newId } from '@rublox/schema'
import type { StarterSpec } from './model.ts'

/** A new project for a tutorial or a challenge, with its starting components. */
export function buildStarter(input: {
  name: string
  locale: Locale
  mode: UiMode
  spec?: StarterSpec
  id?: string
}): ProjectDoc {
  const doc = createProject({
    name: input.name,
    locale: input.locale,
    mode: input.mode,
    id: input.id,
  })
  const screenId = doc.screenOrder[0]
  const screen = screenId ? doc.screens[screenId] : undefined
  if (!screen) return doc
  const root = screen.components[screen.rootId]
  for (const entry of input.spec?.components ?? []) {
    const node = createComponent(
      entry.type,
      input.locale,
      Object.values(screen.components).map((c) => c.name),
    )
    for (const [key, value] of Object.entries(entry.props ?? {})) {
      node.props[key] = isLocalized(value) ? value[input.locale] : value
    }
    const id = newId()
    screen.components[id] = node
    root?.children?.push(id)
  }
  for (let index = 0; index < (input.spec?.screens ?? 0); index++) {
    const taken = Object.values(doc.screens).flatMap((s) =>
      Object.values(s.components).map((c) => c.name),
    )
    const created = createScreen(input.locale, taken)
    const id = newId()
    const rootId = newId()
    doc.screens[id] = {
      name: created.name,
      rootId,
      components: { [rootId]: { ...created.root, children: [] } },
      nonVisual: [],
    }
    doc.screenOrder.push(id)
  }
  return doc
}
