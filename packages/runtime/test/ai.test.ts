import { createComponent } from '@rublox/catalog'
import type { BlocklyJson } from '@rublox/schema'
import { describe, expect, it, vi } from 'vitest'
import type { AiProvider } from '../src/index.ts'
import { engineFor, flush, project, value } from './helpers.ts'

/** The test project with an AI component `ai` and blocks asking it on a click. */
function aiProject(method: BlocklyJson) {
  const { doc, home } = project()
  const screen = doc.screens[home]!
  screen.components.ai = createComponent('AI', 'fr', ['Bouton1', 'Texte1', 'Champ1'])
  screen.components.ai.props.instructions = 'Tu es un pirate.'
  screen.nonVisual.push('ai')
  doc.blocks[home] = {
    click: {
      type: 'rx_Button_on_click',
      x: 0,
      y: 0,
      fields: { COMPONENT: 'button' },
      inputs: {
        DO: {
          block: {
            type: 'rx_Text_set',
            fields: { COMPONENT: 'text', PROP: 'text' },
            inputs: { VALUE: { block: method } },
          },
        },
      },
    },
    error: {
      type: 'rx_AI_on_error',
      x: 0,
      y: 300,
      fields: { COMPONENT: 'ai' },
      inputs: {
        DO: {
          block: {
            type: 'rx_TextInput_set',
            fields: { COMPONENT: 'input', PROP: 'text' },
            inputs: { VALUE: { block: { type: 'rx_event_value', fields: { ARG: 'message' } } } },
          },
        },
      },
    },
  }
  return { doc, home }
}

const generate: BlocklyJson = {
  type: 'rx_AI_call_generate',
  fields: { COMPONENT: 'ai' },
  inputs: { ARG0: { block: { type: 'text', fields: { TEXT: 'Une blague' } } } },
}

describe('AI component', () => {
  it('answers with the assistant, its instructions in front', async () => {
    const ai = vi.fn<AiProvider>(async () => ({ text: 'Arrr !' }))
    const { doc } = aiProject(generate)
    const { engine } = engineFor(doc, { ai })
    await engine.start()
    expect(value(engine, 'ai', 'available')).toBe(true)
    engine.emit('button', 'click')
    await flush()
    await flush()
    expect(value(engine, 'text', 'text')).toBe('Arrr !')
    expect(ai).toHaveBeenCalledWith({ prompt: 'Tu es un pirate.\n\nUne blague' })
    expect(value(engine, 'ai', 'busy')).toBe(false)
    engine.dispose()
  })

  it('answers nothing, with its error event, without an assistant', async () => {
    const { doc } = aiProject(generate)
    const { engine, logs } = engineFor(doc)
    await engine.start()
    expect(value(engine, 'ai', 'available')).toBe(false)
    engine.emit('button', 'click')
    await flush()
    expect(value(engine, 'text', 'text')).toBe('')
    expect(String(value(engine, 'input', 'text'))).toContain('IA')
    expect(logs.map((l) => l.level)).toEqual(['warn'])
    engine.dispose()
  })

  it('says so when the assistant declines', async () => {
    const { doc } = aiProject(generate)
    const { engine } = engineFor(doc, { ai: async () => ({ refused: true }) })
    await engine.start()
    engine.emit('button', 'click')
    await flush()
    await flush()
    expect(String(value(engine, 'input', 'text'))).toContain('ne peut pas')
    engine.dispose()
  })

  it('describes an image', async () => {
    const ai = vi.fn<AiProvider>(async () => ({ text: 'Un chat.' }))
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        blob: async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }),
      })),
    )
    const { doc } = aiProject({
      type: 'rx_AI_call_describe',
      fields: { COMPONENT: 'ai' },
      inputs: {
        ARG0: { block: { type: 'text', fields: { TEXT: 'https://example.com/chat.png' } } },
        ARG1: { block: { type: 'text', fields: { TEXT: '' } } },
      },
    })
    const { engine } = engineFor(doc, { ai })
    await engine.start()
    engine.emit('button', 'click')
    for (let i = 0; i < 5; i++) await flush()
    expect(value(engine, 'text', 'text')).toBe('Un chat.')
    expect(ai.mock.calls[0]?.[0].image).toEqual({ mediaType: 'image/png', data: 'AQID' })
    vi.unstubAllGlobals()
    engine.dispose()
  })
})
