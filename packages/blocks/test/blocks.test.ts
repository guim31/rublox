import { COMPONENTS } from '@rublox/catalog'
import { messages } from '@rublox/i18n'
import * as Blockly from 'blockly/core'
import { describe, expect, it } from 'vitest'
import {
  BLOCK_TYPES,
  buildToolbox,
  componentBlockTypes,
  contextFromDoc,
  generateProjectCode,
  generateWorkspaceCode,
  headlessWorkspace,
  quote,
  RubloxGenerator,
} from '../src/index.ts'
import { num, onClick, project, setText, text } from './helpers.ts'

/** Compiles a generated module (without running it) to prove it is valid JavaScript. */
function compile(code: string) {
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor
  return new AsyncFunction(code.replace('export default async function', 'return async function'))
}

function generate(stacks: Record<string, unknown>, workspace?: string) {
  const { doc, screen } = project()
  return generateWorkspaceCode(stacks as never, contextFromDoc(doc, workspace ?? screen), [
    { id: 'v1', name: 'score' },
    { id: 'v2', name: 'mon nom' },
  ])
}

/** The body of the module, without the header, for compact snapshots. */
function body(stacks: Record<string, unknown>, workspace?: string) {
  const { code } = generate(stacks, workspace)
  compile(code)
  return code.slice(code.indexOf('export default'))
}

describe('catalog completeness', () => {
  it.each(COMPONENTS.map((def) => [def.type, def] as const))(
    '%s has blocks and generators',
    (_, def) => {
      const generator = new RubloxGenerator()
      const types = componentBlockTypes(def)
      expect(types.length).toBeGreaterThan(0)
      for (const locale of ['fr', 'en'] as const) {
        const { doc, screen } = project()
        const workspace = headlessWorkspace({}, contextFromDoc(doc, screen, { locale }))
        for (const type of types) {
          expect(Blockly.Blocks[type], type).toBeDefined()
          expect(generator.forBlock[type], type).toBeTypeOf('function')
          const block = workspace.newBlock(type)
          expect(block.toString().length, `${type} ${locale}`).toBeGreaterThan(0)
        }
        workspace.dispose()
      }
    },
  )

  it('has French and English labels on every general block', () => {
    for (const locale of ['fr', 'en'] as const) {
      const { doc, screen } = project()
      const workspace = headlessWorkspace({}, contextFromDoc(doc, screen, { locale }))
      for (const type of Object.values(BLOCK_TYPES)) {
        const label = workspace.newBlock(type).toString()
        expect(label.length, type).toBeGreaterThan(2)
      }
      workspace.dispose()
    }
    expect(Object.keys(messages.fr.blocks).sort()).toEqual(Object.keys(messages.en.blocks).sort())
  })
})

describe('generated code', () => {
  it('matches the readable module of SPEC § 6.5', () => {
    const { code } = generate({ evt: onClick('button', setText('text', text('Bonjour'))) })
    expect(code).toMatchSnapshot()
    compile(code)
  })

  it('maps each line to the block that produced it', () => {
    const { code, lineMap } = generate({
      evt: onClick('button', { ...setText('text', text('Bonjour')), id: 'set1' }),
    })
    const lines = code.split('\n')
    expect(lineMap).toHaveLength(lines.length)
    expect(lineMap[lines.findIndex((l) => l.includes('Texte1.text ='))]).toBe('set1')
    expect(lineMap[lines.findIndex((l) => l.includes('Bouton1.onClick'))]).toBe('evt')
    expect(lineMap[lines.findIndex((l) => l.trim() === '});')]).toBe('evt')
  })

  it('ignores loose blocks and disabled stacks', () => {
    const code = body({
      loose: { ...setText('text', text('X')), x: 300, y: 300 },
      off: { ...onClick('button', setText('text', text('Y')), 'off'), enabled: false },
    })
    expect(code).not.toContain("'X'")
    expect(code).not.toContain("'Y'")
  })

  it('keeps blocks of a deleted component without referencing it', () => {
    const code = body({ evt: onClick('gone', setText('text', text('A'))) })
    expect(code).not.toContain('gone')
    expect(code).toContain('// composant supprimé')
  })

  it('makes every loop yield with rx.tick', () => {
    const loops = [
      { type: 'controls_repeat_ext', inputs: { TIMES: { block: num(3) } } },
      {
        type: 'controls_whileUntil',
        fields: { MODE: 'WHILE' },
        inputs: { BOOL: { block: { type: 'logic_boolean', fields: { BOOL: 'TRUE' } } } },
      },
      {
        type: 'controls_for',
        fields: { VAR: { id: 'v1' } },
        inputs: { FROM: { block: num(1) }, TO: { block: num(5) }, BY: { block: num(1) } },
      },
      {
        type: 'controls_forEach',
        fields: { VAR: { id: 'v1' } },
        inputs: { LIST: { block: { type: 'lists_create_empty' } } },
      },
      { type: BLOCK_TYPES.forever },
    ]
    for (const loop of loops) {
      const code = body({
        evt: onClick('button', {
          ...loop,
          inputs: { ...loop.inputs, DO: { block: setText('text', text('x')) } },
        } as never),
      })
      expect(code, loop.type).toContain('await rx.tick();')
    }
  })

  it('writes app variables in app, and makes functions async', () => {
    const code = body({
      fn: {
        type: 'procedures_defreturn',
        x: 0,
        y: 0,
        extraState: { params: [{ name: 'n', id: 'p1' }] },
        fields: { NAME: 'double' },
        inputs: {
          RETURN: {
            block: {
              type: 'math_arithmetic',
              fields: { OP: 'MULTIPLY' },
              inputs: {
                A: { block: { type: 'variables_get', fields: { VAR: { id: 'p1' } } } },
                B: { block: num(2) },
              },
            },
          },
        },
      },
      evt: onClick('button', {
        type: 'variables_set',
        fields: { VAR: { id: 'v1' } },
        inputs: {
          VALUE: {
            block: {
              type: 'procedures_callreturn',
              extraState: { name: 'double', params: ['n'] },
              inputs: { ARG0: { block: { type: 'variables_get', fields: { VAR: { id: 'v2' } } } } },
            },
          },
        },
      }),
    })
    expect(code).toMatchSnapshot()
    expect(code).toContain('async function double(n)')
    expect(code).toContain("app.score = await double(app['mon nom']);")
  })
})

describe('one snapshot per block', () => {
  const statements: Record<string, unknown> = {
    rx_Text_set: setText('text', text('Salut')),
    rx_Button_set: {
      type: 'rx_Button_set',
      fields: { COMPONENT: 'button', PROP: 'color' },
      inputs: { VALUE: { block: { type: 'colour_picker', fields: { COLOUR: '#ff0000' } } } },
    },
    rx_TextInput_call_clear: { type: 'rx_TextInput_call_clear', fields: { COMPONENT: 'input' } },
    rx_TextInput_call_focus: { type: 'rx_TextInput_call_focus', fields: { COMPONENT: 'input' } },
    [BLOCK_TYPES.wait]: { type: BLOCK_TYPES.wait, inputs: { SECONDS: { block: num(2) } } },
    [BLOCK_TYPES.log]: {
      type: BLOCK_TYPES.log,
      inputs: {
        VALUE: {
          block: { type: 'rx_TextInput_get', fields: { COMPONENT: 'input', PROP: 'text' } },
        },
      },
    },
    [BLOCK_TYPES.screenOpen]: { type: BLOCK_TYPES.screenOpen, fields: { SCREEN: 'second' } },
    [BLOCK_TYPES.screenBack]: { type: BLOCK_TYPES.screenBack },
    [BLOCK_TYPES.alert]: { type: BLOCK_TYPES.alert, inputs: { MESSAGE: { block: text('Bravo') } } },
    [BLOCK_TYPES.toast]: { type: BLOCK_TYPES.toast, inputs: { MESSAGE: { block: text('OK') } } },
    confirm: setText('text', {
      type: BLOCK_TYPES.confirm,
      inputs: { MESSAGE: { block: text('Sûr ?') } },
    }),
    prompt: setText('text', {
      type: BLOCK_TYPES.prompt,
      inputs: { MESSAGE: { block: text('Nom ?') } },
    }),
    math_change: {
      type: 'math_change',
      fields: { VAR: { id: 'v1' } },
      inputs: { DELTA: { block: num(1) } },
    },
    text_join: setText('text', {
      type: 'text_join',
      extraState: { itemCount: 2 },
      inputs: {
        ADD0: { block: text('Bonjour ') },
        ADD1: { block: { type: 'rx_TextInput_get', fields: { COMPONENT: 'input', PROP: 'text' } } },
      },
    }),
    lists_getIndex: setText('text', {
      type: 'lists_getIndex',
      fields: { MODE: 'GET', WHERE: 'FROM_START' },
      inputs: {
        VALUE: {
          block: {
            type: 'lists_create_with',
            extraState: { itemCount: 2 },
            inputs: { ADD0: { block: text('a') }, ADD1: { block: text('b') } },
          },
        },
        AT: { block: num(1) },
      },
    }),
    controls_if: {
      type: 'controls_if',
      extraState: { hasElse: true },
      inputs: {
        IF0: {
          block: {
            type: 'logic_compare',
            fields: { OP: 'GT' },
            inputs: {
              A: { block: { type: 'variables_get', fields: { VAR: { id: 'v1' } } } },
              B: { block: num(10) },
            },
          },
        },
        DO0: { block: setText('text', text('Gagné')) },
        ELSE: { block: setText('text', text('Encore')) },
      },
    },
    math_random_int: setText('text', {
      type: 'math_random_int',
      inputs: { FROM: { block: num(1) }, TO: { block: num(6) } },
    }),
  }
  it.each(Object.entries(statements))('%s', (_, statement) => {
    expect(body({ evt: onClick('button', statement as never) })).toMatchSnapshot()
  })

  it.each(
    COMPONENTS.flatMap((def) =>
      Object.keys(def.events).map(
        (event) => [`rx_${def.type}_on_${event}`, def.type, event] as const,
      ),
    ),
  )('%s', (type, componentType) => {
    const id =
      { Screen: 'root', Button: 'button', Text: 'text', TextInput: 'input', Image: 'image' }[
        componentType
      ] ?? 'missing'
    const code = body({
      evt: {
        type,
        x: 0,
        y: 0,
        fields: { COMPONENT: id },
        inputs: {
          DO: { block: { type: BLOCK_TYPES.log, inputs: { VALUE: { block: text('!') } } } },
        },
      },
    })
    expect(code).toMatchSnapshot()
  })

  it('app start, in the app workspace', () => {
    const { doc } = project()
    const out = generateWorkspaceCode(
      {
        start: {
          type: BLOCK_TYPES.appStart,
          x: 0,
          y: 0,
          inputs: {
            DO: {
              block: {
                type: 'variables_set',
                fields: { VAR: { id: 'v1' } },
                inputs: { VALUE: { block: num(0) } },
              },
            },
          },
        },
      } as never,
      contextFromDoc(doc, 'app'),
      [{ id: 'v1', name: 'score' }],
    )
    compile(out.code)
    expect(out.code).toMatchSnapshot()
  })
})

describe('string escaping', () => {
  const traps = [
    `'; alert(1); '`,
    `"double" and 'single'`,
    '</script><script>alert(1)</script>',
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the trap itself
    '${alert(1)} `backtick`',
    'back\\slash \\',
    'line\nbreak\r\ttab',
    'sep arators ',
    'private  marker ',
    'émoji 🎉 accents ça',
  ]
  it.each(traps)('keeps %j a string', (trap) => {
    const literal = quote(trap)
    expect(new Function(`return ${literal}`)()).toBe(trap)
    const code = body({ evt: onClick('button', setText('text', text(trap))) })
    const line = code.split('\n').find((l) => l.includes('Texte1.text ='))
    expect(line).toBe(`    Texte1.text = ${literal};`)
  })

  it('keeps a trap a string once the module runs', async () => {
    const trap = `'); globalThis.hacked = true; ('</script>`
    const { code } = generate({ evt: onClick('button', setText('text', text(trap))) })
    const handlers: (() => Promise<void>)[] = []
    const values: unknown[] = []
    const components = {
      Bouton1: { onClick: (fn: () => Promise<void>) => handlers.push(fn) },
      Texte1: {
        set text(value: unknown) {
          values.push(value)
        },
      },
    }
    await (await compile(code)())({ components })
    await handlers[0]!()
    expect(values).toEqual([trap])
    expect((globalThis as { hacked?: boolean }).hacked).toBeUndefined()
  })
})

describe('project code', () => {
  it('generates one module per screen plus app', () => {
    const { doc, screen } = project()
    doc.blocks[screen] = { evt: onClick('button', setText('text', text('Bonjour'))) as never }
    const code = generateProjectCode(doc)
    expect(Object.keys(code).sort()).toEqual(['app', screen, 'second'].sort())
    for (const module of Object.values(code)) compile(module.code)
    expect(code[screen]!.code).toContain("Texte1.text = 'Bonjour';")
  })

  it('names the screen in the header, in the project language', () => {
    const { doc, screen } = project()
    expect(generateProjectCode(doc)[screen]!.code.split('\n')[0]).toBe('// Écran « Accueil »')
  })
})

describe('toolbox', () => {
  it('lists the components of the screen and keeps Junior smaller', () => {
    const { doc, screen } = project()
    const count = (mode: 'junior' | 'studio') =>
      JSON.stringify(buildToolbox(contextFromDoc(doc, screen, { mode }))).match(/"kind":"block"/g)
        ?.length ?? 0
    const junior = buildToolbox(contextFromDoc(doc, screen, { mode: 'junior' }))
    expect(JSON.stringify(junior)).toContain('"name":"Bouton1"')
    expect(count('junior')).toBeLessThan(count('studio'))
  })

  it('only references blocks that exist', () => {
    const { doc, screen } = project()
    const json = JSON.stringify(buildToolbox(contextFromDoc(doc, screen, { mode: 'studio' })))
    headlessWorkspace({}, contextFromDoc(doc, screen)).dispose()
    for (const [, type] of json.matchAll(/"type":"([^"]+)"/g)) {
      expect(Blockly.Blocks[type!], type).toBeDefined()
    }
  })
})
