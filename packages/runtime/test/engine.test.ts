import { generateProjectCode } from '@rublox/blocks'
import { describe, expect, it } from 'vitest'
import { engineFor, flush, num, onClick, project, setText, sleep, text, value } from './helpers.ts'

describe('engine', () => {
  it('runs "when Bouton1 is clicked, set Texte1.text to Bonjour"', async () => {
    const { doc, home } = project()
    doc.blocks[home] = {
      evt: onClick('button', setText('text', text('Bonjour'))),
    }
    const { engine, logs } = engineFor(doc)
    await engine.start()
    expect(value(engine, 'text', 'text')).toBeUndefined()
    engine.emit('button', 'click')
    await flush()
    expect(value(engine, 'text', 'text')).toBe('Bonjour')
    expect(logs).toEqual([])
    engine.dispose()
  })

  it('validates values written by the code', async () => {
    const { doc, home } = project()
    doc.blocks[home] = {
      evt: onClick('button', {
        type: 'rx_Text_set',
        fields: { COMPONENT: 'text', PROP: 'fontSize' },
        inputs: { VALUE: { block: text('énorme') } },
        next: { block: setText('text', num(42)) },
      }),
    }
    const { engine, logs } = engineFor(doc)
    await engine.start()
    engine.emit('button', 'click')
    await flush()
    expect(value(engine, 'text', 'fontSize')).toBeUndefined()
    expect(value(engine, 'text', 'text')).toBe('42')
    expect(logs.map((l) => l.level)).toEqual(['warn'])
    expect(logs[0]!.message).toContain('Texte1.fontSize')
    engine.dispose()
  })

  it('keeps what the user typed and fires change', async () => {
    const { doc, home } = project()
    doc.blocks[home] = {
      evt: {
        type: 'rx_TextInput_on_change',
        x: 0,
        y: 0,
        fields: { COMPONENT: 'input' },
        inputs: {
          DO: {
            block: setText('text', {
              type: 'rx_TextInput_get',
              fields: { COMPONENT: 'input', PROP: 'text' },
            }),
          },
        },
      },
    }
    const { engine } = engineFor(doc)
    await engine.start()
    engine.setValue('input', 'text', 'Alix')
    engine.emit('input', 'change')
    await flush()
    expect(value(engine, 'text', 'text')).toBe('Alix')
    engine.dispose()
  })

  it('navigates in a stack and keeps the previous screen state', async () => {
    const { doc, home } = project()
    doc.blocks[home] = {
      evt: onClick('button', {
        type: 'rx_screen_open',
        fields: { SCREEN: 'second' },
      }),
    }
    doc.blocks.second = {
      back: onClick('back', { type: 'rx_screen_back' }, 'back'),
    }
    const { engine } = engineFor(doc)
    await engine.start()
    engine.setValue('input', 'text', 'gardé')
    engine.emit('button', 'click')
    await sleep(10)
    expect(engine.getSnapshot().screen?.screenId).toBe('second')
    expect(engine.getSnapshot().depth).toBe(2)
    engine.emit('back', 'click')
    await sleep(10)
    expect(engine.getSnapshot().screen?.screenId).toBe(home)
    expect(value(engine, 'input', 'text')).toBe('gardé')
    engine.dispose()
  })

  it('does not freeze on an endless loop, and Stop ends it', async () => {
    const { doc, home } = project()
    doc.blocks[home] = {
      evt: onClick('button', {
        type: 'rx_forever',
        inputs: {
          DO: {
            block: {
              type: 'math_change',
              fields: { VAR: { id: 'v1' } },
              inputs: { DELTA: { block: num(1) } },
            },
          },
        },
      }),
      show: {
        type: 'rx_Text_on_click',
        x: 0,
        y: 300,
        fields: { COMPONENT: 'text' },
        inputs: {
          DO: {
            block: setText('text', {
              type: 'variables_get',
              fields: { VAR: { id: 'v1' } },
            }),
          },
        },
      },
    }
    const { engine, logs } = engineFor(doc)
    await engine.start()
    engine.emit('button', 'click')
    // Timers still fire while the loop runs: nothing is frozen.
    const started = Date.now()
    await sleep(60)
    expect(Date.now() - started).toBeLessThan(1000)
    engine.emit('text', 'click')
    await sleep(5)
    const during = Number(value(engine, 'text', 'text'))
    expect(during).toBeGreaterThan(0)
    engine.stop()
    engine.emit('text', 'click')
    await sleep(40)
    expect(engine.getSnapshot().running).toBe(false)
    expect(logs.filter((l) => l.level === 'error')).toEqual([])
    engine.dispose()
  })

  it('reports errors with the block that failed', async () => {
    const { doc, home } = project()
    doc.blocks[home] = {
      evt: onClick(
        'button',
        setText(
          'text',
          {
            type: 'math_on_list',
            fields: { OP: 'SUM' },
            inputs: {
              LIST: {
                block: { type: 'variables_get', fields: { VAR: { id: 'v1' } } },
              },
            },
          },
          { id: 'set' },
        ),
      ),
    }
    // score is the number 0, not a list: summing it throws a TypeError.
    const { engine, logs } = engineFor(doc)
    await engine.start()
    engine.emit('button', 'click')
    await sleep(10)
    const error = logs.find((l) => l.level === 'error')
    expect(error?.blockId).toBe('set')
    expect(error?.message).toMatch(/pas une action/)
    engine.dispose()
  })

  it('logs from the console block with its block id', async () => {
    const { doc, home } = project()
    doc.blocks[home] = {
      evt: onClick('button', {
        type: 'rx_log',
        id: 'log1',
        inputs: { VALUE: { block: text('coucou') } },
      }),
    }
    const { engine, logs } = engineFor(doc)
    await engine.start()
    engine.emit('button', 'click')
    await flush()
    expect(logs).toMatchObject([{ level: 'log', message: 'coucou', blockId: 'log1' }])
    engine.dispose()
  })

  it('keeps state on a design change and restarts the screen on a blocks change', async () => {
    const { doc, home } = project()
    doc.blocks[home] = { evt: onClick('button', setText('text', text('A'))) }
    const { engine } = engineFor(doc)
    await engine.start()
    engine.emit('button', 'click')
    await flush()
    const designed = structuredClone(doc)
    designed.screens[home]!.components.button!.props.text = 'Nouveau'
    await engine.update(designed, generateProjectCode(designed))
    expect(value(engine, 'text', 'text')).toBe('A')

    const reblocked = structuredClone(designed)
    reblocked.blocks[home] = {
      evt: onClick('button', setText('text', text('B'))),
    }
    await engine.update(reblocked, generateProjectCode(reblocked))
    expect(value(engine, 'text', 'text')).toBeUndefined()
    engine.emit('button', 'click')
    await flush()
    expect(value(engine, 'text', 'text')).toBe('B')
    engine.dispose()
  })

  it('runs the app start blocks before the first screen opens', async () => {
    const { doc, home } = project()
    doc.blocks.app = {
      start: {
        type: 'rx_app_start',
        x: 0,
        y: 0,
        inputs: {
          DO: {
            block: {
              type: 'variables_set',
              fields: { VAR: { id: 'v1' } },
              inputs: { VALUE: { block: num(7) } },
            },
          },
        },
      },
    }
    doc.blocks[home] = {
      open: {
        type: 'rx_Screen_on_open',
        x: 0,
        y: 0,
        fields: { COMPONENT: doc.screens[home]!.rootId },
        inputs: {
          DO: {
            block: setText('text', {
              type: 'variables_get',
              fields: { VAR: { id: 'v1' } },
            }),
          },
        },
      },
    }
    const { engine } = engineFor(doc)
    await engine.start()
    await flush()
    expect(value(engine, 'text', 'text')).toBe('7')
    engine.dispose()
  })
})
