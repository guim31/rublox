import { createComponent, createProject } from '@rublox/catalog'
import type { BlocklyJson, ProjectDoc } from '@rublox/schema'

/** A project with one screen holding Bouton1, Texte1 and Champ1, plus a second screen. */
export function project(): {
  doc: ProjectDoc
  screen: string
  ids: Record<string, string>
} {
  const doc = createProject({
    name: 'Test',
    locale: 'fr',
    mode: 'junior',
    id: 'p',
  })
  const screen = doc.screenOrder[0]!
  const s = doc.screens[screen]!
  // Fixed ids, so that several calls describe the same project.
  const root = s.components[s.rootId]!
  delete s.components[s.rootId]
  s.rootId = 'root'
  s.components.root = root
  const ids: Record<string, string> = { root: s.rootId }
  for (const [key, type] of [
    ['button', 'Button'],
    ['text', 'Text'],
    ['input', 'TextInput'],
    ['image', 'Image'],
  ] as const) {
    const node = createComponent(
      type,
      'fr',
      Object.values(s.components).map((c) => c.name),
    )
    s.components[key] = node
    root.children!.push(key)
    ids[key] = key
  }
  doc.screenOrder.push('second')
  doc.screens.second = {
    name: 'Ecran2',
    rootId: 'r2',
    components: {
      r2: { type: 'Screen', name: 'Ecran2', props: {}, children: [] },
    },
    nonVisual: [],
  }
  return { doc, screen, ids }
}

export const text = (value: string): BlocklyJson => ({
  type: 'text',
  fields: { TEXT: value },
})
export const num = (value: number): BlocklyJson => ({
  type: 'math_number',
  fields: { NUM: value },
})

export function setText(component: string, value: BlocklyJson, next?: BlocklyJson): BlocklyJson {
  return {
    type: 'rx_Text_set',
    fields: { COMPONENT: component, PROP: 'text' },
    inputs: { VALUE: { block: value } },
    ...(next ? { next: { block: next } } : {}),
  }
}

export function onClick(component: string, body: BlocklyJson, id = 'evt'): BlocklyJson {
  return {
    type: 'rx_Button_on_click',
    id,
    x: 10,
    y: 10,
    fields: { COMPONENT: component },
    inputs: { DO: { block: body } },
  }
}
