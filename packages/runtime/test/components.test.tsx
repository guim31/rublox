import { createComponent, getComponentDef } from '@rublox/catalog'
import type { BlocklyJson } from '@rublox/schema'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PlayerApp } from '../src/index.ts'
import { engineFor, flush, project, sleep, value } from './helpers.ts'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/** The test project, plus one component of `type` with id `c` (visible or not). */
function withComponent(type: string, props: Record<string, unknown> = {}) {
  const { doc, home } = project()
  const screen = doc.screens[home]!
  const node = createComponent(
    type,
    'fr',
    Object.values(screen.components).map((c) => c.name),
  )
  node.props = { ...node.props, ...props }
  screen.components.c = node
  if (getComponentDef(type)?.visible) screen.components[screen.rootId]!.children!.push('c')
  else screen.nonVisual.push('c')
  return { doc, home, name: node.name }
}

const eventValue = (arg: string): BlocklyJson => ({ type: 'rx_event_value', fields: { ARG: arg } })
const setText = (value: BlocklyJson): BlocklyJson => ({
  type: 'rx_Text_set',
  fields: { COMPONENT: 'text', PROP: 'text' },
  inputs: { VALUE: { block: value } },
})
const on = (type: string, event: string, body: BlocklyJson): BlocklyJson => ({
  type: `rx_${type}_on_${event}`,
  x: 0,
  y: 0,
  fields: { COMPONENT: 'c' },
  inputs: { DO: { block: body } },
})

async function mount(engine: ReturnType<typeof engineFor>['engine']) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => root.render(<PlayerApp engine={engine} locale="fr" />))
  return {
    container,
    unmount: () => act(async () => root.unmount()),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('J2 components while running', () => {
  it('passes the tapped item of a list to its event', async () => {
    const { doc, home } = withComponent('ListView')
    doc.blocks[home] = { evt: on('ListView', 'itemClick', setText(eventValue('item'))) }
    const { engine, logs } = engineFor(doc)
    await engine.start()
    const view = await mount(engine)
    const buttons = view.container.querySelectorAll<HTMLButtonElement>('[data-rx-id="c"] button')
    expect(buttons).toHaveLength(3)
    await act(async () => {
      buttons[1]?.click()
      await flush()
    })
    expect(value(engine, 'text', 'text')).toBe('Pain')
    expect(value(engine, 'c', 'selectedIndex')).toBe(2)
    expect(logs).toEqual([])
    await view.unmount()
    engine.dispose()
  })

  it('changes a list with its methods', async () => {
    const { doc, home } = withComponent('ListView')
    doc.blocks[home] = {
      evt: {
        type: 'rx_Button_on_click',
        x: 0,
        y: 0,
        fields: { COMPONENT: 'button' },
        inputs: {
          DO: {
            block: {
              type: 'rx_ListView_call_removeItem',
              fields: { COMPONENT: 'c' },
              inputs: { ARG0: { block: { type: 'math_number', fields: { NUM: 1 } } } },
              next: {
                block: {
                  type: 'rx_ListView_call_addItem',
                  fields: { COMPONENT: 'c' },
                  inputs: { ARG0: { block: { type: 'text', fields: { TEXT: 'Œufs' } } } },
                },
              },
            },
          },
        },
      },
    }
    const { engine } = engineFor(doc)
    await engine.start()
    engine.emit('button', 'click')
    await flush()
    expect(value(engine, 'c', 'items')).toEqual(['Pain', 'Lait', 'Œufs'])
    engine.dispose()
  })

  it('reports the slider value and keeps it', async () => {
    const { doc, home } = withComponent('Slider')
    doc.blocks[home] = { evt: on('Slider', 'change', setText(eventValue('value'))) }
    const { engine } = engineFor(doc)
    await engine.start()
    engine.setValue('c', 'value', 72)
    engine.emit('c', 'change', { value: 72 })
    await flush()
    expect(value(engine, 'text', 'text')).toBe('72')
    engine.dispose()
  })

  it('rings a timer and stops it when the screen closes', async () => {
    const { doc, home } = withComponent('Timer', { interval: 0.05 })
    doc.blocks[home] = { evt: on('Timer', 'tick', setText(eventValue('count'))) }
    const { engine } = engineFor(doc)
    await engine.start()
    await sleep(180)
    const count = Number(value(engine, 'text', 'text'))
    expect(count).toBeGreaterThanOrEqual(2)
    engine.stop()
    await sleep(120)
    expect(Number(value(engine, 'text', 'text'))).toBe(count)
    engine.dispose()
  })

  it('says when a feature is missing, with an explicit error event', async () => {
    vi.stubGlobal('navigator', { ...globalThis.navigator, vibrate: undefined })
    const { doc, home } = withComponent('Vibrator')
    doc.blocks[home] = {
      err: on('Vibrator', 'error', setText(eventValue('message'))),
      evt: {
        type: 'rx_Button_on_click',
        x: 0,
        y: 300,
        fields: { COMPONENT: 'button' },
        inputs: {
          DO: {
            block: {
              type: 'rx_Vibrator_call_vibrate',
              fields: { COMPONENT: 'c' },
              inputs: { ARG0: { block: { type: 'math_number', fields: { NUM: 1 } } } },
            },
          },
        },
      },
    }
    const { engine, logs } = engineFor(doc)
    await engine.start()
    expect(value(engine, 'c', 'available')).toBe(false)
    engine.emit('button', 'click')
    await flush()
    expect(String(value(engine, 'text', 'text'))).toContain('Vibreur')
    expect(logs.map((l) => l.level)).toEqual(['warn'])
    engine.dispose()
  })

  it('explains a refused permission', async () => {
    vi.stubGlobal('navigator', {
      ...globalThis.navigator,
      geolocation: {
        getCurrentPosition: (_ok: unknown, fail: (error: { code: number }) => void) =>
          fail({ code: 1 }),
        watchPosition: () => 0,
        clearWatch: () => {},
      },
    })
    const { doc, home } = withComponent('Location')
    doc.blocks[home] = {
      err: on('Location', 'error', setText(eventValue('message'))),
      evt: {
        type: 'rx_Button_on_click',
        x: 0,
        y: 300,
        fields: { COMPONENT: 'button' },
        inputs: { DO: { block: { type: 'rx_Location_call_update', fields: { COMPONENT: 'c' } } } },
      },
    }
    const { engine } = engineFor(doc)
    await engine.start()
    expect(value(engine, 'c', 'available')).toBe(true)
    engine.emit('button', 'click')
    await flush()
    expect(String(value(engine, 'text', 'text'))).toContain('refusé l’accès à : ta position')
    engine.dispose()
  })

  it('gives the position to blocks', async () => {
    vi.stubGlobal('navigator', {
      ...globalThis.navigator,
      geolocation: {
        getCurrentPosition: (ok: (p: unknown) => void) =>
          ok({ coords: { latitude: 43.6, longitude: 1.44, accuracy: 12.4 } }),
        watchPosition: () => 0,
        clearWatch: () => {},
      },
    })
    const { doc, home } = withComponent('Location')
    doc.blocks[home] = {
      evt: {
        type: 'rx_Button_on_click',
        x: 0,
        y: 0,
        fields: { COMPONENT: 'button' },
        inputs: {
          DO: {
            block: {
              type: 'rx_Location_call_update',
              fields: { COMPONENT: 'c' },
              next: {
                block: setText({
                  type: 'rx_Location_get',
                  fields: { COMPONENT: 'c', PROP: 'latitude' },
                }),
              },
            },
          },
        },
      },
    }
    const { engine } = engineFor(doc)
    await engine.start()
    engine.emit('button', 'click')
    await sleep(5)
    expect(value(engine, 'text', 'text')).toBe('43.6')
    expect(value(engine, 'c', 'accuracy')).toBe(12)
    engine.dispose()
  })
})

describe('rendering stays quiet', () => {
  it('draws a dropdown without redrawing forever', async () => {
    const { doc } = withComponent('Dropdown', { selected: 'Vert' })
    const { engine } = engineFor(doc)
    await engine.start()
    const view = await mount(engine)
    await act(async () => {
      await sleep(30)
    })
    const version = engine.getSnapshot().version
    await act(async () => {
      await sleep(30)
    })
    expect(engine.getSnapshot().version).toBe(version)
    expect(value(engine, 'c', 'selectedIndex')).toBe(2)
    await view.unmount()
    engine.dispose()
  })
})
