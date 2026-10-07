import { generateProjectCode } from '@rublox/blocks'
import {
  BOUNCING_COUNT,
  bouncingDemo,
  CATCH_GAME_IDS,
  catchGameDemo,
  createComponent,
  createProject,
} from '@rublox/catalog'
import type { BlocklyJson, ProjectDoc } from '@rublox/schema'
import { describe, expect, it } from 'vitest'
import { Engine, FrameClock, type LogEntry, type World } from '../src/index.ts'
import { dataLoader, flush, num } from './helpers.ts'

/** A clock that only moves when the test says so. */
function manualClock() {
  return new FrameClock(() => () => {})
}

/** A screen with a scene (360 × 640) holding Panier and Pomme. */
function game(blocks: Record<string, BlocklyJson> = {}, props: Record<string, object> = {}) {
  const doc = createProject({ name: 'Jeu', locale: 'fr', mode: 'junior', id: 'g' })
  const screenId = doc.screenOrder[0]!
  const screen = doc.screens[screenId]!
  const add = (id: string, type: string, parent: string, name: string) => {
    const node = { ...createComponent(type, 'fr', []), name }
    node.props = { ...node.props, ...props[id] }
    screen.components[id] = node
    screen.components[parent]!.children!.push(id)
  }
  add('scene', 'GameScene', screen.rootId, 'Scene1')
  add('basket', 'Sprite', 'scene', 'Panier')
  add('apple', 'Sprite', 'scene', 'Pomme')
  add('score', 'SceneText', 'scene', 'Score')
  doc.variables.app.push({ id: 'v1', name: 'score', initial: 0 })
  doc.blocks[screenId] = blocks
  return { doc, screenId }
}

async function run(doc: ProjectDoc) {
  const logs: LogEntry[] = []
  const clock = manualClock()
  const engine = new Engine({
    doc,
    code: generateProjectCode(doc),
    host: { log: (entry) => logs.push(entry) },
    loadModule: dataLoader,
    clock,
  })
  await engine.start()
  await flush()
  const instance = engine.getSnapshot().screen!
  const world = engine.live(instance.key, 'scene') as World
  const frames = async (count: number) => {
    for (let i = 0; i < count; i++) {
      clock.step(1 / 60)
      await flush()
    }
  }
  const body = (id: string) => world.original(id)!
  return { engine, world, clock, logs, frames, body }
}

const on = (
  type: string,
  component: string,
  event: string,
  body: BlocklyJson,
  filter?: string,
) => ({
  type: `rx_${type}_on_${event}`,
  fields: { COMPONENT: component, ...(filter ? { FILTER: filter } : {}) },
  inputs: { DO: { block: body } },
})
const call = (type: string, component: string, method: string, args: BlocklyJson[] = []) => ({
  type: `rx_${type}_call_${method}`,
  fields: { COMPONENT: component },
  inputs: Object.fromEntries(args.map((value, index) => [`ARG${index}`, { block: value }])),
})
const set = (
  type: string,
  component: string,
  prop: string,
  value: BlocklyJson,
  next?: BlocklyJson,
) => ({
  type: `rx_${type}_set`,
  fields: { COMPONENT: component, PROP: prop },
  inputs: { VALUE: { block: value } },
  ...(next ? { next: { block: next } } : {}),
})
const change = (delta: number): BlocklyJson => ({
  type: 'math_change',
  fields: { VAR: { id: 'v1' } },
  inputs: { DELTA: { block: num(delta) } },
})

describe('game scene', () => {
  it('moves sprites with speed and gravity, and stops them at the edges', async () => {
    const { doc } = game({}, { apple: { y: 100, gravity: 600 }, basket: { x: 100, vx: 120 } })
    const { engine, frames, body } = await run(doc)
    await frames(30)
    expect(body('basket').values.x).toBeCloseTo(160, 0)
    const y = body('apple').values.y as number
    expect(y).toBeGreaterThan(150)
    await frames(120)
    // Resting on the bottom edge (640 − half its height).
    expect(body('apple').values.y).toBe(640 - 32)
    expect(body('apple').values.vy).toBe(0)
    engine.dispose()
  })

  it('bounces on the edges with the sprite’s bounciness', async () => {
    const { doc } = game({}, { scene: { edges: 'bounce' }, apple: { y: 600, vy: 300, bounce: 50 } })
    const { engine, frames, body } = await run(doc)
    await frames(10)
    expect(body('apple').values.vy).toBeCloseTo(-150, 0)
    engine.dispose()
  })

  it('fires "touches an edge" once per contact, with the edge as filter', async () => {
    const { doc } = game(
      {
        a: on('Sprite', 'apple', 'edge', change(1), 'bottom'),
        b: on('Sprite', 'apple', 'edge', change(100), 'top'),
      },
      { apple: { y: 500, vy: 400 } },
    )
    const { engine, frames } = await run(doc)
    await frames(60)
    expect((engine as unknown as { appVars: Map<string, unknown> }).appVars.get('score')).toBe(1)
    engine.dispose()
  })

  it('clones a sprite, runs its blocks for each clone, and deletes on contact', async () => {
    const { doc } = game(
      {
        start: on('GameScene', 'scene', 'start', {
          ...call('Sprite', 'apple', 'clone'),
          next: { block: call('Sprite', 'apple', 'clone') },
        }),
        clone: on('Sprite', 'apple', 'clone', set('Sprite', 'apple', 'vy', num(600))),
        hit: on(
          'Sprite',
          'apple',
          'hit',
          { ...change(1), next: { block: call('Sprite', 'apple', 'delete') } },
          'basket',
        ),
      },
      { apple: { y: 100, visible: true }, basket: { x: 180, y: 500 } },
    )
    const { engine, world, frames, body } = await run(doc)
    await flush()
    expect(world.clones()).toBe(2)
    // The original did not move: only the clones got a speed.
    await frames(40)
    expect(body('apple').values.y).toBe(100)
    expect((engine as unknown as { appVars: Map<string, unknown> }).appVars.get('score')).toBe(2)
    expect(world.clones()).toBe(0)
    engine.dispose()
  })

  it('gives the elapsed time to "on every frame" and never runs a busy handler twice', async () => {
    const { doc } = game({
      frame: on('GameScene', 'scene', 'frame', {
        ...change(1),
        next: { block: { type: 'rx_wait', inputs: { SECONDS: { block: num(1) } } } },
      }),
      tap: on(
        'GameScene',
        'scene',
        'tap',
        set('Sprite', 'basket', 'x', { type: 'rx_event_value', fields: { ARG: 'x' } }),
      ),
    })
    const { engine, frames } = await run(doc)
    await frames(10)
    // The first frame's handler is still waiting: the next nine were skipped.
    expect((engine as unknown as { appVars: Map<string, unknown> }).appVars.get('score')).toBe(1)
    engine.dispose()
  })

  it('makes a loop that moves a sprite run once per frame', async () => {
    const { doc } = game(
      {
        start: on('GameScene', 'scene', 'start', {
          type: 'rx_forever',
          inputs: { DO: { block: call('Sprite', 'basket', 'moveBy', [num(2), num(0)]) } },
        }),
      },
      { basket: { x: 100 } },
    )
    const { engine, frames, body } = await run(doc)
    await frames(5)
    const x = body('basket').values.x as number
    expect(x).toBeGreaterThanOrEqual(108)
    expect(x).toBeLessThanOrEqual(114)
    engine.stop()
    engine.dispose()
  })

  it('glides in the given time and awaits the end', async () => {
    const { doc } = game({
      start: on('GameScene', 'scene', 'start', {
        ...call('Sprite', 'basket', 'glideTo', [num(300), num(100), num(0.5)]),
        next: { block: change(1) },
      }),
    })
    const { engine, frames, body } = await run(doc)
    const vars = (engine as unknown as { appVars: Map<string, unknown> }).appVars
    await frames(15)
    expect(body('basket').values.x).toBeGreaterThan(180)
    expect(body('basket').values.x).toBeLessThan(300)
    expect(vars.get('score')).toBe(0)
    await frames(20)
    expect(body('basket').values).toMatchObject({ x: 300, y: 100 })
    expect(vars.get('score')).toBe(1)
    engine.dispose()
  })

  it('reads touching and distance, and turns towards another sprite', async () => {
    const { doc } = game(
      {
        start: on(
          'GameScene',
          'scene',
          'start',
          set(
            'SceneText',
            'score',
            'text',
            {
              type: 'rx_Sprite_call_distanceTo',
              fields: { COMPONENT: 'basket', ARG0: 'apple' },
            },
            { type: 'rx_Sprite_call_pointTowards', fields: { COMPONENT: 'basket', ARG0: 'apple' } },
          ),
        ),
      },
      { basket: { x: 0, y: 0 }, apple: { x: 30, y: 40 } },
    )
    const { engine, body } = await run(doc)
    expect(body('score').values.text).toBe('50')
    expect(body('basket').values.rotation).toBeCloseTo(53.13, 1)
    engine.dispose()
  })

  it('draws bodies with transforms and fires taps in scene units', async () => {
    const { doc } = game({
      tap: on(
        'GameScene',
        'scene',
        'tap',
        set('Sprite', 'basket', 'x', { type: 'rx_event_value', fields: { ARG: 'x' } }),
      ),
    })
    const { engine, world, frames } = await run(doc)
    const stage = document.createElement('div')
    document.body.append(stage)
    stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: 180, height: 320 }) as DOMRect
    const unmount = world.mount(stage, () => undefined)
    const basket = stage.querySelector<HTMLElement>('[data-rx-name="Panier"]')
    expect(basket?.textContent).toBe('🐱')
    expect(basket?.style.transform).toBe('translate(148px, 288px) rotate(0deg)')
    stage.dispatchEvent(
      new PointerEvent('pointerdown', { clientX: 45, clientY: 10, bubbles: true }),
    )
    await flush()
    await frames(1)
    expect(basket?.style.transform).toBe('translate(58px, 288px) rotate(0deg)')
    unmount()
    expect(stage.children).toHaveLength(0)
    engine.dispose()
  })

  it('follows design changes that the code did not override', async () => {
    const { doc, screenId } = game()
    const { engine, body } = await run(doc)
    const next = structuredClone(doc)
    next.screens[screenId]!.components.basket!.props.x = 42
    await engine.update(next, generateProjectCode(next))
    expect(body('basket').values.x).toBe(42)
    engine.dispose()
  })
})

describe('the catch game demo', () => {
  it('scores when the basket follows the fruit', async () => {
    const doc = catchGameDemo('fr')
    const { engine, world, frames, body, logs } = await run(doc)
    const basket = body(CATCH_GAME_IDS.basket)
    for (let frame = 0; frame < 60 * 8; frame++) {
      // Play: the basket goes under the lowest fruit.
      const fruit = world.bodies
        .filter((b) => b.clone && b.values.visible !== false)
        .sort((a, b) => (b.values.y as number) - (a.values.y as number))[0]
      if (fruit) world.set(basket, 'x', fruit.values.x)
      await frames(1)
    }
    expect(logs.filter((entry) => entry.level !== 'log')).toEqual([])
    expect(body(CATCH_GAME_IDS.score).values.text).toMatch(/^Score : [1-9]/)
    expect(body(CATCH_GAME_IDS.lives).values.text).toBe('❤️ 3')
    engine.dispose()
  })
})

describe('the bouncing demo', () => {
  it('fills the scene with 50 sprites that stay inside', async () => {
    const doc = bouncingDemo('en')
    const { engine, world, frames, logs } = await run(doc)
    await frames(120)
    expect(world.bodies.filter((b) => b.type === 'Sprite')).toHaveLength(BOUNCING_COUNT)
    for (const body of world.bodies) {
      expect(body.values.x as number).toBeGreaterThanOrEqual(0)
      expect(body.values.y as number).toBeLessThanOrEqual(640)
    }
    expect(logs).toEqual([])
    engine.dispose()
  })
})
