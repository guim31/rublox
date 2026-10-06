import { COMPONENTS, createComponent } from '@rublox/catalog'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PlayerApp, RENDERERS, ScreenView } from '../src/index.ts'
import { engineFor, flush, onClick, project, setText, text } from './helpers.ts'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('renderers', () => {
  it.each(COMPONENTS.map((def) => def.type))(
    '%s has a renderer that draws in both languages',
    (type) => {
      expect(RENDERERS[type]).toBeTypeOf('function')
      for (const locale of ['fr', 'en'] as const) {
        const node = createComponent(type, locale, [])
        const html = renderToString(
          <ScreenView
            screen={{
              name: 'S',
              rootId: 'x',
              components: { x: node },
              nonVisual: [],
            }}
            locale={locale}
            mode="design"
          />,
        )
        expect(html).toContain('data-rx-id="x"')
        expect(html).toContain(`data-rx-type="${type}"`)
      }
    },
  )
})

describe('PlayerApp', () => {
  it('shows "Bonjour" after a click on the button', async () => {
    const { doc, home } = project()
    doc.blocks[home] = {
      evt: onClick('button', setText('text', text('Bonjour'))),
    }
    const { engine } = engineFor(doc)
    await engine.start()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(<PlayerApp engine={engine} locale="fr" />))
    const button = container.querySelector<HTMLButtonElement>('[data-rx-name="Bouton1"]')
    expect(button?.textContent).toBe('Bouton')
    await act(async () => {
      button?.click()
      await flush()
    })
    expect(container.querySelector('[data-rx-name="Texte1"]')?.textContent).toBe('Bonjour')
    await act(async () => root.unmount())
    engine.dispose()
  })

  it('shows dialogs and resolves them', async () => {
    const { doc, home } = project()
    doc.blocks[home] = {
      evt: onClick('button', {
        type: 'rx_ui_alert',
        inputs: { MESSAGE: { block: text('Salut !') } },
        next: { block: setText('text', text('fermé')) },
      }),
    }
    const { engine } = engineFor(doc)
    await engine.start()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(<PlayerApp engine={engine} locale="fr" />))
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-rx-name="Bouton1"]')?.click()
      await flush()
    })
    expect(container.querySelector('[role="alertdialog"]')?.textContent).toContain('Salut !')
    await act(async () => {
      container.querySelector<HTMLButtonElement>('.rx-dialog-primary')?.click()
      await flush()
    })
    expect(container.querySelector('[role="alertdialog"]')).toBeNull()
    expect(container.querySelector('[data-rx-name="Texte1"]')?.textContent).toBe('fermé')
    await act(async () => root.unmount())
    engine.dispose()
  })
})
