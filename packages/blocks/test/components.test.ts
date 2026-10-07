import { COMPONENTS, type ComponentDef, createComponent, createProject } from '@rublox/catalog'
import type { BlocklyJson } from '@rublox/schema'
import { describe, expect, it } from 'vitest'
import {
  BLOCK_TYPES,
  contextFromDoc,
  eventBlockType,
  generateWorkspaceCode,
  getterBlockType,
  methodBlockType,
  propertyKeys,
  setterBlockType,
} from '../src/index.ts'

const SAMPLE: Record<string, BlocklyJson> = {
  string: { type: 'text', fields: { TEXT: 'abc' } },
  number: { type: 'math_number', fields: { NUM: 2 } },
  boolean: { type: 'logic_boolean', fields: { BOOL: 'TRUE' } },
  color: { type: 'colour_picker', fields: { COLOUR: '#ff6b5c' } },
  list: { type: 'text', fields: { TEXT: 'a, b' } },
  date: { type: 'text', fields: { TEXT: '2026-10-06' } },
  time: { type: 'text', fields: { TEXT: '09:30' } },
  size: { type: 'math_number', fields: { NUM: 120 } },
  spacing: { type: 'math_number', fields: { NUM: 8 } },
  asset: { type: 'text', fields: { TEXT: 'https://example.com/a.png' } },
}

const sample = (kind: string): BlocklyJson =>
  SAMPLE[kind] ?? { type: 'text', fields: { TEXT: 'x' } }

/** A chain of statements, from a list of blocks. */
function chain(blocks: BlocklyJson[]): BlocklyJson | undefined {
  const [first, ...rest] = blocks
  if (!first) return undefined
  const next = chain(rest)
  return next ? { ...first, next: { block: next } } : first
}

/**
 * One stack per event of the component (logging each of its values), and one "when the
 * screen opens" stack that sets, calls and reads everything else.
 */
function stacksFor(def: ComponentDef, id: string, rootId: string): Record<string, BlocklyJson> {
  const stacks: Record<string, BlocklyJson> = {}
  let y = 0
  for (const [event, info] of Object.entries(def.events)) {
    y += 200
    const logs = Object.keys(info.args).map(
      (arg): BlocklyJson => ({
        type: BLOCK_TYPES.log,
        inputs: { VALUE: { block: { type: BLOCK_TYPES.eventValue, fields: { ARG: arg } } } },
      }),
    )
    const body = chain(
      logs.length
        ? logs
        : [{ type: BLOCK_TYPES.log, inputs: { VALUE: { block: sample('string') } } }],
    )
    stacks[`on_${event}`] = {
      type: eventBlockType(def.type, event),
      id: `on_${event}`,
      x: 0,
      y,
      fields: { COMPONENT: id },
      inputs: body ? { DO: { block: body } } : {},
    }
  }
  const statements: BlocklyJson[] = []
  for (const { key } of propertyKeys(def, 'set')) {
    statements.push({
      type: setterBlockType(def.type),
      fields: { COMPONENT: id, PROP: key },
      inputs: { VALUE: { block: sample(def.props[key]?.kind ?? 'string') } },
    })
  }
  for (const [name, method] of Object.entries(def.methods)) {
    const inputs = Object.fromEntries(
      Object.values(method.args).map((arg, index) => [`ARG${index}`, { block: sample(arg.kind) }]),
    )
    const call: BlocklyJson = {
      type: methodBlockType(def.type, name),
      fields: { COMPONENT: id },
      inputs,
    }
    statements.push(
      method.returns ? { type: BLOCK_TYPES.log, inputs: { VALUE: { block: call } } } : call,
    )
  }
  for (const { key } of propertyKeys(def, 'get')) {
    statements.push({
      type: BLOCK_TYPES.log,
      inputs: {
        VALUE: { block: { type: getterBlockType(def.type), fields: { COMPONENT: id, PROP: key } } },
      },
    })
  }
  const body = chain(statements)
  if (body) {
    stacks.open = {
      type: 'rx_Screen_on_open',
      x: 400,
      y: 0,
      fields: { COMPONENT: rootId },
      inputs: { DO: { block: body } },
    }
  }
  return stacks
}

function compile(code: string) {
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor
  return new AsyncFunction(code.replace('export default async function', 'return async function'))
}

describe('generated code of each component', () => {
  it.each(COMPONENTS.filter((def) => def.palette).map((def) => [def.type, def] as const))(
    '%s',
    (_, def) => {
      const doc = createProject({ name: 'T', locale: 'fr', mode: 'studio', id: 'p' })
      const screenId = doc.screenOrder[0] ?? ''
      const screen = doc.screens[screenId]
      if (!screen) throw new Error('no screen')
      const node = createComponent(def.type, 'fr', [screen.name])
      screen.components.c = node
      if (def.visible) screen.components[screen.rootId]?.children?.push('c')
      else screen.nonVisual.push('c')
      const { code } = generateWorkspaceCode(
        stacksFor(def, 'c', screen.rootId),
        contextFromDoc(doc, screenId),
      )
      compile(code)
      expect(code).not.toContain('composant supprimé')
      if (Object.values(def.events).some((e) => Object.keys(e.args).length))
        expect(code).toContain('event.')
      expect(code.slice(code.indexOf('export default'))).toMatchSnapshot()
    },
  )
})
