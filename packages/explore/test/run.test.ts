import { generateProjectCode } from '@rublox/blocks'
import { Engine, FrameClock, type LogEntry, type ModuleLoader, type World } from '@rublox/runtime'
import { LOCALES, type ProjectDoc } from '@rublox/schema'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EXPLORE_APPS, levelProject } from '../src/index.ts'

/** Loads generated code as a `data:` module: Node has no `blob:` imports. */
const dataLoader: ModuleLoader = async (code) => {
  const url = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  const module = await import(/* @vite-ignore */ url)
  return { run: module.default, url, dispose: () => {} }
}

/** What a player does: types amounts, taps every button, moves what can be dragged. */
async function play(doc: ProjectDoc, screenId: string, seconds: number) {
  const logs: LogEntry[] = []
  const clock = new FrameClock(() => () => {})
  const engine = new Engine({
    doc,
    code: generateProjectCode(doc),
    host: { log: (entry) => logs.push(entry) },
    loadModule: dataLoader,
    clock,
    initialScreen: screenId,
  })
  await engine.start()
  await vi.advanceTimersByTimeAsync(50)
  const frames = seconds * 60
  for (let frame = 0; frame < frames; frame++) {
    const instance = engine.getSnapshot().screen
    const screen = instance ? doc.screens[instance.screenId] : undefined
    if (instance && screen) {
      const nodes = Object.entries(screen.components)
      const scene = nodes.find(([, node]) => node.type === 'GameScene')
      const world = scene ? (engine.live(instance.key, scene[0]) as World | undefined) : undefined
      if (world) {
        // The basket or the paddle goes under the lowest thing that falls, most of the time.
        const lowest = world.bodies
          .filter((body) => body.clone || body.values.vy)
          .filter((body) => body.values.visible !== false && !body.deleted)
          .sort((a, b) => (b.values.y as number) - (a.values.y as number))[0]
        for (const body of world.bodies) {
          if (body.values.draggable === true && lowest && frame % 240 < 200)
            world.set(body, 'x', lowest.values.x)
        }
      }
      // Every half second, the next input gets a number and the next button is tapped.
      if (frame % 30 === 0) {
        const step = frame / 30
        const inputs = nodes.filter(([, node]) => node.type === 'TextInput')
        const input = inputs[step % Math.max(1, inputs.length)]
        if (input) {
          engine.setValue(input[0], 'text', String(3 + (step % 7)))
          engine.emit(input[0], 'change')
        }
        const buttons = nodes.filter(([, node]) => node.type === 'Button')
        const button = buttons[step % Math.max(1, buttons.length)]
        if (button) engine.emit(button[0], 'click')
        const dropdown = nodes.find(([, node]) => node.type === 'Dropdown')
        if (dropdown) engine.emit(dropdown[0], 'change', { value: '', index: 1 })
      }
    }
    clock.step(1 / 60)
    await vi.advanceTimersByTimeAsync(1000 / 60)
  }
  const screens = new Set<string>()
  screens.add(engine.getSnapshot().screen?.screenId ?? '')
  engine.dispose()
  return { logs, screens }
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

for (const app of EXPLORE_APPS) {
  describe(`${app.id} runs`, () => {
    for (const level of app.levels) {
      for (const locale of LOCALES) {
        it(`level ${level.level} (${locale}): every screen, without an error`, async () => {
          const doc = levelProject(level, { locale })
          for (const screenId of doc.screenOrder) {
            const { logs } = await play(doc, screenId, 20)
            expect(
              logs.filter((entry) => entry.level !== 'log'),
              `${doc.screens[screenId]?.name}`,
            ).toEqual([])
          }
        })
      }
    }
  })
}
