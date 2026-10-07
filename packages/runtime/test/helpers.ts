import { generateProjectCode } from '@rublox/blocks'
import { createComponent, createProject } from '@rublox/catalog'
import type { BlocklyJson, ProjectDoc } from '@rublox/schema'
import { Engine, type EngineOptions, type LogEntry, type ModuleLoader } from '../src/index.ts'

/** Loads generated code as a `data:` module: Node has no `blob:` imports. */
export const dataLoader: ModuleLoader = async (code) => {
  const url = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  const module = await import(/* @vite-ignore */ url)
  return { run: module.default, url, dispose: () => {} }
}

export function project() {
  const doc = createProject({
    name: 'Test',
    locale: 'fr',
    mode: 'junior',
    id: 'p',
  })
  const home = doc.screenOrder[0]!
  const screen = doc.screens[home]!
  for (const [id, type] of [
    ['button', 'Button'],
    ['text', 'Text'],
    ['input', 'TextInput'],
  ] as const) {
    screen.components[id] = createComponent(
      type,
      'fr',
      Object.values(screen.components).map((c) => c.name),
    )
    screen.components[screen.rootId]!.children!.push(id)
  }
  doc.screenOrder.push('second')
  doc.screens.second = {
    name: 'Ecran2',
    rootId: 'r2',
    components: {
      r2: { type: 'Screen', name: 'Ecran2', props: {}, children: ['back'] },
      back: { type: 'Button', name: 'Retour', props: { text: 'Retour' } },
    },
    nonVisual: [],
  }
  doc.variables.app.push({ id: 'v1', name: 'score', initial: 0 })
  return { doc, home }
}

export const text = (value: string): BlocklyJson => ({
  type: 'text',
  fields: { TEXT: value },
})
export const num = (value: number): BlocklyJson => ({
  type: 'math_number',
  fields: { NUM: value },
})
export const setText = (
  component: string,
  value: BlocklyJson,
  extra: Partial<BlocklyJson> = {},
): BlocklyJson => ({
  type: 'rx_Text_set',
  fields: { COMPONENT: component, PROP: 'text' },
  inputs: { VALUE: { block: value } },
  ...extra,
})
export const onClick = (component: string, body: BlocklyJson, id = 'evt'): BlocklyJson => ({
  type: 'rx_Button_on_click',
  id,
  x: 0,
  y: 0,
  fields: { COMPONENT: component },
  inputs: { DO: { block: body } },
})

export function engineFor(doc: ProjectDoc, options: Partial<EngineOptions> = {}) {
  const logs: LogEntry[] = []
  const engine = new Engine({
    doc,
    code: generateProjectCode(doc),
    host: { log: (entry) => logs.push(entry) },
    loadModule: dataLoader,
    storage: null,
    ...options,
  })
  return { engine, logs }
}

export const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** The value of a component's property on the visible screen. */
export function value(engine: Engine, component: string, prop: string): unknown {
  return engine.getSnapshot().screen?.overrides.get(component)?.[prop]
}
