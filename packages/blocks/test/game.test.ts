import { createComponent, createProject } from '@rublox/catalog'
import type { BlocklyJson } from '@rublox/schema'
import { describe, expect, it } from 'vitest'
import {
  BLOCK_TYPES,
  buildToolbox,
  contextFromDoc,
  generateWorkspaceCode,
  headlessWorkspace,
} from '../src/index.ts'

/** A screen with a scene holding Panier and Pomme, and a score text. */
function gameProject() {
  const doc = createProject({ name: 'Jeu', locale: 'fr', mode: 'junior', id: 'g' })
  const screenId = doc.screenOrder[0]!
  const screen = doc.screens[screenId]!
  const add = (id: string, type: string, parent: string, name: string) => {
    screen.components[id] = { ...createComponent(type, 'fr', []), name }
    screen.components[parent]!.children!.push(id)
  }
  add('scene', 'GameScene', screen.rootId, 'Scene1')
  add('basket', 'Sprite', 'scene', 'Panier')
  add('apple', 'Sprite', 'scene', 'Pomme')
  add('score', 'SceneText', 'scene', 'Score')
  return { doc, screenId }
}

function generate(stacks: Record<string, BlocklyJson>) {
  const { doc, screenId } = gameProject()
  const { code } = generateWorkspaceCode(stacks, contextFromDoc(doc, screenId), [
    { id: 'v1', name: 'score' },
  ])
  // Valid JavaScript.
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor
  new AsyncFunction(code.replace('export default async function', 'return async function'))
  return code.slice(code.indexOf('export default'))
}

const arg = (type: string, event: string, name: string): BlocklyJson => ({
  type: BLOCK_TYPES.eventArg,
  extraState: { type, event, arg: name },
})

describe('game blocks', () => {
  it('passes the clone itself and the event values to handlers', () => {
    const code = generate({
      hit: {
        type: 'rx_Sprite_on_hit',
        x: 0,
        y: 0,
        fields: { COMPONENT: 'apple', FILTER: 'basket' },
        inputs: {
          DO: {
            block: {
              type: 'rx_Sprite_call_delete',
              fields: { COMPONENT: 'apple' },
              next: {
                block: {
                  type: 'rx_log',
                  inputs: { VALUE: { block: arg('Sprite', 'hit', 'other') } },
                },
              },
            },
          },
        },
      },
      edge: {
        type: 'rx_Sprite_on_edge',
        x: 0,
        y: 200,
        fields: { COMPONENT: 'apple', FILTER: 'bottom' },
        inputs: {
          DO: { block: { type: 'rx_Sprite_call_delete', fields: { COMPONENT: 'apple' } } },
        },
      },
      frame: {
        type: 'rx_GameScene_on_frame',
        x: 0,
        y: 400,
        fields: { COMPONENT: 'scene' },
        inputs: {
          DO: {
            block: {
              type: 'rx_Sprite_set',
              fields: { COMPONENT: 'basket', PROP: 'rotation' },
              inputs: { VALUE: { block: arg('GameScene', 'frame', 'dt') } },
            },
          },
        },
      },
    })
    expect(code).toContain('Pomme.onHit(Panier, async (Pomme, other) => {')
    expect(code).toContain("Pomme.onEdge('bottom', async (Pomme, edge) => {")
    expect(code).toContain('Scene1.onFrame(async (dt) => {')
    expect(code).toContain('Panier.rotation = dt;')
    expect(code).toContain('rx.log(other);')
    expect(code).toMatchSnapshot()
  })

  it('uses null for "any" and undefined for a value outside its event', () => {
    const code = generate({
      hit: {
        type: 'rx_Sprite_on_hit',
        x: 0,
        y: 0,
        fields: { COMPONENT: 'apple', FILTER: '*' },
        inputs: {
          DO: {
            block: {
              type: 'rx_log',
              inputs: { VALUE: { block: arg('GameScene', 'frame', 'dt') } },
            },
          },
        },
      },
    })
    expect(code).toContain('Pomme.onHit(null, async (Pomme, other) => {')
    expect(code).toContain('rx.log(undefined);')
  })

  it('names a component argument and awaits a glide', () => {
    const code = generate({
      tap: {
        type: 'rx_GameScene_on_tap',
        x: 0,
        y: 0,
        fields: { COMPONENT: 'scene' },
        inputs: {
          DO: {
            block: {
              type: 'rx_Sprite_call_glideTo',
              fields: { COMPONENT: 'basket' },
              inputs: {
                ARG0: { block: arg('GameScene', 'tap', 'x') },
                ARG1: { block: { type: 'math_number', fields: { NUM: 580 } } },
                ARG2: { block: { type: 'math_number', fields: { NUM: 0.2 } } },
              },
              next: {
                block: {
                  type: 'rx_Sprite_call_pointTowards',
                  fields: { COMPONENT: 'apple', ARG0: 'basket' },
                },
              },
            },
          },
        },
      },
    })
    expect(code).toContain('Scene1.onTap(async (x, y) => {')
    expect(code).toContain('await Panier.glideTo(x, 580, 0.2);')
    expect(code).toContain('Pomme.pointTowards(Panier);')
  })

  it('renames an event value that a component name already uses', () => {
    const { doc, screenId } = gameProject()
    doc.screens[screenId]!.components.score!.name = 'dt'
    const { code } = generateWorkspaceCode(
      {
        frame: {
          type: 'rx_GameScene_on_frame',
          fields: { COMPONENT: 'scene' },
          inputs: {
            DO: {
              block: {
                type: 'rx_SceneText_set',
                fields: { COMPONENT: 'score', PROP: 'text' },
                inputs: { VALUE: { block: arg('GameScene', 'frame', 'dt') } },
              },
            },
          },
        },
      },
      contextFromDoc(doc, screenId),
    )
    expect(code).toContain('Scene1.onFrame(async (dt_) => {')
    expect(code).toContain('dt.text = dt_;')
  })

  it('labels event values in both languages and offers them in the toolbox', () => {
    const { doc, screenId } = gameProject()
    for (const locale of ['fr', 'en'] as const) {
      const workspace = headlessWorkspace(
        { a: { ...arg('GameScene', 'frame', 'dt'), id: 'a' } },
        contextFromDoc(doc, screenId, { locale }),
      )
      const label = workspace.getBlockById('a')?.toString()
      expect(label).toBe(locale === 'fr' ? 'temps écoulé (s)' : 'elapsed time (s)')
      workspace.dispose()
    }
    const toolbox = JSON.stringify(buildToolbox(contextFromDoc(doc, screenId, { mode: 'studio' })))
    expect(toolbox).toContain(
      '"type":"rx_event_arg","extraState":{"type":"GameScene","event":"frame","arg":"dt"}',
    )
    // "when Pomme touches …" comes preset with another sprite.
    expect(toolbox).toContain(
      '"type":"rx_Sprite_on_hit","fields":{"COMPONENT":"apple","FILTER":"basket"}',
    )
    // Method arguments get a default value.
    expect(toolbox).toMatch(
      /rx_Sprite_call_moveForward[^}]*}[^}]*"ARG0":\{"shadow":\{"type":"math_number","fields":\{"NUM":10\}/,
    )
  })
})
