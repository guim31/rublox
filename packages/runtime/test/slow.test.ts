import { generateProjectCode } from '@rublox/blocks'
import { describe, expect, it } from 'vitest'
import {
  type AppEvent,
  Engine,
  friendlyError,
  type LogEntry,
  listItem,
  RxError,
  type StepInfo,
} from '../src/index.ts'
import { dataLoader, flush, num, onClick, project, setText, sleep, text, value } from './helpers.ts'

function slowEngine(breakpoints: string[] = [], delay = 5) {
  const { doc, home } = project()
  doc.blocks[home] = {
    evt: onClick('button', {
      ...setText('text', text('un')),
      id: 'first',
      next: { block: { ...setText('text', text('deux')), id: 'second' } },
    }),
  }
  const steps: StepInfo[] = []
  const events: AppEvent[] = []
  const logs: LogEntry[] = []
  const engine = new Engine({
    doc,
    code: generateProjectCode(doc, { slow: true }),
    host: {
      log: (entry) => logs.push(entry),
      step: (step) => steps.push(step),
      event: (event) => events.push(event),
    },
    loadModule: dataLoader,
    slow: { enabled: true, delay, breakpoints },
  })
  return { engine, steps, events, logs, home }
}

describe('slow motion', () => {
  it('lights each block up, in order, then switches the light off', async () => {
    const { engine, steps, home } = slowEngine()
    await engine.start()
    engine.emit('button', 'click')
    await sleep(60)
    expect(value(engine, 'text', 'text')).toBe('deux')
    const lit = steps.filter((s) => s.blockId).map((s) => s.blockId)
    expect(lit).toEqual(['first', 'second'])
    expect(steps.find((s) => s.blockId === 'first')?.workspace).toBe(home)
    expect(steps.at(-1)).toEqual({ blockId: null, workspace: null, paused: false })
    engine.dispose()
  })

  it('pauses on a breakpoint, then goes on or steps once', async () => {
    const { engine, steps } = slowEngine(['first'])
    await engine.start()
    engine.emit('button', 'click')
    await sleep(30)
    expect(engine.isPaused()).toBe(true)
    expect(steps.at(-1)).toEqual(expect.objectContaining({ blockId: 'first', paused: true }))
    expect(value(engine, 'text', 'text')).toBeUndefined()
    // "Next block": runs `first`, stops again before `second`.
    engine.resume(true)
    await sleep(30)
    expect(value(engine, 'text', 'text')).toBe('un')
    expect(engine.isPaused()).toBe(true)
    expect(steps.at(-1)).toEqual(expect.objectContaining({ blockId: 'second', paused: true }))
    engine.resume(false)
    await sleep(30)
    expect(value(engine, 'text', 'text')).toBe('deux')
    expect(engine.isPaused()).toBe(false)
    engine.dispose()
  })

  it('stop leaves a pause without an error', async () => {
    const { engine, logs } = slowEngine(['first'])
    await engine.start()
    engine.emit('button', 'click')
    await sleep(20)
    engine.stop()
    await flush()
    expect(engine.isPaused()).toBe(false)
    expect(logs).toEqual([])
  })

  it('turning slow motion off lets paused code run on at full speed', async () => {
    const { engine } = slowEngine(['first'], 10_000)
    await engine.start()
    engine.emit('button', 'click')
    await sleep(20)
    engine.setSlowMotion({ enabled: false, delay: 10_000, breakpoints: [] })
    await sleep(20)
    expect(value(engine, 'text', 'text')).toBe('deux')
    engine.dispose()
  })

  it('reports what the person does in the app', async () => {
    const { engine, events, home } = slowEngine()
    await engine.start()
    engine.emit('button', 'click')
    expect(events).toEqual([
      {
        screenId: home,
        componentId: 'button',
        componentType: 'Button',
        componentName: 'Bouton1',
        event: 'click',
      },
    ])
    engine.dispose()
  })
})

describe('errors for children', () => {
  it('explains a missing list item', () => {
    expect(listItem(['a', 'b', 'c'], 2)).toBe('b')
    const error = (() => {
      try {
        listItem(['a', 'b', 'c'], 5)
      } catch (e) {
        return e
      }
    })()
    expect(error).toBeInstanceOf(RxError)
    expect(friendlyError(error, 'fr', 'junior')).toBe(
      'La liste n’a que 3 élément(s), et ce bloc demande le 5ᵉ.',
    )
    expect(friendlyError(error, 'en', 'studio')).toBe(
      'The list only has 3 item(s), and this block asks for the 5th.',
    )
    expect(() => listItem(42, 1)).toThrow(RxError)
  })

  it('gives the plain words in Junior, the JavaScript error too in Studio', () => {
    const error = new TypeError("Cannot read properties of undefined (reading 'length')")
    expect(friendlyError(error, 'fr', 'junior')).toBe(
      'Ce bloc cherche « length » dans une valeur vide : vérifie qu’une variable a bien reçu une valeur.',
    )
    expect(friendlyError(error, 'fr', 'studio')).toContain('(TypeError: Cannot read')
    expect(friendlyError(new TypeError('x is not iterable'), 'en', 'junior')).toBe(
      'This block expects a list, but it got something else.',
    )
  })

  it('links a list error from the generated code to its block', async () => {
    const { doc, home } = project()
    doc.blocks[home] = {
      evt: onClick('button', {
        ...setText('text', {
          type: 'lists_getIndex',
          fields: { MODE: 'GET', WHERE: 'FROM_START' },
          inputs: {
            VALUE: {
              block: {
                type: 'lists_create_with',
                extraState: { itemCount: 1 },
                inputs: { ADD0: { block: text('a') } },
              },
            },
            AT: { block: num(4) },
          },
        }),
        id: 'getter',
      }),
    }
    const logs: LogEntry[] = []
    const engine = new Engine({
      doc,
      code: generateProjectCode(doc),
      host: { log: (entry) => logs.push(entry) },
      loadModule: dataLoader,
    })
    await engine.start()
    engine.emit('button', 'click')
    await sleep(10)
    expect(logs).toEqual([
      expect.objectContaining({
        level: 'error',
        message: 'La liste n’a que 1 élément(s), et ce bloc demande le 4ᵉ.',
        blockId: 'getter',
      }),
    ])
    engine.dispose()
  })
})
