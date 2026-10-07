import { createProject } from '@rublox/catalog'
import type { BlocklyJson, ProjectDoc } from '@rublox/schema'
import { describe, expect, it } from 'vitest'
import {
  badgesFromProgress,
  type Condition,
  EMPTY_PROGRESS,
  type ExploreProgress,
  evaluate,
  findBlock,
  type LearnState,
  levelChanges,
  MemoryProgressStore,
} from '../src/index.ts'

/** J9: conditions on blocks by id, slow motion steps, and what a level changes. */

const num = (id: string, value: number): BlocklyJson => ({
  type: 'math_number',
  id,
  fields: { NUM: value },
})

function project(speed: number, extra: BlocklyJson[] = []): ProjectDoc {
  const doc = createProject({ name: 'Jeu', locale: 'fr', mode: 'junior', id: 'p' })
  const screen = doc.screenOrder[0] as string
  const fall: BlocklyJson = {
    type: 'rx_Sprite_set',
    id: 'speed',
    fields: { COMPONENT: 'star', PROP: 'vy' },
    inputs: { VALUE: { block: num('speed/value', speed) } },
    ...(extra.length ? { next: { block: extra[0] } } : {}),
  }
  doc.blocks[screen] = {
    drop: {
      type: 'procedures_defnoreturn',
      id: 'drop',
      fields: { NAME: 'tomber' },
      inputs: { STACK: { block: fall } },
    },
  }
  return doc
}

const state = (doc: ProjectDoc, patch: Partial<LearnState> = {}): LearnState => ({
  doc,
  tab: 'blocks',
  workspace: doc.screenOrder[0] ?? '',
  selectedType: null,
  events: [],
  previewScreen: null,
  slowMotion: false,
  ...patch,
})

describe('blocks by id', () => {
  it('finds a block and its enclosing ids', () => {
    const found = findBlock(project(150), 'speed/value')
    expect(found?.block.fields).toEqual({ NUM: 150 })
    expect(found?.ancestorIds).toEqual(['speed', 'drop'])
  })

  it('checks a field: equals, not, min and max', () => {
    const check = (condition: Omit<Extract<Condition, { kind: 'blockField' }>, 'kind'>) =>
      evaluate({ kind: 'blockField', ...condition }, state(project(150)))
    expect(check({ id: 'speed/value', field: 'NUM', equals: 150 })).toBe(true)
    expect(check({ id: 'speed/value', field: 'NUM', not: 150 })).toBe(false)
    expect(check({ id: 'speed/value', field: 'NUM', min: 250 })).toBe(false)
    expect(check({ id: 'speed/value', field: 'NUM', max: 200 })).toBe(true)
    expect(check({ id: 'gone', field: 'NUM', min: 0 })).toBe(false)
    expect(
      evaluate(
        { kind: 'blockField', id: 'speed/value', field: 'NUM', min: 250 },
        state(project(300)),
      ),
    ).toBe(true)
  })

  it('finds a block within a stack', () => {
    const turn: BlocklyJson = { type: 'rx_Sprite_call_turn', id: 'mine', fields: {} }
    const condition: Condition = { kind: 'block', type: 'rx_Sprite_call_turn', within: 'drop' }
    expect(evaluate(condition, state(project(150)))).toBe(false)
    expect(evaluate(condition, state(project(150, [turn])))).toBe(true)
    expect(evaluate({ ...condition, within: 'elsewhere' }, state(project(150, [turn])))).toBe(false)
  })

  it('knows the blocks slow motion lit', () => {
    const doc = project(150)
    expect(evaluate({ kind: 'stepped', id: 'speed' }, state(doc))).toBe(false)
    expect(evaluate({ kind: 'stepped', id: 'speed' }, state(doc, { stepped: ['speed'] }))).toBe(
      true,
    )
    expect(evaluate({ kind: 'stepped' }, state(doc, { stepped: ['drop'] }))).toBe(true)
  })
})

describe('level changes', () => {
  it('tells added blocks from changed ones, by id', () => {
    const turn: BlocklyJson = { type: 'rx_Sprite_call_turn', id: 'mine', fields: {} }
    const changes = levelChanges(project(150), project(200, [turn]))
    expect(changes.blocks.map(({ id, status, stack }) => [id, status, stack])).toEqual([
      ['speed/value', 'changed', 'drop'],
      ['mine', 'added', 'drop'],
    ])
    expect(levelChanges(project(150), project(150)).blocks).toEqual([])
  })
})

describe('progress of the apps to take apart', () => {
  const level = (n: number, done: boolean): ExploreProgress => ({
    id: `star-catcher/${n}`,
    app: 'star-catcher',
    level: n,
    projectId: `p${n}`,
    step: 0,
    tourDone: done,
    challenges: [],
    done,
    updatedAt: '2026-10-07T00:00:00.000Z',
  })

  it('gives the app badge once its four levels are done', async () => {
    const store = new MemoryProgressStore()
    for (const n of [1, 2, 3]) await store.saveExplore(level(n, true))
    expect(badgesFromProgress(await store.load())).not.toContain('explore-star-catcher')
    await store.saveExplore(level(4, true))
    expect(badgesFromProgress(await store.load())).toContain('explore-star-catcher')
    // Explored levels are not tutorials.
    expect(badgesFromProgress(await store.load())).not.toContain('first-tutorial')
  })

  it('reads a progression saved before J9', () => {
    const { explore: _explore, ...old } = structuredClone(EMPTY_PROGRESS)
    expect(badgesFromProgress(old as typeof EMPTY_PROGRESS)).toEqual([])
  })
})
