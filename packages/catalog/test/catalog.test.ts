import {
  addComponent,
  addScreen,
  isValidName,
  LOCALES,
  projectDocSchema,
  projectToYDoc,
  yDocToProject,
} from '@rublox/schema'
import { describe, expect, it } from 'vitest'
import {
  CATEGORY_LABELS,
  COMPONENTS,
  createComponent,
  createDemoProject,
  createProject,
  createScreen,
  getComponentDef,
  paletteFor,
  prop,
  resolveProps,
  stripDefaults,
  typesMissingFromDemo,
} from '../src/index.ts'

describe('catalog completeness', () => {
  it.each(COMPONENTS.map((def) => [def.type, def] as const))('%s is fully described', (_, def) => {
    for (const locale of LOCALES) {
      const strings = def.strings[locale]
      expect(strings, locale).toBeDefined()
      for (const key of ['label', 'description', 'help', 'example'] as const) {
        expect(strings[key].trim(), `${locale}.${key}`).not.toBe('')
      }
      expect(isValidName(`${strings.prefix}1`), `${locale}.prefix`).toBe(true)
      expect(CATEGORY_LABELS[locale][def.category]).toBeTruthy()
      for (const [key, propDef] of Object.entries(def.props)) {
        expect(strings.props[key], `${locale}.props.${key}`).toBeTruthy()
        for (const value of propDef.values ?? []) {
          expect(strings.enums[key]?.[value], `${locale}.enums.${key}.${value}`).toBeTruthy()
        }
      }
      for (const [key, eventDef] of Object.entries(def.events)) {
        expect(strings.events[key], `${locale}.events.${key}`).toContain('%1')
        for (const arg of Object.keys(eventDef.args)) {
          expect(strings.args?.[arg], `${locale}.args.${arg}`).toBeTruthy()
        }
        const filter = eventDef.filter
        if (filter) {
          expect(strings.events[key], `${locale}.events.${key} filter`).toContain('%2')
          expect(strings.filters?.[key]?.any, `${locale}.filters.${key}.any`).toBeTruthy()
          const values = filter.kind === 'enum' ? filter.values : []
          for (const value of values) {
            expect(
              strings.filters?.[key]?.[value],
              `${locale}.filters.${key}.${value}`,
            ).toBeTruthy()
          }
          if (filter.kind === 'component') {
            expect(getComponentDef(filter.componentType)).toBeDefined()
          }
        }
      }
      for (const [key, method] of Object.entries(def.methods)) {
        const text = strings.methods[key] ?? ''
        expect(text, `${locale}.methods.${key}`).toContain('%1')
        Object.keys(method.args).forEach((_, index) => {
          expect(text, `${locale}.methods.${key} arg ${index}`).toContain(`%${index + 2}`)
        })
      }
      // No stray strings for things that do not exist.
      for (const key of Object.keys(strings.props)) expect(def.props[key], key).toBeDefined()
      for (const key of Object.keys(strings.events)) expect(def.events[key], key).toBeDefined()
    }
    // A component reaches its handlers, methods and properties by name: they cannot clash.
    const members = [
      ...Object.keys(def.events).map((key) => `on${key.charAt(0).toUpperCase()}${key.slice(1)}`),
      ...Object.keys(def.methods),
      ...Object.keys(def.props),
    ]
    expect(new Set(members).size, 'member names').toBe(members.length)
    for (const type of [...(def.accepts ?? []), ...(def.parents ?? [])]) {
      expect(getComponentDef(type), type).toBeDefined()
    }
    for (const parent of def.parents ?? []) {
      expect(getComponentDef(parent)?.accepts ?? [], parent).toContain(def.type)
    }
  })

  it('has unique types and valid defaults', () => {
    expect(new Set(COMPONENTS.map((def) => def.type)).size).toBe(COMPONENTS.length)
    for (const def of COMPONENTS) {
      for (const [key, propDef] of Object.entries(def.props)) {
        const values =
          typeof propDef.default === 'object' && propDef.default !== null && 'fr' in propDef.default
            ? Object.values(propDef.default)
            : [propDef.default]
        for (const value of values) {
          expect(propDef.coerce(value), `${def.type}.${key}`).toEqual(value)
        }
      }
    }
  })

  it('includes the game components', () => {
    for (const type of ['GameScene', 'Sprite', 'SceneText', 'Joystick']) {
      expect(getComponentDef(type)?.category, type).toBe('game')
    }
    expect(getComponentDef('GameScene')?.freeLayout).toBe(true)
    expect(getComponentDef('Sprite')?.clonable).toBe(true)
  })

  it('keeps state properties out of the project and the inspector', () => {
    for (const def of COMPONENTS) {
      for (const [key, propDef] of Object.entries(def.props)) {
        if (!propDef.state) continue
        expect(propDef.blocks, `${def.type}.${key}`).not.toMatch(/set/)
        expect(stripDefaults(def.type, { [key]: 'x' }), `${def.type}.${key}`).toEqual({})
      }
    }
  })

  it('includes the J0 components', () => {
    for (const type of ['Screen', 'Row', 'Column', 'Button', 'Text', 'TextInput', 'Image']) {
      expect(getComponentDef(type), type).toBeDefined()
    }
  })
})

describe('palette', () => {
  it('leaves the screen out and keeps Junior to junior components', () => {
    const studio = paletteFor('studio').flatMap((c) => c.components.map((d) => d.type))
    expect(studio).not.toContain('Screen')
    expect(studio).toContain('Button')
    const junior = paletteFor('junior').flatMap((c) => c.components)
    expect(junior.every((def) => def.junior)).toBe(true)
  })
})

describe('creation', () => {
  it('creates a valid project', () => {
    const doc = createProject({ name: 'Test', locale: 'fr', mode: 'junior' })
    expect(projectDocSchema.parse(doc)).toEqual(doc)
    const screen = doc.screens[doc.screenOrder[0]!]!
    expect(screen.name).toBe('Accueil')
    expect(createProject({ name: 'T', locale: 'en', mode: 'studio' }).screens).toBeTruthy()
  })

  it('names components with the localized prefix and writes localized defaults', () => {
    const button = createComponent('Button', 'fr', ['Bouton1'])
    expect(button).toEqual({
      type: 'Button',
      name: 'Bouton2',
      props: { text: 'Bouton' },
    })
    expect(createComponent('TextInput', 'en', []).name).toBe('Input1')
    expect(createComponent('Row', 'fr', []).children).toEqual([])
  })

  it('adds screens and components that keep the project valid', () => {
    const doc = createProject({ name: 'Test', locale: 'fr', mode: 'junior' })
    const ydoc = projectToYDoc(doc)
    const screen = createScreen('fr', ['Accueil'])
    expect(screen.name).toBe('Ecran2')
    const id = addScreen(ydoc, screen)
    const rootId = yDocToProject(ydoc).screens[id]!.rootId
    addComponent(ydoc, id, createComponent('Button', 'fr', []), rootId)
    expect(projectDocSchema.safeParse(yDocToProject(ydoc)).success).toBe(true)
  })

  it('resolves and strips defaults', () => {
    const full = resolveProps('Button', { text: 'OK' }, 'fr')
    expect(full).toMatchObject({
      text: 'OK',
      variant: 'filled',
      visible: true,
      radius: 12,
    })
    expect(stripDefaults('Button', full)).toEqual({ text: 'OK' })
  })
})

describe('coercion', () => {
  it('keeps lists of images', () => {
    const images = prop.images({ default: [], group: 'content' })
    expect(images.coerce('🍎')).toEqual(['🍎'])
    expect(images.coerce(['🍎', 3, ' ', 'a1'])).toEqual(['🍎', 'a1'])
    expect(images.coerce(42)).toBeUndefined()
  })

  it('validates values written by the generated code', () => {
    const text = prop.string({ default: '', group: 'content' })
    expect(text.coerce(3)).toBe('3')
    expect(text.coerce(0.1 + 0.2)).toBe('0.3')
    expect(text.coerce(null)).toBe('')
    const size = prop.size({ default: 'auto', group: 'layout' })
    expect(size.coerce('50%')).toBe('50%')
    expect(size.coerce('120')).toBe(120)
    expect(size.coerce('big')).toBeUndefined()
    const n = prop.number({ default: 0, min: 0, max: 100, group: 'style' })
    expect(n.coerce(150)).toBe(100)
    expect(n.coerce('abc')).toBeUndefined()
    const color = prop.color({ default: '', group: 'style' })
    expect(color.coerce('#FF0000')).toBe('#ff0000')
    expect(color.coerce('@primary')).toBe('@primary')
    expect(color.coerce('url(x)')).toBeUndefined()
    const variant = prop.enum(['a', 'b'], { default: 'a', group: 'style' })
    expect(variant.coerce('c')).toBeUndefined()
  })

  it('reads lists, dates and times', () => {
    const list = prop.list({ default: [], group: 'content' })
    expect(list.coerce('rouge, vert, bleu')).toEqual(['rouge', 'vert', 'bleu'])
    expect(list.coerce('a, b\nc')).toEqual(['a, b', 'c'])
    expect(list.coerce([1, true, 'x'])).toEqual(['1', 'true', 'x'])
    expect(list.coerce(null)).toEqual([])
    expect(list.coerce({})).toBeUndefined()
    const items = prop.list({
      default: [],
      group: 'content',
      itemFields: { title: 'string', image: 'asset' },
    })
    expect(items.coerce(['Chat', { title: 'Chien', image: 'x', other: 1 }])).toEqual([
      { title: 'Chat', image: '' },
      { title: 'Chien', image: 'x' },
    ])
    const date = prop.date({ default: '', group: 'content' })
    expect(date.coerce('2026-10-06')).toBe('2026-10-06')
    expect(date.coerce('2026-02-30')).toBeUndefined()
    expect(date.coerce(new Date(2026, 0, 5))).toBe('2026-01-05')
    const time = prop.time({ default: '', group: 'content' })
    expect(time.coerce('9:05')).toBe('09:05')
    expect(time.coerce('24:00')).toBeUndefined()
  })
})

describe('demo app', () => {
  it.each(['fr', 'en'] as const)('is a valid project that uses every component (%s)', (locale) => {
    const doc = createDemoProject({ locale, mode: 'studio' })
    expect(projectDocSchema.safeParse(doc).error).toBeUndefined()
    expect(
      typesMissingFromDemo(
        doc,
        COMPONENTS.map((def) => def.type),
      ),
    ).toEqual([])
  })
})
