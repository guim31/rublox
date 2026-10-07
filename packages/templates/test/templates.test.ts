import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  contextFromDoc,
  generateProjectCode,
  headlessWorkspace,
  projectVariables,
  setupBlocks,
} from '@rublox/blocks'
import { APP_WORKSPACE, LOCALES, projectDocSchema } from '@rublox/schema'
import * as Blockly from 'blockly/core'
import { describe, expect, it } from 'vitest'
import {
  buildProject,
  GENERAL_BLOCK_TYPES,
  knownBlockTypes,
  TEMPLATES,
  templateProject,
} from '../src/index.ts'

const CONTENT = resolve(import.meta.dirname, '../../../content/templates')

describe('templates', () => {
  it('declares every folder of content/templates', () => {
    const folders = readdirSync(CONTENT).sort()
    expect(TEMPLATES.map((t) => t.id).sort()).toEqual(folders)
  })

  it('has twelve templates', () => {
    expect(TEMPLATES).toHaveLength(12)
  })

  for (const template of TEMPLATES) {
    for (const locale of LOCALES) {
      it(`builds ${template.id} in ${locale}, and Blockly loads every block`, () => {
        const result = buildProject(template.recipe, {
          locale,
          mode: template.mode,
          name: template.texts[locale].title,
        })
        expect(result.issues).toEqual([])
        const doc = result.doc
        if (!doc) return
        expect(projectDocSchema.safeParse(doc).success).toBe(true)
        expect(template.texts[locale].title.length).toBeGreaterThan(0)
        expect(template.texts[locale].description.length).toBeGreaterThan(0)
        // Every stack loads without a warning (an unknown field value, a missing input…).
        setupBlocks(locale)
        for (const key of [APP_WORKSPACE, ...doc.screenOrder]) {
          const stacks = doc.blocks[key] ?? {}
          const workspace = headlessWorkspace(
            stacks,
            contextFromDoc(doc, key),
            projectVariables(doc),
          )
          try {
            expect(workspace.getTopBlocks(false)).toHaveLength(Object.keys(stacks).length)
            for (const block of workspace.getAllBlocks(false)) {
              for (const input of block.inputList) {
                for (const field of input.fieldRow) {
                  if (field.name && 'getOptions' in field) {
                    const options = (field as Blockly.FieldDropdown).getOptions(false)
                    const values = options.map((option) => option[1])
                    expect(values, `${block.type}.${field.name}`).toContain(field.getValue())
                  }
                }
              }
            }
          } finally {
            workspace.dispose()
          }
        }
        const code = generateProjectCode(doc)
        for (const module of Object.values(code)) expect(module.code).not.toContain('undefined(')
        // A second build gives a project too (fresh ids).
        expect(templateProject(template, { locale, mode: template.mode }).meta.name).toBe(
          template.texts[locale].title,
        )
      })
    }
  }
})

describe('block types', () => {
  it('every allowed type is registered in Blockly', () => {
    setupBlocks('fr')
    for (const type of knownBlockTypes()) expect(Blockly.Blocks[type], type).toBeDefined()
    expect(GENERAL_BLOCK_TYPES.length).toBeGreaterThan(50)
  })
})

describe('buildProject', () => {
  it('reports unknown components, properties, blocks and names', () => {
    const result = buildProject(
      {
        name: 'x',
        screens: [
          {
            name: 'Home',
            components: [
              { type: 'Rocket' },
              { type: 'Button', name: 'Go', props: { colour: 'red' } },
            ],
            blocks: [
              { type: 'rx_Button_on_click', fields: { COMPONENT: 'Missing' } },
              { type: 'teleport' },
              { type: 'rx_screen_open', fields: { SCREEN: 'Nowhere' } },
            ],
          },
        ],
      },
      { locale: 'en' },
    )
    expect(result.doc).toBeNull()
    const messages = result.issues.map((issue) => issue.message).join('\n')
    expect(messages).toContain('unknown component type "Rocket"')
    expect(messages).toContain('Button has no property "colour"')
    expect(messages).toContain('no component named "Missing"')
    expect(messages).toContain('unknown block type "teleport"')
    expect(messages).toContain('no screen named "Nowhere"')
  })

  it('resolves names, places invisible components and declares loop variables', () => {
    const result = buildProject(
      {
        name: 'x',
        screens: [
          {
            name: 'Home',
            components: [
              { type: 'Timer', name: 'Tick' },
              { type: 'Text', name: 'Out' },
            ],
          },
          { name: 'Other', components: [] },
        ],
        appBlocks: [],
        variables: [],
      },
      { locale: 'en' },
    )
    expect(result.issues).toEqual([])
    const home = result.doc?.screens[result.doc.screenOrder[0] as string]
    expect(home?.nonVisual).toHaveLength(1)
    expect(Object.values(home?.components ?? {}).map((c) => c.name)).toContain('Out')
  })
})
