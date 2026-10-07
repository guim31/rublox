import {
  addApi,
  addColumn,
  addTable,
  addVariable,
  projectToYDoc,
  yDocToProject,
} from '@rublox/schema'
import * as Blockly from 'blockly/core'
import { describe, expect, it } from 'vitest'
import {
  buildToolbox,
  contextFromDoc,
  DATA_BLOCK_TYPES,
  generateWorkspaceCode,
  headlessWorkspace,
  projectVariables,
  variablesFlyout,
} from '../src/index.ts'
import { onClick, project, text } from './helpers.ts'

/** The test project with a table Contacts (Nom, Âge), an API Météo and a shared variable. */
function dataProject() {
  const { doc: base, screen } = project()
  const ydoc = projectToYDoc(base)
  addTable(ydoc, { id: 'tContacts', name: 'Contacts' })
  addColumn(ydoc, 'tContacts', { id: 'cNom', name: 'Nom', type: 'text' })
  addColumn(ydoc, 'tContacts', { id: 'cAge', name: 'Âge', type: 'number' })
  addApi(ydoc, { id: 'aMeteo', name: 'Météo', baseUrl: 'https://api.example.com' })
  addVariable(ydoc, 'shared', { id: 'vScore', name: 'score' })
  return { doc: yDocToProject(ydoc), screen }
}

function compile(code: string) {
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor
  return new AsyncFunction(code.replace('export default async function', 'return async function'))
}

function body(stacks: Record<string, unknown>, locale: 'fr' | 'en' = 'fr') {
  const { doc, screen } = dataProject()
  const { code } = generateWorkspaceCode(
    stacks as never,
    contextFromDoc(doc, screen, { locale }),
    projectVariables(doc),
  )
  compile(code)
  return code.slice(code.indexOf('export default'))
}

const rows = { type: DATA_BLOCK_TYPES.tableRows, fields: { TABLE: 'tContacts' } }

describe('data blocks (J5)', () => {
  it('reads, filters, sorts and counts a table', () => {
    const code = body({
      a: onClick('button', {
        type: 'variables_set',
        fields: { VAR: { id: 'vScore' } },
        inputs: {
          VALUE: {
            block: {
              type: DATA_BLOCK_TYPES.tableSort,
              fields: { TABLE: 'tContacts', COLUMN: 'cAge', ORDER: 'DESC' },
              inputs: {
                ROWS: {
                  block: {
                    type: DATA_BLOCK_TYPES.tableWhere,
                    fields: { TABLE: 'tContacts', COLUMN: 'cNom', OP: 'contains' },
                    inputs: { VALUE: { block: text('a') } },
                  },
                },
              },
            },
          },
        },
        next: {
          block: {
            type: 'rx_log',
            inputs: {
              VALUE: {
                block: { type: DATA_BLOCK_TYPES.tableCount, fields: { TABLE: 'tContacts' } },
              },
            },
          },
        },
      }),
    })
    expect(code).toContain(
      "shared.score = data.Contacts.sort(data.Contacts.where('Nom', 'contains', 'a'), 'Âge', false);",
    )
    expect(code).toContain('rx.log(data.Contacts.count());')
    expect(code).toContain('{ components, app, stored, shared, screens, ui, device, rx, data }')
    expect(code).toMatchSnapshot()
  })

  it('adds, changes and deletes rows, and listens to changes', () => {
    const code = body({
      a: onClick('button', {
        type: DATA_BLOCK_TYPES.tableAdd,
        extraState: { columns: ['cNom', 'cAge'] },
        fields: { TABLE: 'tContacts' },
        inputs: {
          COL_cNom: { block: text('Léa') },
          COL_cAge: { block: { type: 'math_number', fields: { NUM: 9 } } },
        },
        next: {
          block: {
            type: DATA_BLOCK_TYPES.tableSet,
            fields: { TABLE: 'tContacts', COLUMN: 'cAge' },
            inputs: {
              ROW: { block: { type: 'math_number', fields: { NUM: 1 } } },
              VALUE: { block: { type: 'math_number', fields: { NUM: 10 } } },
            },
            next: {
              block: {
                type: DATA_BLOCK_TYPES.tableRemove,
                fields: { TABLE: 'tContacts' },
                inputs: { ROW: { block: { type: 'math_number', fields: { NUM: 1 } } } },
              },
            },
          },
        },
      }),
      b: {
        type: DATA_BLOCK_TYPES.tableOnChange,
        x: 0,
        y: 200,
        fields: { TABLE: 'tContacts' },
        inputs: { DO: { block: { type: 'rx_log', inputs: { VALUE: { block: rows } } } } },
      },
      c: {
        type: DATA_BLOCK_TYPES.sharedOnChange,
        x: 0,
        y: 400,
        fields: { VAR: 'vScore' },
        inputs: { DO: { block: { type: 'rx_log', inputs: { VALUE: { block: text('!') } } } } },
      },
    })
    expect(code).toContain("await data.Contacts.add({ 'Nom': 'Léa', 'Âge': 9 });")
    expect(code).toContain("await data.Contacts.set(1, 'Âge', 10);")
    expect(code).toContain('await data.Contacts.remove(1);')
    expect(code).toContain('data.Contacts.onChange(async () => {')
    expect(code).toContain("data.onShared('score', async () => {")
    expect(code).toMatchSnapshot()
  })

  it('calls an API and reads its answer', () => {
    const code = body({
      a: onClick('button', {
        type: 'rx_log',
        inputs: {
          VALUE: {
            block: {
              type: DATA_BLOCK_TYPES.objectGet,
              fields: { PATH: 'current.temperature_2m' },
              inputs: {
                OBJECT: {
                  block: {
                    type: DATA_BLOCK_TYPES.apiRequest,
                    fields: { API: 'aMeteo', METHOD: 'GET' },
                    inputs: {
                      PATH: { block: text('/v1/forecast') },
                      QUERY: {
                        block: {
                          type: DATA_BLOCK_TYPES.objectSet,
                          fields: { KEY: 'latitude' },
                          inputs: {
                            OBJECT: { block: { type: DATA_BLOCK_TYPES.objectCreate } },
                            VALUE: { block: { type: 'math_number', fields: { NUM: 48.85 } } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    })
    expect(code).toContain(
      "rx.log(rx.get(await web.Météo.get('/v1/forecast', rx.set({}, 'latitude', 48.85)), 'current.temperature_2m'));",
    )
    expect(code).toContain('{ components, app, stored, shared, screens, ui, device, rx, web }')
  })

  it('leaves a comment for a deleted table, and keeps names in strings', () => {
    const code = body({
      a: onClick('button', { type: DATA_BLOCK_TYPES.tableClear, fields: { TABLE: 'gone' } }),
    })
    expect(code).toContain('// Cette table a été supprimée')
    expect(code).not.toContain('data,')
  })

  it('offers the blocks of each table and the shared variables in the toolbox', () => {
    const { doc, screen } = dataProject()
    const context = contextFromDoc(doc, screen, { mode: 'studio' })
    const toolbox = JSON.stringify(buildToolbox(context))
    for (const type of Object.values(DATA_BLOCK_TYPES)) {
      if (type === DATA_BLOCK_TYPES.sharedOnChange) continue
      expect(toolbox, type).toContain(`"${type}"`)
    }
    const workspace = headlessWorkspace({}, context, projectVariables(doc))
    const flyout = JSON.stringify(variablesFlyout(workspace))
    expect(flyout).toContain(DATA_BLOCK_TYPES.sharedOnChange)
    expect(flyout).toContain('vScore')
    // Every block builds in both languages, with its fields.
    for (const type of Object.values(DATA_BLOCK_TYPES)) {
      const block = workspace.newBlock(type)
      expect(block.toString().length, type).toBeGreaterThan(0)
    }
    const add = workspace.newBlock(DATA_BLOCK_TYPES.tableAdd)
    add.setFieldValue('tContacts', 'TABLE')
    expect(add.inputList.map((input) => input.name)).toEqual(['', 'COL_cNom', 'COL_cAge'])
    expect(Blockly.serialization.blocks.save(add)?.extraState).toEqual({
      columns: ['cNom', 'cAge'],
    })
    workspace.dispose()
  })
})
