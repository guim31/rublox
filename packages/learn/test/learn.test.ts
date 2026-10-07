import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { buildToolbox, setupBlocks } from '@rublox/blocks'
import { getComponentDef } from '@rublox/catalog'
import { messages } from '@rublox/i18n'
import type { BlocklyJson, ProjectDoc } from '@rublox/schema'
import * as Blockly from 'blockly/core'
import { describe, expect, it } from 'vitest'
import {
  ALL_CHALLENGES,
  ALL_TUTORIALS,
  BADGES,
  badgesFromProgress,
  badgesFromProject,
  buildStarter,
  type Condition,
  countBlocks,
  EMPTY_PROGRESS,
  evaluate,
  fillNames,
  getTutorial,
  type LearnState,
  MemoryProgressStore,
  nextStep,
  richText,
  stepProgress,
} from '../src/index.ts'

const CONTENT = join(import.meta.dirname, '../../../content')

function state(doc: ProjectDoc, patch: Partial<LearnState> = {}): LearnState {
  return {
    doc,
    tab: 'design',
    workspace: doc.screenOrder[0] ?? '',
    selectedType: null,
    events: [],
    previewScreen: null,
    slowMotion: false,
    ...patch,
  }
}

function conditions(condition: Condition): Condition[] {
  if (condition.kind === 'all' || condition.kind === 'any')
    return [condition, ...condition.of.flatMap(conditions)]
  if (condition.kind === 'not') return [condition, ...conditions(condition.of)]
  return [condition]
}

const TARGET =
  /^(palette|layer|toolbox):[A-Z]\w*(\.\d+)?$|^inspector:\w+$|^toolbox-category:\w+$|^(tab:design|tab:blocks|tab:data|screen-picker|canvas|preview|slow-motion|help|workspace)$|^data:[a-z-]+$/

describe('content', () => {
  setupBlocks('fr')

  it('registers every folder of content/', () => {
    expect(readdirSync(join(CONTENT, 'tutorials')).sort()).toEqual(
      ALL_TUTORIALS.map((t) => t.id).sort(),
    )
    expect(readdirSync(join(CONTENT, 'challenges')).sort()).toEqual(
      ALL_CHALLENGES.map((c) => c.id).sort(),
    )
  })

  for (const tutorial of ALL_TUTORIALS) {
    it(`tutorial ${tutorial.id}: texts in both languages, valid steps`, () => {
      const ids = tutorial.steps.map((step) => step.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const locale of ['fr', 'en'] as const) {
        const texts = tutorial.texts[locale]
        expect(texts.title.length).toBeGreaterThan(2)
        expect(texts.summary.length).toBeGreaterThan(10)
        expect(texts.done.length).toBeGreaterThan(10)
        expect(Object.keys(texts.steps).sort()).toEqual([...ids].sort())
        for (const step of Object.values(texts.steps)) expect(step.text.length).toBeGreaterThan(10)
      }
      for (const type of tutorial.requires) expect(getComponentDef(type)).toBeDefined()
      for (const step of tutorial.steps) {
        if (step.target) expect(step.target).toMatch(TARGET)
        for (const condition of step.check ? conditions(step.check) : []) {
          if (condition.kind === 'block') {
            for (const type of [condition.type, ...(condition.inside ?? [])].flat())
              expect(Blockly.Blocks[type], type).toBeDefined()
          }
          if (condition.kind === 'component' || condition.kind === 'prop')
            expect(getComponentDef(condition.type)).toBeDefined()
          if (condition.kind === 'prop')
            expect(getComponentDef(condition.type)?.props[condition.prop]).toBeDefined()
        }
      }
    })
  }

  for (const challenge of ALL_CHALLENGES) {
    it(`challenge ${challenge.id}: texts in both languages, valid stars`, () => {
      for (const locale of ['fr', 'en'] as const) {
        const texts = challenge.texts[locale]
        expect(texts.title.length).toBeGreaterThan(2)
        expect(texts.goal.length).toBeGreaterThan(10)
        expect(texts.stars).toHaveLength(3)
      }
      expect(challenge.stars).toHaveLength(3)
      for (const condition of challenge.stars.flatMap(conditions)) {
        if (condition.kind === 'block') {
          for (const type of [condition.type, ...(condition.inside ?? [])].flat())
            expect(Blockly.Blocks[type], type).toBeDefined()
        }
      }
      for (const entry of challenge.starter?.components ?? []) {
        const def = getComponentDef(entry.type)
        expect(def).toBeDefined()
        for (const key of Object.keys(entry.props ?? {})) expect(def?.props[key]).toBeDefined()
      }
      // The starting project earns no star by itself.
      const doc = buildStarter({
        name: 'x',
        locale: 'fr',
        mode: challenge.mode,
        spec: challenge.starter,
      })
      expect(challenge.stars.filter((star) => evaluate(star, state(doc)))).toEqual([])
    })
  }

  it('has a help sheet for every general block of the toolbox, in both languages', () => {
    const types = new Set<string>()
    const visit = (items: unknown[]) => {
      for (const item of items as { kind: string; type?: string; contents?: unknown[] }[]) {
        if (item.kind === 'block' && item.type) types.add(item.type)
        if (item.contents) visit(item.contents)
      }
    }
    for (const workspace of ['app', 'screen'])
      visit(
        (
          buildToolbox({
            workspace,
            locale: 'fr',
            mode: 'studio',
            showAll: true,
            components: [],
            screens: [],
          }) as { contents: unknown[] }
        ).contents,
      )
    const general = [...types].filter((type) => !/^rx_[A-Z]/.test(type))
    expect(general.length).toBeGreaterThan(40)
    for (const locale of ['fr', 'en'] as const) {
      const sheets = messages[locale].studio.blockSheets as Record<string, unknown>
      expect(general.filter((type) => !sheets[type])).toEqual([])
    }
  })

  it('has texts for every badge, in both languages', () => {
    for (const badge of BADGES) {
      for (const locale of ['fr', 'en'] as const) {
        const texts = messages[locale].studio.learn.badges[badge.id]
        expect(texts.title.length).toBeGreaterThan(2)
        expect(texts.text.length).toBeGreaterThan(5)
      }
    }
  })
})

/** Appends a stack to a screen's workspace. */
function addStack(doc: ProjectDoc, workspace: string, json: BlocklyJson) {
  doc.blocks[workspace] = {
    ...doc.blocks[workspace],
    [`s${Object.keys(doc.blocks[workspace] ?? {}).length}`]: json,
  }
}

function componentId(doc: ProjectDoc, type: string, n = 1): string {
  const screen = Object.values(doc.screens).find((s) =>
    Object.values(s.components).some((c) => c.type === type),
  )
  const ids = Object.values(doc.screens).flatMap((s) =>
    Object.entries(s.components)
      .filter(([, c]) => c.type === type)
      .map(([id]) => id),
  )
  expect(screen).toBeDefined()
  return ids[n - 1] ?? ''
}

describe('first-button, step by step', () => {
  it('validates each step only once its action is done', () => {
    const tutorial = getTutorial('first-button')
    if (!tutorial) throw new Error('missing')
    const doc = buildStarter({ name: 'Mon premier bouton', locale: 'fr', mode: 'junior' })
    const home = doc.screenOrder[0] as string
    const steps = Object.fromEntries(tutorial.steps.map((s) => [s.id, s.check]))
    const check = (id: string, s: LearnState) => evaluate(steps[id] as Condition, s)

    expect(check('add-button', state(doc))).toBe(false)
    const withButton = buildStarter({
      name: 'x',
      locale: 'fr',
      mode: 'junior',
      spec: { components: [{ type: 'Button' }] },
    })
    expect(check('add-button', state(withButton))).toBe(true)
    // The default text "Bouton" does not count as written.
    expect(check('button-text', state(withButton))).toBe(false)

    const filled = buildStarter({
      name: 'x',
      locale: 'fr',
      mode: 'junior',
      spec: {
        components: [{ type: 'Button', props: { text: 'Dis bonjour' } }, { type: 'Text' }],
      },
    })
    expect(check('button-text', state(filled))).toBe(true)
    expect(check('add-text', state(filled))).toBe(true)
    expect(check('go-blocks', state(filled))).toBe(false)
    expect(check('go-blocks', state(filled, { tab: 'blocks' }))).toBe(true)

    const start = filled.screenOrder[0] as string
    const button = componentId(filled, 'Button')
    const text = componentId(filled, 'Text')
    expect(check('event-block', state(filled))).toBe(false)
    addStack(filled, start, {
      type: 'rx_Button_on_click',
      fields: { COMPONENT: button },
      inputs: {
        DO: {
          block: {
            type: 'rx_Text_set',
            fields: { COMPONENT: text, PROP: 'text' },
            inputs: { VALUE: { shadow: { type: 'text', fields: { TEXT: '' } } } },
          },
        },
      },
    })
    expect(check('event-block', state(filled))).toBe(true)
    expect(check('set-block', state(filled))).toBe(true)
    // The text box is still empty.
    expect(check('type-hello', state(filled))).toBe(false)
    const event = filled.blocks[start]?.s0 as unknown as { inputs: { DO: { block: BlocklyJson } } }
    const setter = event.inputs.DO.block as unknown as {
      inputs: { VALUE: { shadow: BlocklyJson } }
    }
    setter.inputs.VALUE.shadow.fields = { TEXT: 'Bonjour !' }
    expect(check('type-hello', state(filled))).toBe(true)

    const click = {
      componentType: 'Button',
      componentName: 'Bouton1',
      event: 'click',
      screenId: start,
    }
    expect(check('try-it', state(filled))).toBe(false)
    expect(check('try-it', state(filled, { events: [click] }))).toBe(true)
    expect(home).toBeTruthy()
  })

  it('ignores a disabled stack and a setter outside the event', () => {
    const doc = buildStarter({
      name: 'x',
      locale: 'fr',
      mode: 'junior',
      spec: { components: [{ type: 'Button' }, { type: 'Text' }] },
    })
    const start = doc.screenOrder[0] as string
    const condition: Condition = {
      kind: 'block',
      type: 'rx_Text_set',
      inside: ['rx_Button_on_click'],
    }
    addStack(doc, start, { type: 'rx_Text_set', fields: { PROP: 'text' } })
    expect(evaluate(condition, state(doc))).toBe(false)
    addStack(doc, start, {
      type: 'rx_Button_on_click',
      enabled: false,
      inputs: { DO: { block: { type: 'rx_Text_set' } } },
    })
    expect(evaluate(condition, state(doc))).toBe(false)
  })
})

describe('conditions', () => {
  const doc = buildStarter({ name: 'x', locale: 'fr', mode: 'studio', spec: { screens: 1 } })
  const [start, other] = doc.screenOrder as [string, string]

  it('knows the screens and the workspace', () => {
    expect(evaluate({ kind: 'screens', min: 2 }, state(doc))).toBe(true)
    expect(evaluate({ kind: 'workspace', screen: 'start' }, state(doc))).toBe(true)
    expect(evaluate({ kind: 'workspace', screen: 'other' }, state(doc, { workspace: other }))).toBe(
      true,
    )
    expect(evaluate({ kind: 'workspace', screen: 'app' }, state(doc, { workspace: 'app' }))).toBe(
      true,
    )
    expect(evaluate({ kind: 'previewScreen', screen: 'other' }, state(doc))).toBe(false)
    expect(
      evaluate({ kind: 'previewScreen', screen: 'other' }, state(doc, { previewScreen: other })),
    ).toBe(true)
    expect(
      evaluate({ kind: 'previewScreen', screen: 'start' }, state(doc, { previewScreen: start })),
    ).toBe(true)
  })

  it('combines', () => {
    const yes: Condition = { kind: 'screens', min: 1 }
    const no: Condition = { kind: 'screens', min: 5 }
    expect(evaluate({ kind: 'all', of: [yes, no] }, state(doc))).toBe(false)
    expect(evaluate({ kind: 'any', of: [yes, no] }, state(doc))).toBe(true)
    expect(evaluate({ kind: 'not', of: no }, state(doc))).toBe(true)
    expect(evaluate({ kind: 'manual' }, state(doc))).toBe(false)
  })

  it('counts blocks, shadows excluded', () => {
    const copy = structuredClone(doc)
    addStack(copy, start, {
      type: 'rx_wait',
      inputs: { SECONDS: { shadow: { type: 'math_number', fields: { NUM: 1 } } } },
      next: { block: { type: 'rx_log' } },
    })
    expect(countBlocks(copy)).toBe(2)
    expect(evaluate({ kind: 'blockCount', max: 2 }, state(copy))).toBe(true)
    expect(evaluate({ kind: 'blockCount', max: 1 }, state(copy))).toBe(false)
  })
})

describe('texts', () => {
  it('fills component and screen names, in the project language', () => {
    const fr = buildStarter({
      name: 'x',
      locale: 'fr',
      mode: 'junior',
      spec: { components: [{ type: 'Button' }], screens: 1 },
    })
    expect(fillNames('{{Button}} puis {{Button.2}} sur {{screen.2}}', fr)).toBe(
      'Bouton1 puis Bouton2 sur Ecran2',
    )
    const en = buildStarter({ name: 'x', locale: 'en', mode: 'junior' })
    expect(fillNames('[when {{Button}} is clicked] on {{screen.1}}', en)).toBe(
      '[when Button1 is clicked] on Home',
    )
  })

  it('splits rich text', () => {
    expect(richText('Glisse un **Bouton** et [quand Bouton1 est cliqué].')).toEqual([
      { kind: 'text', text: 'Glisse un ' },
      { kind: 'strong', text: 'Bouton' },
      { kind: 'text', text: ' et ' },
      { kind: 'block', text: 'quand Bouton1 est cliqué' },
      { kind: 'text', text: '.' },
    ])
  })
})

describe('badges', () => {
  it('come from the blocks that run', () => {
    const doc = buildStarter({ name: 'x', locale: 'fr', mode: 'junior', spec: { screens: 1 } })
    const start = doc.screenOrder[0] as string
    expect(badgesFromProject(doc)).toEqual([])
    // A loose loop does not count: it never runs.
    addStack(doc, start, { type: 'controls_repeat_ext' })
    expect(badgesFromProject(doc)).toEqual([])
    addStack(doc, start, {
      type: 'rx_Button_on_click',
      inputs: {
        DO: {
          block: {
            type: 'controls_repeat_ext',
            inputs: { DO: { block: { type: 'math_change' } } },
            next: { block: { type: 'rx_screen_open' } },
          },
        },
      },
    })
    expect(badgesFromProject(doc).sort()).toEqual(['first-app', 'loop', 'two-screens', 'variable'])
  })

  it('come from the progression', () => {
    const progress = structuredClone(EMPTY_PROGRESS)
    expect(badgesFromProgress(progress)).toEqual([])
    progress.tutorials.a = { id: 'a', projectId: 'p', step: 3, status: 'done', updatedAt: '' }
    progress.challenges.c = { id: 'c', projectId: 'p', stars: 3, updatedAt: '' }
    expect(badgesFromProgress(progress)).toEqual(['first-tutorial', 'three-stars'])
  })

  it('are awarded once', async () => {
    const store = new MemoryProgressStore()
    expect(await store.award('loop')).toBe(true)
    expect(await store.award('loop')).toBe(false)
    expect(Object.keys((await store.load()).badges)).toEqual(['loop'])
  })
})

describe('step progression', () => {
  // The family chat: a shared table with two columns, then Design, bind the list, then Blocks.
  const tutorial = getTutorial('family-chat')
  if (!tutorial) throw new Error('missing')
  const index = (id: string) => tutorial.steps.findIndex((step) => step.id === id)
  const doc = buildStarter({ name: 'Tchat', locale: 'fr', mode: 'studio', spec: tutorial.starter })
  // The same project once the data list shows a table.
  const bound: ProjectDoc = structuredClone(doc)
  for (const screen of Object.values(bound.screens)) {
    for (const node of Object.values(screen.components)) {
      if (node.type === 'DataList') node.props.source = { table: 't1', fields: {} }
    }
  }

  it('validates a step when its check holds, and waits otherwise', () => {
    const goData = { step: index('go-data'), done: false }
    expect(stepProgress(tutorial, goData, state(doc, { tab: 'design' }))).toEqual(goData)
    expect(stepProgress(tutorial, goData, state(doc, { tab: 'data' }))).toEqual({
      ...goData,
      done: true,
    })
    expect(nextStep({ ...goData, done: true })).toEqual({ step: goData.step + 1, done: false })
  })

  it('a learner quicker than "Nice one!" is not asked again for what is done', () => {
    // "columns" is done. Before its moment is over, the learner goes to Design, binds the
    // list and goes to Blocks: the tutorial follows instead of asking for Design again.
    let progress = { step: index('columns'), done: true }
    progress = stepProgress(tutorial, progress, state(doc, { tab: 'design' }))
    expect(progress).toEqual({ step: index('go-design'), done: true })
    progress = stepProgress(tutorial, progress, state(bound, { tab: 'design' }))
    expect(progress).toEqual({ step: index('bind'), done: true })
    progress = stepProgress(tutorial, progress, state(bound, { tab: 'blocks' }))
    expect(progress).toEqual({ step: index('go-blocks'), done: true })
    expect(nextStep(progress)).toEqual({ step: index('send'), done: false })
  })

  it('waits for the moment to end when the following step does not hold yet', () => {
    const progress = { step: index('go-design'), done: true }
    expect(stepProgress(tutorial, progress, state(doc, { tab: 'blocks' }))).toEqual(progress)
  })

  it('never skips a manual step, nor goes past the last one', () => {
    const last = { step: tutorial.steps.length - 1, done: true }
    expect(stepProgress(tutorial, last, state(bound, { tab: 'blocks' }))).toEqual(last)
    const welcome = { step: index('welcome'), done: false }
    expect(stepProgress(tutorial, welcome, state(doc, { tab: 'data' }))).toEqual(welcome)
  })
})
