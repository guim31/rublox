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

const vars = (engine: Engine) => (engine as unknown as { appVars: Map<string, unknown> }).appVars

describe('game scene, J10 additions', () => {
  it('follows a sprite with the camera inside a bigger world, and draws by scroll factor', async () => {
    const { doc } = game(
      {
        start: on('GameScene', 'scene', 'start', {
          type: 'rx_GameScene_call_follow',
          fields: { COMPONENT: 'scene', ARG0: 'basket' },
        }),
      },
      {
        scene: { worldWidth: 1000 },
        basket: { x: 600, y: 320 },
        apple: { x: 20, y: 20, scroll: 0 },
      },
    )
    const { engine, world, frames, body } = await run(doc)
    // The first frame jumps to the hero: centered, 600 − 180.
    expect(body('scene').values.cameraX).toBe(420)
    const stage = document.createElement('div')
    stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: 360, height: 640 }) as DOMRect
    world.mount(stage, () => undefined)
    const basket = stage.querySelector<HTMLElement>('[data-rx-name="Panier"]')
    const apple = stage.querySelector<HTMLElement>('[data-rx-name="Pomme"]')
    expect(basket?.style.transform).toBe('translate(148px, 288px) rotate(0deg)')
    // Fixed on the screen: the camera does not move it.
    expect(apple?.style.transform).toBe('translate(-12px, -12px) rotate(0deg)')
    // Near the end of the world, the camera stops at its edge (1000 − 360).
    world.set(body('basket'), 'x', 980)
    await frames(120)
    expect(body('scene').values.cameraX).toBeCloseTo(640, 0)
    // The world's edges stop it, not the screen's.
    expect(body('basket').values.x).toBe(1000 - 32)
    engine.dispose()
  })

  it('hears keys: events with the key as filter, "key is down", and joysticks', async () => {
    const { doc } = game({
      down: on('GameScene', 'scene', 'keyDown', change(1), 'space'),
      any: on('GameScene', 'scene', 'keyDown', change(10)),
      up: on('GameScene', 'scene', 'keyUp', change(100), 'space'),
      frame: on(
        'GameScene',
        'scene',
        'frame',
        set('Sprite', 'apple', 'visible', {
          type: 'rx_GameScene_call_isKeyPressed',
          fields: { COMPONENT: 'scene', ARG0: 'left' },
        }),
      ),
    })
    const { engine, world, frames, body } = await run(doc)
    world.keyDown('space')
    world.keyDown('space')
    await flush()
    expect(vars(engine).get('score')).toBe(11)
    world.keyUp('space')
    await flush()
    expect(vars(engine).get('score')).toBe(111)
    world.keyDown('left')
    await frames(2)
    expect(body('apple').values.visible).toBe(true)
    world.keyUp('left')
    await frames(2)
    expect(body('apple').values.visible).toBe(false)
    engine.dispose()
  })

  it('steers joysticks with the keyboard, and two at once with two fingers', async () => {
    const { doc, screenId } = game({}, {})
    const screen = doc.screens[screenId]!
    for (const [id, keys, x] of [
      ['stick1', 'arrows', 90],
      ['stick2', 'wasd', 270],
    ] as const) {
      screen.components[id] = {
        ...createComponent('Joystick', 'fr', []),
        name: id,
        props: { keys, x, y: 550 },
      }
      screen.components.scene!.children!.push(id)
    }
    const { engine, world, frames, body } = await run(doc)
    world.keyDown('right')
    world.keyDown('z')
    await frames(1)
    expect(body('stick1').values).toMatchObject({ dx: 1, dy: 0 })
    expect(body('stick2').values).toMatchObject({ dx: 0, dy: -1 })
    world.keyUp('right')
    world.keyUp('z')
    await frames(1)
    expect(body('stick1').values).toMatchObject({ dx: 0, dy: 0 })
    // Two fingers, one on each joystick.
    const stage = document.createElement('div')
    stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: 360, height: 640 }) as DOMRect
    world.mount(stage, () => undefined)
    const press = (name: string, pointerId: number, x: number) =>
      stage
        .querySelector(`[data-rx-name="${name}"]`)
        ?.dispatchEvent(
          new PointerEvent('pointerdown', { clientX: x, clientY: 550, pointerId, bubbles: true }),
        )
    press('stick1', 1, 120)
    press('stick2', 2, 240)
    await frames(1)
    expect(body('stick1').values.dx).toBeGreaterThan(0.5)
    expect(body('stick2').values.dx).toBeLessThan(-0.5)
    engine.dispose()
  })

  it('reports swipes in four directions', async () => {
    const { doc } = game({
      left: on('GameScene', 'scene', 'swipe', change(1), 'left'),
      up: on('GameScene', 'scene', 'swipe', change(10), 'up'),
    })
    const { engine, world } = await run(doc)
    const stage = document.createElement('div')
    stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: 360, height: 640 }) as DOMRect
    world.mount(stage, () => undefined)
    const gesture = (from: [number, number], to: [number, number], pointerId: number) => {
      const at = ([clientX, clientY]: [number, number]) => ({
        clientX,
        clientY,
        pointerId,
        bubbles: true,
      })
      stage.dispatchEvent(new PointerEvent('pointerdown', at(from)))
      stage.dispatchEvent(new PointerEvent('pointermove', at(to)))
      stage.dispatchEvent(new PointerEvent('pointerup', at(to)))
    }
    gesture([200, 300], [120, 310], 1)
    gesture([200, 300], [205, 200], 2)
    gesture([200, 300], [210, 305], 3)
    await flush()
    expect(vars(engine).get('score')).toBe(11)
    engine.dispose()
  })

  it('flips, animates costumes, and orders sprites front to back', async () => {
    const { doc } = game(
      {
        start: on('GameScene', 'scene', 'start', {
          ...call('Sprite', 'apple', 'animate', [num(1), num(3), num(10)]),
          next: { block: call('Sprite', 'basket', 'toFront') },
        }),
      },
      { apple: { costumes: ['a', 'b', 'c'], flipX: true } },
    )
    const { engine, world, frames, body } = await run(doc)
    const stage = document.createElement('div')
    world.mount(stage, () => undefined)
    const apple = () => stage.querySelector<HTMLElement>('[data-rx-name="Pomme"]')
    expect(apple()?.style.transform).toContain('scaleX(-1)')
    await frames(7)
    expect(body('apple').values.costume).toBe(2)
    await frames(6)
    expect(body('apple').values.costume).toBe(3)
    await frames(6)
    expect(body('apple').values.costume).toBe(1)
    // The basket was behind the apple in the project; it is now drawn last.
    expect(world.bodies.at(-1)?.name).toBe('Panier')
    expect(stage.lastElementChild?.getAttribute('data-rx-name')).toBe('Panier')
    // Choosing a costume stops the animation.
    world.write(body('apple'), 'costume', 2)
    await frames(20)
    expect(body('apple').values.costume).toBe(2)
    engine.dispose()
  })

  it('lands a sprite on a platform, and the platform carries it', async () => {
    const { doc } = game(
      {},
      {
        apple: { x: 150, y: 300, gravity: 900, solid: true, bounce: 0, width: 40, height: 40 },
        basket: {
          x: 150,
          y: 420,
          width: 200,
          height: 40,
          solid: true,
          pushable: false,
          vx: 60,
        },
      },
    )
    const { engine, frames, body } = await run(doc)
    await frames(40)
    const apple = body('apple').values
    expect(apple.onGround).toBe(true)
    expect(apple.y as number).toBeCloseTo(380, 0)
    const x = apple.x as number
    expect(x).toBeGreaterThan(150)
    await frames(30)
    // Carried at the platform's speed: 60 per second.
    expect((body('apple').values.x as number) - x).toBeCloseTo(30, 0)
    // The platform was not pushed down.
    expect(body('basket').values.y).toBe(420)
    engine.dispose()
  })

  it('makes a resting puck fly off a bat that cannot be pushed', async () => {
    const { doc } = game(
      {},
      {
        basket: { x: 100, y: 300, vx: 400, solid: true, pushable: false, collision: 'circle' },
        apple: { x: 180, y: 300, solid: true, collision: 'circle', bounce: 100 },
      },
    )
    const { engine, frames, body } = await run(doc)
    await frames(12)
    expect(body('apple').values.vx as number).toBeGreaterThan(400)
    expect(body('basket').values.vx).toBe(400)
    engine.dispose()
  })

  it('runs a function called on every frame at every frame, even when it moves things', async () => {
    const { doc } = game({
      define: {
        type: 'procedures_defnoreturn',
        fields: { NAME: 'step' },
        inputs: {
          STACK: {
            block: {
              ...call('Sprite', 'basket', 'moveBy', [num(1), num(0)]),
              next: { block: change(1) },
            },
          },
        },
      },
      frame: on('GameScene', 'scene', 'frame', {
        type: 'procedures_callnoreturn',
        extraState: { name: 'step' },
        next: {
          block: { type: 'procedures_callnoreturn', extraState: { name: 'step' } },
        },
      }),
    })
    const { engine, frames } = await run(doc)
    await frames(10)
    expect(vars(engine).get('score')).toBe(20)
    engine.dispose()
  })

  it('never lets a push take a sprite through the edges', async () => {
    const { doc } = game(
      {},
      {
        basket: {
          x: 100,
          y: 60,
          vx: 0,
          vy: -300,
          solid: true,
          pushable: false,
          collision: 'circle',
        },
        apple: { x: 100, y: 20, solid: true, collision: 'circle', width: 30, height: 30 },
      },
    )
    const { engine, frames, body } = await run(doc)
    await frames(20)
    expect(body('apple').values.y as number).toBeGreaterThanOrEqual(15)
    engine.dispose()
  })

  it('builds at once while the scene is paused', async () => {
    const { doc } = game({
      start: on('GameScene', 'scene', 'start', {
        ...set('GameScene', 'scene', 'paused', { type: 'logic_boolean', fields: { BOOL: 'TRUE' } }),
        next: {
          block: {
            type: 'controls_repeat_ext',
            inputs: {
              TIMES: { block: num(50) },
              DO: { block: call('Sprite', 'apple', 'clone') },
            },
          },
        },
      }),
    })
    const { engine, world, frames } = await run(doc)
    await frames(1)
    expect(world.clones()).toBe(50)
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
