import { DATA_BLOCK_TYPES as D } from '@rublox/blocks'
import {
  addApi,
  addColumn,
  addRows,
  addTable,
  addVariable,
  type BlocklyJson,
  type ProjectDoc,
  projectToYDoc,
  type SharedToApp,
  yDocToProject,
} from '@rublox/schema'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import type { DataServices, SharedWrite } from '../src/data/store.ts'
import { ScreenView } from '../src/index.ts'
import { engineFor, flush, num, onClick, project, setText, text, value } from './helpers.ts'

const ids = { contacts: 'tC', name: 'cName', age: 'cAge', messages: 'tM', body: 'cBody', api: 'aW' }

/** The test project with a local table Contacts, a shared table Messages and an API. */
function dataProject(): { doc: ProjectDoc; home: string } {
  const { doc: base, home } = project()
  const ydoc = projectToYDoc(base)
  addTable(ydoc, { id: ids.contacts, name: 'Contacts' })
  addColumn(ydoc, ids.contacts, { id: ids.name, name: 'Nom', type: 'text' })
  addColumn(ydoc, ids.contacts, { id: ids.age, name: 'Âge', type: 'number' })
  addRows(ydoc, ids.contacts, [
    { [ids.name]: 'Léa', [ids.age]: 9 },
    { [ids.name]: 'Tom', [ids.age]: 12 },
  ])
  addTable(ydoc, { id: ids.messages, name: 'Messages', mode: 'shared' })
  addColumn(ydoc, ids.messages, { id: ids.body, name: 'Texte', type: 'text' })
  addApi(ydoc, { id: ids.api, name: 'Meteo', baseUrl: 'https://api.example.com' })
  addVariable(ydoc, 'shared', { id: 'vS', name: 'votes', initial: 0 })
  return { doc: yDocToProject(ydoc), home }
}

const log = (block: BlocklyJson): BlocklyJson => ({ type: 'rx_log', inputs: { VALUE: { block } } })
const count = (table: string): BlocklyJson => ({ type: D.tableCount, fields: { TABLE: table } })
const then = (first: BlocklyJson, next: BlocklyJson): BlocklyJson => ({
  ...first,
  next: { block: next },
})

/** A fake server: what the app sends, and a way to push messages to it. */
function fakeServices(answer: (path: string) => { status: number; body: unknown }) {
  const sent: SharedWrite[] = []
  let push: (message: SharedToApp) => void = () => {}
  const services: DataServices = {
    request: async (call) => ({ ...answer(call.path), contentType: 'application/json' }),
    shared: (handlers) => {
      push = handlers.message
      queueMicrotask(() =>
        handlers.message({ type: 'hello', variables: { vS: 3 }, tables: { [ids.messages]: [] } }),
      )
      return {
        send: async (message) => {
          sent.push(message)
          if (message.type === 'add') {
            const row = { id: `r${sent.length}`, values: message.values }
            handlers.message({ type: 'row', table: message.table, row })
            return { row: row.id }
          }
          if (message.type === 'set') {
            handlers.message({ type: 'var', variable: message.variable, value: message.value })
          }
          return {}
        },
        close: () => {},
      }
    },
  }
  return { services, sent, push: (message: SharedToApp) => push(message) }
}

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('tables in the engine (J5)', () => {
  it('reads, adds, changes and deletes rows of a local table, kept on the device', async () => {
    const { doc, home } = dataProject()
    // Add Zoé, delete the first row, then show "Nom of item 1 of (rows where Âge < 10)".
    const firstYoung: BlocklyJson = {
      type: 'lists_getIndex',
      fields: { MODE: 'GET', WHERE: 'FROM_START' },
      inputs: {
        VALUE: {
          block: {
            type: D.tableWhere,
            fields: { TABLE: ids.contacts, COLUMN: ids.age, OP: '<' },
            inputs: { VALUE: { block: num(10) } },
          },
        },
        AT: { block: num(1) },
      },
    }
    doc.blocks[home] = {
      evt: onClick(
        'button',
        then(
          {
            type: D.tableAdd,
            extraState: { columns: [ids.name, ids.age] },
            fields: { TABLE: ids.contacts },
            inputs: {
              [`COL_${ids.name}`]: { block: text('Zoé') },
              [`COL_${ids.age}`]: { block: num(7) },
            },
          },
          then(
            {
              type: D.tableRemove,
              fields: { TABLE: ids.contacts },
              inputs: { ROW: { block: num(1) } },
            },
            setText('text', {
              type: D.tableGet,
              fields: { TABLE: ids.contacts, COLUMN: ids.name },
              inputs: { ROW: { block: firstYoung } },
            }),
          ),
        ),
      ),
    }
    const stored = new Map<string, string>()
    const storage = {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, v: string) => void stored.set(key, v),
    }
    const { engine, logs } = engineFor(doc, { storage })
    await engine.start()
    engine.emit('button', 'click')
    await flush()
    await flush()
    expect(logs.filter((l) => l.level === 'error')).toEqual([])
    expect(engine.data.objects(ids.contacts).map((row) => row.Nom)).toEqual(['Tom', 'Zoé'])
    expect(value(engine, 'text', 'text')).toBe('Zoé')
    engine.dispose()

    // Another run on the same device finds the rows the app changed.
    const again = engineFor(doc, { storage }).engine
    await again.start()
    expect(again.data.objects(ids.contacts).map((row) => row.Nom)).toEqual(['Tom', 'Zoé'])
    again.dispose()

    // Rows edited in the Data tab win over the device's copy.
    const edited = structuredClone(doc)
    edited.data.tables[ids.contacts]!.rows.push({ id: 'new', values: { [ids.name]: 'Ana' } })
    const third = engineFor(edited, { storage }).engine
    await third.start()
    expect(third.data.objects(ids.contacts).map((row) => row.Nom)).toEqual(['Léa', 'Tom', 'Ana'])
    third.dispose()
  })

  it('runs "when the table changes" and explains a missing column', async () => {
    const { doc, home } = dataProject()
    doc.blocks[home] = {
      evt: onClick('button', {
        type: D.tableClear,
        fields: { TABLE: ids.contacts },
      }),
      change: {
        type: D.tableOnChange,
        x: 0,
        y: 300,
        fields: { TABLE: ids.contacts },
        inputs: { DO: { block: log(count(ids.contacts)) } },
      },
    }
    const { engine, logs } = engineFor(doc)
    await engine.start()
    engine.emit('button', 'click')
    await flush()
    await flush()
    expect(logs.map((l) => l.message)).toEqual(['0'])
    await expect((async () => engine.data.column('Contacts', 'Téléphone'))()).rejects.toThrow()
    engine.dispose()
  })
})

describe('shared data and APIs (J5)', () => {
  it('syncs shared variables and rows through the services', async () => {
    const { doc, home } = dataProject()
    doc.blocks[home] = {
      evt: onClick(
        'button',
        then(
          {
            type: 'math_change',
            fields: { VAR: { id: 'vS' } },
            inputs: { DELTA: { block: num(1) } },
          },
          {
            type: D.tableAdd,
            extraState: { columns: [ids.body] },
            fields: { TABLE: ids.messages },
            inputs: { [`COL_${ids.body}`]: { block: text('Coucou') } },
          },
        ),
      ),
      votes: {
        type: D.sharedOnChange,
        x: 0,
        y: 300,
        fields: { VAR: 'vS' },
        inputs: { DO: { block: log({ type: 'variables_get', fields: { VAR: { id: 'vS' } } }) } },
      },
    }
    const fake = fakeServices(() => ({ status: 200, body: {} }))
    const { engine, logs } = engineFor(doc, { services: fake.services })
    await engine.start()
    await flush()
    engine.emit('button', 'click')
    await flush()
    await flush()
    expect(fake.sent).toEqual([
      { type: 'set', variable: 'vS', value: 4 },
      { type: 'add', table: ids.messages, values: { [ids.body]: 'Coucou' } },
    ])
    expect(engine.data.objects(ids.messages).map((row) => row.Texte)).toEqual(['Coucou'])
    // Someone else changes the variable: the event runs again.
    fake.push({ type: 'var', variable: 'vS', value: 10 })
    await flush()
    expect(logs.map((l) => l.message)).toEqual(['4', '10'])
    engine.dispose()
  })

  it('calls an API and reads a field of its answer; an error status is explained', async () => {
    const { doc, home } = dataProject()
    const call = (path: string): BlocklyJson => ({
      type: D.objectGet,
      fields: { PATH: 'current.temperature' },
      inputs: {
        OBJECT: {
          block: {
            type: D.apiRequest,
            fields: { API: ids.api, METHOD: 'GET' },
            inputs: { PATH: { block: text(path) } },
          },
        },
      },
    })
    doc.blocks[home] = {
      evt: onClick('button', setText('text', call('/ok'))),
      bad: onClick('input', log(call('/missing')), 'bad'),
    }
    doc.blocks[home]!.bad = {
      ...(doc.blocks[home]!.bad as BlocklyJson),
      type: 'rx_TextInput_on_change',
    }
    const fake = fakeServices((path) =>
      path === '/ok'
        ? { status: 200, body: { current: { temperature: 21.5 } } }
        : { status: 404, body: '' },
    )
    const { engine, logs } = engineFor(doc, { services: fake.services })
    await engine.start()
    engine.emit('button', 'click')
    engine.emit('input', 'change')
    await flush()
    await flush()
    expect(value(engine, 'text', 'text')).toBe('21.5')
    expect(logs.find((l) => l.level === 'error')?.message).toBe(
      '« Meteo » a répondu par une erreur (404).',
    )
    engine.dispose()
  })

  it('says why an API cannot be called without the server', async () => {
    const { doc, home } = dataProject()
    doc.blocks[home] = {
      evt: onClick('button', {
        type: D.apiSend,
        fields: { API: ids.api, METHOD: 'POST' },
        inputs: { PATH: { block: text('') } },
      }),
    }
    const { engine, logs } = engineFor(doc)
    await engine.start()
    engine.emit('button', 'click')
    await flush()
    await flush()
    expect(logs.find((l) => l.level === 'error')?.message).toContain('passe par le serveur')
    engine.dispose()
  })
})

describe('bound lists (J5)', () => {
  it('draws the rows of the bound table', () => {
    const { doc, home } = dataProject()
    const screen = doc.screens[home]!
    screen.components.list = {
      type: 'DataList',
      name: 'ListeDonnees1',
      props: { source: { table: ids.contacts, fields: { title: ids.name, subtitle: ids.age } } },
    }
    screen.components[screen.rootId]!.children!.push('list')
    const { engine } = engineFor(doc)
    const container = document.createElement('div')
    const root = createRoot(container)
    act(() =>
      root.render(
        <ScreenView screen={screen} locale="fr" mode="design" tableRows={engine.tableRows} />,
      ),
    )
    const titles = [...container.querySelectorAll('.rx-card-title')].map((e) => e.textContent)
    expect(titles).toEqual(['Léa', 'Tom'])
    expect(container.querySelector('.rx-card-subtitle')?.textContent).toBe('9')
    act(() => root.unmount())
  })
})
