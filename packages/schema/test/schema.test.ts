import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import {
  isValidName,
  migrateProject,
  type ProjectDoc,
  ProjectFormatError,
  projectDocSchema,
  projectToYDoc,
  toValidName,
  uniqueName,
  yDocToProject,
} from '../src/index.ts'
import { fixture } from './fixture.ts'

describe('projectDocSchema', () => {
  it('accepts a valid project', () => {
    expect(projectDocSchema.parse(fixture())).toEqual(fixture())
  })

  it('rejects an unknown start screen', () => {
    const doc = fixture()
    doc.settings.navigation.startScreen = 'nope'
    expect(projectDocSchema.safeParse(doc).success).toBe(false)
  })

  it('rejects orphan and duplicated components', () => {
    const orphan = fixture()
    orphan.screens.s1!.components.lost = { type: 'Text', name: 'Perdu', props: {} }
    expect(projectDocSchema.safeParse(orphan).success).toBe(false)

    const twice = fixture()
    twice.screens.s1!.components.r1!.children = ['row', 'txt', 'txt']
    expect(projectDocSchema.safeParse(twice).success).toBe(false)
  })

  it('rejects duplicate component and screen names', () => {
    const components = fixture()
    components.screens.s1!.components.txt!.name = 'Bouton1'
    expect(projectDocSchema.safeParse(components).success).toBe(false)

    const screens = fixture()
    screens.screens.s2!.name = 'Accueil'
    expect(projectDocSchema.safeParse(screens).success).toBe(false)
  })
})

describe('Yjs conversion', () => {
  it('round-trips a project', () => {
    const ydoc = projectToYDoc(fixture())
    expect(yDocToProject(ydoc)).toEqual(fixture())
  })

  it('round-trips through a Yjs update (what storage and the network carry)', () => {
    const update = Y.encodeStateAsUpdate(projectToYDoc(fixture()))
    const copy = new Y.Doc()
    Y.applyUpdate(copy, update)
    expect(projectDocSchema.parse(yDocToProject(copy))).toEqual(fixture())
  })

  it('merges concurrent edits of different properties', () => {
    const a = projectToYDoc(fixture())
    const b = new Y.Doc()
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a))
    const props = (doc: Y.Doc) =>
      (doc.getMap('screens').get('s1') as Y.Map<Y.Map<Y.Map<Y.Map<unknown>>>>)
        .get('components')!
        .get('btn')!
        .get('props')!
    props(a).set('text', 'A')
    props(b).set('variant', 'outline')
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b))
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a))
    expect(yDocToProject(a)).toEqual(yDocToProject(b))
    expect(yDocToProject(a).screens.s1!.components.btn!.props).toEqual({
      text: 'A',
      variant: 'outline',
    })
  })
})

describe('migrateProject', () => {
  it('validates a current project', () => {
    expect(migrateProject(fixture())).toEqual(fixture())
  })

  it('refuses what is not a project, or too new', () => {
    const code = (input: unknown) => {
      try {
        migrateProject(input)
      } catch (error) {
        return (error as ProjectFormatError).code
      }
    }
    expect(code(null)).toBe('not-a-project')
    expect(code({ format: 'other' })).toBe('not-a-project')
    expect(code({ ...fixture(), formatVersion: 99 })).toBe('too-new')
    expect(code({ ...fixture(), screenOrder: [] })).toBe('invalid')
  })

  it('runs the steps in order up to the target', () => {
    const steps = [
      { from: 1, description: 'add a', up: (d: Record<string, unknown>) => ({ ...d, a: 1 }) },
      {
        from: 2,
        description: 'a to b',
        up: ({ a, ...d }: Record<string, unknown>) => ({ ...d, b: a }),
      },
    ]
    const result = migrateProject(fixture(), steps, 3) as ProjectDoc & { b?: number }
    expect(result.formatVersion).toBe(3)
    expect(result.b).toBe(1)
    expect(() => migrateProject(fixture(), steps.slice(1), 3)).toThrow(ProjectFormatError)
  })

  it('does not mutate its input', () => {
    const input = fixture()
    migrateProject(input, [{ from: 1, description: 'x', up: (d) => ({ ...d, x: 1 }) }], 2)
    expect(input).toEqual(fixture())
  })
})

describe('names', () => {
  it('accepts JavaScript identifiers only', () => {
    expect(isValidName('Bouton1')).toBe(true)
    expect(isValidName('Écran2')).toBe(true)
    expect(isValidName('1abc')).toBe(false)
    expect(isValidName('mon bouton')).toBe(false)
    expect(isValidName('class')).toBe(false)
    expect(isValidName('components')).toBe(false)
  })

  it('turns text into a valid name', () => {
    expect(toValidName('mon bouton !')).toBe('mon_bouton')
    expect(toValidName('3 vies')).toBe('_3_vies')
    expect(toValidName('   ')).toBe('item')
    expect(toValidName('class')).toBe('class_')
  })

  it('finds the next free name', () => {
    expect(uniqueName('Bouton', [])).toBe('Bouton1')
    expect(uniqueName('Bouton', ['Bouton1', 'Bouton2'])).toBe('Bouton3')
    expect(uniqueName('Bouton3', ['Bouton1', 'Bouton3'])).toBe('Bouton2')
    expect(uniqueName('Accueil', [], true)).toBe('Accueil')
  })
})
