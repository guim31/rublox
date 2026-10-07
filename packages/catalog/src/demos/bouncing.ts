import type { ComponentNode, Locale, ProjectDoc } from '@rublox/schema'
import { createComponent, createProject } from '../project.ts'
import { call, chain, num, on, random, set } from './blocks-json.ts'

/**
 * « 50 lutins qui rebondissent » (J7): the performance check of the game mode. One ball and
 * 49 clones bounce off the edges and change costume when they touch each other, all made of
 * blocks. `pnpm test:e2e` measures its frame rate (e2e/game-perf.spec.ts).
 */
const TEXTS = {
  fr: { project: '50 lutins qui rebondissent', screen: 'Balles', scene: 'Terrain', ball: 'Balle' },
  en: { project: '50 bouncing sprites', screen: 'Balls', scene: 'Field', ball: 'Ball' },
} as const

export const BOUNCING_COUNT = 50

export function bouncingDemo(locale: Locale, count = BOUNCING_COUNT, now?: Date): ProjectDoc {
  const t = TEXTS[locale]
  const doc = createProject({ name: t.project, locale, mode: 'studio', now })
  const screenId = doc.screenOrder[0] as string
  const screen = doc.screens[screenId]
  const root = screen?.components[screen.rootId]
  if (!screen || !root) throw new Error('no screen')
  screen.name = t.screen
  root.name = t.screen
  root.props = { padding: 0 }
  const add = (id: string, type: string, name: string, props: Record<string, unknown>) => {
    const node: ComponentNode = { ...createComponent(type, locale, []), name }
    node.props = { ...node.props, ...props }
    screen.components[id] = node
  }
  add('scene', 'GameScene', t.scene, { edges: 'bounce', background: '#1d1b3a' })
  add('ball', 'Sprite', t.ball, {
    costumes: ['⚽', '🏀', '🎾', '🔴', '🟡', '🟢'],
    width: 36,
    height: 36,
    collision: 'circle',
    vx: 140,
    vy: -90,
  })
  root.children = ['scene']
  screen.components.scene = { ...(screen.components.scene as ComponentNode), children: ['ball'] }

  const stacks = [
    on(
      'GameScene',
      'scene',
      'start',
      {
        type: 'controls_repeat_ext',
        inputs: {
          TIMES: { block: num(count - 1) },
          DO: { block: call('Sprite', 'ball', 'clone') },
        },
      },
      { x: 20, y: 20 },
    ),
    on(
      'Sprite',
      'ball',
      'clone',
      chain(
        call('Sprite', 'ball', 'goTo', [random(30, 330), random(30, 610)]),
        set('Sprite', 'ball', 'vx', random(-220, 220)),
        set('Sprite', 'ball', 'vy', random(-220, 220)),
        set('Sprite', 'ball', 'costume', random(1, 6)),
      ),
      { x: 20, y: 200 },
    ),
    on('Sprite', 'ball', 'hit', call('Sprite', 'ball', 'nextCostume'), { x: 20, y: 420 }, '*'),
  ]
  doc.blocks[screenId] = Object.fromEntries(stacks.map((stack) => [stack.id as string, stack]))
  return doc
}
