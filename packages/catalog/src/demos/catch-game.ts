import type { BlocklyJson, ComponentNode, Locale, ProjectDoc } from '@rublox/schema'
import { createComponent, createProject } from '../project.ts'

/**
 * « Attrape les fruits » (J7): a catch game made only of blocks. Fruits fall from the sky;
 * the basket catches them (drag it, or tap where it should go); three missed fruits and the
 * game starts over. Loadable from the command palette, and played by the end-to-end test.
 */

const TEXTS = {
  fr: {
    project: 'Attrape les fruits',
    screen: 'Jeu',
    scene: 'Jardin',
    basket: 'Panier',
    fruit: 'Fruit',
    score: 'Score',
    lives: 'Vies',
    sun: 'Soleil',
    cloud: 'Nuage',
    scoreVar: 'score',
    livesVar: 'vies',
    scoreLabel: 'Score : ',
    livesLabel: '❤️ ',
    lost: 'Perdu ! Ton score : ',
  },
  en: {
    project: 'Catch the fruit',
    screen: 'Game',
    scene: 'Garden',
    basket: 'Basket',
    fruit: 'Fruit',
    score: 'Score',
    lives: 'Lives',
    sun: 'Sun',
    cloud: 'Cloud',
    scoreVar: 'score',
    livesVar: 'lives',
    scoreLabel: 'Score: ',
    livesLabel: '❤️ ',
    lost: 'Game over! Your score: ',
  },
} as const

/** Fixed ids: the end-to-end test and the docs can name them. */
export const CATCH_GAME_IDS = {
  scene: 'scene',
  basket: 'basket',
  fruit: 'fruit',
  score: 'score',
  lives: 'lives',
  sun: 'sun',
  cloud: 'cloud',
} as const

const ID = CATCH_GAME_IDS

const num = (value: number): BlocklyJson => ({ type: 'math_number', fields: { NUM: value } })
const text = (value: string): BlocklyJson => ({ type: 'text', fields: { TEXT: value } })
const random = (from: number, to: number): BlocklyJson => ({
  type: 'math_random_int',
  inputs: { FROM: { block: num(from) }, TO: { block: num(to) } },
})
const variable = (id: string): BlocklyJson => ({ type: 'variables_get', fields: { VAR: { id } } })
const join = (a: BlocklyJson, b: BlocklyJson): BlocklyJson => ({
  type: 'text_join',
  extraState: { itemCount: 2 },
  inputs: { ADD0: { block: a }, ADD1: { block: b } },
})
const arg = (type: string, event: string, name: string): BlocklyJson => ({
  type: 'rx_event_arg',
  extraState: { type, event, arg: name },
})

/** Chains statements: each one's `next` is the following one. */
function chain(...blocks: BlocklyJson[]): BlocklyJson {
  const [first, ...rest] = blocks
  if (!first) throw new Error('empty chain')
  return rest.length ? { ...first, next: { block: chain(...rest) } } : first
}

const setVar = (id: string, value: BlocklyJson): BlocklyJson => ({
  type: 'variables_set',
  fields: { VAR: { id } },
  inputs: { VALUE: { block: value } },
})
const changeVar = (id: string, delta: number): BlocklyJson => ({
  type: 'math_change',
  fields: { VAR: { id } },
  inputs: { DELTA: { block: num(delta) } },
})
const set = (type: string, component: string, prop: string, value: BlocklyJson): BlocklyJson => ({
  type: `rx_${type}_set`,
  fields: { COMPONENT: component, PROP: prop },
  inputs: { VALUE: { block: value } },
})
const call = (
  type: string,
  component: string,
  method: string,
  args: BlocklyJson[] = [],
): BlocklyJson => ({
  type: `rx_${type}_call_${method}`,
  fields: { COMPONENT: component },
  ...(args.length
    ? { inputs: Object.fromEntries(args.map((value, index) => [`ARG${index}`, { block: value }])) }
    : {}),
})
const on = (
  type: string,
  component: string,
  event: string,
  body: BlocklyJson,
  at: { x: number; y: number },
  filter?: string,
): BlocklyJson => ({
  type: `rx_${type}_on_${event}`,
  id: `${component}-${event}`,
  ...at,
  fields: { COMPONENT: component, ...(filter ? { FILTER: filter } : {}) },
  inputs: { DO: { block: body } },
})

export function catchGameDemo(locale: Locale, now?: Date): ProjectDoc {
  const t = TEXTS[locale]
  const doc = createProject({ name: t.project, locale, mode: 'junior', now })
  const screenId = doc.screenOrder[0] as string
  const screen = doc.screens[screenId]
  if (!screen) throw new Error('no screen')
  const root = screen.components[screen.rootId]
  if (!root) throw new Error('no root')
  screen.name = t.screen
  root.name = t.screen
  root.props = { padding: 0 }

  const add = (id: string, type: string, name: string, props: Record<string, unknown>) => {
    const node: ComponentNode = { ...createComponent(type, locale, []), name }
    node.props = { ...node.props, ...props }
    screen.components[id] = node
    return node
  }
  const scene = add(ID.scene, 'GameScene', t.scene, { edges: 'pass', background: '#cdeafe' })
  root.children = [ID.scene]
  add(ID.sun, 'Sprite', t.sun, {
    costumes: ['☀️'],
    x: 300,
    y: 110,
    width: 80,
    height: 80,
    collision: 'none',
  })
  add(ID.cloud, 'Sprite', t.cloud, {
    costumes: ['☁️'],
    x: 90,
    y: 150,
    width: 110,
    height: 80,
    collision: 'none',
    opacity: 90,
  })
  add(ID.fruit, 'Sprite', t.fruit, {
    costumes: ['🍎', '🍓', '🍊'],
    x: 180,
    y: -40,
    width: 54,
    height: 54,
    collision: 'circle',
    visible: false,
  })
  add(ID.basket, 'Sprite', t.basket, {
    costumes: ['🧺'],
    x: 180,
    y: 590,
    width: 96,
    height: 72,
    draggable: true,
    edges: 'stop',
  })
  add(ID.score, 'SceneText', t.score, {
    text: `${t.scoreLabel}0`,
    x: 20,
    y: 38,
    align: 'left',
  })
  add(ID.lives, 'SceneText', t.lives, {
    text: `${t.livesLabel}3`,
    x: 340,
    y: 38,
    align: 'right',
  })
  scene.children = [ID.sun, ID.cloud, ID.fruit, ID.basket, ID.score, ID.lives]

  const score = 'v-score'
  const lives = 'v-lives'
  doc.variables.app = [
    { id: score, name: t.scoreVar, initial: 0 },
    { id: lives, name: t.livesVar, initial: 3 },
  ]
  const showScore = set('SceneText', ID.score, 'text', join(text(t.scoreLabel), variable(score)))
  const showLives = set('SceneText', ID.lives, 'text', join(text(t.livesLabel), variable(lives)))

  const stacks = [
    // When the scene starts: reset, then drop a fruit every second, forever.
    on(
      'GameScene',
      ID.scene,
      'start',
      chain(setVar(score, num(0)), setVar(lives, num(3)), showScore, showLives, {
        type: 'rx_forever',
        inputs: {
          DO: {
            block: chain(
              {
                type: 'controls_if',
                inputs: {
                  IF0: {
                    block: {
                      type: 'logic_negate',
                      inputs: {
                        BOOL: {
                          block: {
                            type: 'rx_GameScene_get',
                            fields: { COMPONENT: ID.scene, PROP: 'paused' },
                          },
                        },
                      },
                    },
                  },
                  DO0: { block: call('Sprite', ID.fruit, 'clone') },
                },
              },
              { type: 'rx_wait', inputs: { SECONDS: { block: num(1) } } },
            ),
          },
        },
      }),
      { x: 20, y: 20 },
    ),
    // Each clone: somewhere along the top, a random fruit, and it falls.
    on(
      'Sprite',
      ID.fruit,
      'clone',
      chain(
        call('Sprite', ID.fruit, 'goTo', [random(30, 330), num(-30)]),
        set('Sprite', ID.fruit, 'costume', random(1, 3)),
        set('Sprite', ID.fruit, 'gravity', random(140, 260)),
        set('Sprite', ID.fruit, 'visible', { type: 'logic_boolean', fields: { BOOL: 'TRUE' } }),
      ),
      { x: 20, y: 330 },
    ),
    // Caught: one more point.
    on(
      'Sprite',
      ID.fruit,
      'hit',
      chain(changeVar(score, 1), showScore, call('Sprite', ID.fruit, 'delete')),
      { x: 420, y: 20 },
      ID.basket,
    ),
    // Missed: one life less; at zero, the game starts over.
    on(
      'Sprite',
      ID.fruit,
      'edge',
      chain(changeVar(lives, -1), showLives, call('Sprite', ID.fruit, 'delete'), {
        type: 'controls_if',
        inputs: {
          IF0: {
            block: {
              type: 'logic_compare',
              fields: { OP: 'LTE' },
              inputs: { A: { block: variable(lives) }, B: { block: num(0) } },
            },
          },
          DO0: {
            block: chain(
              call('GameScene', ID.scene, 'pause'),
              call('GameScene', ID.scene, 'deleteClones'),
              {
                type: 'rx_ui_alert',
                inputs: { MESSAGE: { block: join(text(t.lost), variable(score)) } },
              },
              setVar(score, num(0)),
              setVar(lives, num(3)),
              showScore,
              showLives,
              call('GameScene', ID.scene, 'resume'),
            ),
          },
        },
      }),
      { x: 420, y: 260 },
      'bottom',
    ),
    // Tap the garden: the basket glides there.
    on(
      'GameScene',
      ID.scene,
      'tap',
      call('Sprite', ID.basket, 'glideTo', [arg('GameScene', 'tap', 'x'), num(590), num(0.25)]),
      { x: 20, y: 600 },
    ),
  ]
  doc.blocks[screenId] = Object.fromEntries(stacks.map((stack) => [stack.id as string, stack]))
  return doc
}
