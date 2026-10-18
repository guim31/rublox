import { generateProjectCode } from '@rublox/blocks'
import {
  type Body,
  Engine,
  FrameClock,
  type LogEntry,
  type ModuleLoader,
  type World,
} from '@rublox/runtime'
import type { ProjectDoc } from '@rublox/schema'
import { vi } from 'vitest'

/** Loads generated code as a `data:` module: Node has no `blob:` imports. */
const dataLoader: ModuleLoader = async (code) => {
  const url = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  const module = await import(/* @vite-ignore */ url)
  return { run: module.default, url, dispose: () => {} }
}

/** What a bot sees and does, once per frame. */
export type Player = {
  world: World
  /** A sprite or a text by its name in the project (the original, not a clone). */
  body(name: string): Body
  /** Clones of a sprite, still in the game. */
  clones(name: string): Body[]
  /** The value of an app variable, by its key in the recipe. */
  variable(name: string): unknown
  frame: number
  tap(x: number, y: number): void
  /** A finger that goes down, moves, and goes up (a swipe, or a joystick held). */
  drag(from: [number, number], to: [number, number], pointer?: number): void
  press(key: string): void
  release(key: string): void
}

/**
 * Runs a game in the engine, frame by frame at 60 frames per second (a manual clock, timers
 * advanced with it), with a bot that plays. Returns the console and what happened.
 */
export async function play(
  doc: ProjectDoc,
  seconds: number,
  bot: (player: Player) => void,
  /** Variable names by recipe key (names are in the app's language). */
  names: Record<string, string> = {},
): Promise<{ logs: LogEntry[]; engine: Engine; samples: Record<string, unknown>[] }> {
  const logs: LogEntry[] = []
  const clock = new FrameClock(() => () => {})
  const engine = new Engine({
    doc,
    code: generateProjectCode(doc),
    host: { log: (entry) => logs.push(entry) },
    loadModule: dataLoader,
    clock,
    // The project's files, by asset id: what the studio gives the preview.
    assetUrl: (value) => (doc.assets[value] ? `https://example.com/${value}` : undefined),
  })
  // The same chance at every run: a game played twice gives the same game (no flaky test).
  let seed = 20261018
  const random = Math.random
  Math.random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 2 ** 32
  }
  // jsdom does not play sounds: playing one does nothing, as on a muted phone.
  HTMLMediaElement.prototype.play = () => Promise.resolve()
  HTMLMediaElement.prototype.pause = () => {}
  await engine.start()
  await vi.advanceTimersByTimeAsync(50)
  const instance = engine.getSnapshot().screen
  if (!instance) throw new Error('no screen')
  const screen = doc.screens[instance.screenId]
  const sceneId = Object.entries(screen?.components ?? {}).find(
    ([, node]) => node.type === 'GameScene',
  )?.[0]
  const world = sceneId ? (engine.live(instance.key, sceneId) as World | undefined) : undefined
  if (!world) throw new Error('no game scene')
  // A stage the size of the scene, so that taps and swipes land where they are aimed.
  const stage = document.createElement('div')
  const width = Number(world.scene.values.sceneWidth ?? 360)
  const height = Number(world.scene.values.sceneHeight ?? 640)
  stage.getBoundingClientRect = () => ({ left: 0, top: 0, width, height }) as DOMRect
  document.body.append(stage)
  world.mount(stage, () => undefined)
  const byName = (name: string) => {
    const body = world.bodies.find((b) => b.name === name && !b.clone) ?? world.scene
    if (body.name !== name) throw new Error(`no body named ${name}`)
    return body
  }
  const target = (x: number, y: number) => {
    const hit = [...world.bodies].reverse().find((body) => {
      if (body.el?.style.pointerEvents !== 'auto' || body.values.visible === false) return false
      const w = Number(body.values.width ?? body.values.size ?? 0) / 2
      const h = Number(body.values.height ?? body.values.size ?? 0) / 2
      return Math.abs(x - Number(body.values.x)) <= w && Math.abs(y - Number(body.values.y)) <= h
    })
    return hit?.el ?? stage
  }
  const pointer = (type: string, x: number, y: number, id: number, on: Element) =>
    on.dispatchEvent(
      new PointerEvent(type, { clientX: x, clientY: y, pointerId: id, bubbles: true }),
    )
  const samples: Record<string, unknown>[] = []
  const vars = (engine as unknown as { appVars: Map<string, unknown> }).appVars
  for (let frame = 0; frame < seconds * 60; frame++) {
    bot({
      world,
      body: byName,
      clones: (name) => world.bodies.filter((b) => b.clone && b.name === name && !b.deleted),
      variable: (key) => vars.get(names[key] ?? key),
      frame,
      tap: (x, y) => {
        const on = target(x, y)
        pointer('pointerdown', x, y, 1, on)
        pointer('pointerup', x, y, 1, on)
      },
      drag: ([x1, y1], [x2, y2], id = 1) => {
        const on = target(x1, y1)
        pointer('pointerdown', x1, y1, id, on)
        pointer('pointermove', x2, y2, id, on)
        pointer('pointerup', x2, y2, id, on)
      },
      press: (key) => world.keyDown(key),
      release: (key) => world.keyUp(key),
    })
    clock.step(1 / 60)
    await vi.advanceTimersByTimeAsync(1000 / 60)
    if (frame % 10 === 0) samples.push(Object.fromEntries(vars))
  }
  stage.remove()
  Math.random = random
  return { logs, engine, samples }
}

/** The app's variables by name, read through the engine. */
export function variables(engine: Engine): Map<string, unknown> {
  return (engine as unknown as { appVars: Map<string, unknown> }).appVars
}
