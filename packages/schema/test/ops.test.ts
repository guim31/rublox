import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import {
  addComponent,
  addScreen,
  addVariable,
  copyComponents,
  duplicateComponent,
  duplicateScreen,
  moveComponent,
  moveScreen,
  ProjectOpError,
  pasteComponents,
  projectDocSchema,
  projectToYDoc,
  removeComponent,
  removeScreen,
  renameComponent,
  setBlockStack,
  setNavigation,
  setProp,
  setTheme,
  updateVariable,
  yDocToProject,
} from '../src/index.ts'
import { fixture } from './fixture.ts'

const valid = (ydoc: Y.Doc) => projectDocSchema.parse(yDocToProject(ydoc))

describe('component operations', () => {
  it('adds with a unique name, at the requested place', () => {
    const ydoc = projectToYDoc(fixture())
    const id = addComponent(ydoc, 's1', { type: 'Button', name: 'Bouton1', props: {} }, 'r1', 0)
    const doc = valid(ydoc)
    expect(doc.screens.s1!.components[id]!.name).toBe('Bouton2')
    expect(doc.screens.s1!.components.r1!.children).toEqual([id, 'row', 'txt'])
  })

  it('moves within and across containers', () => {
    const ydoc = projectToYDoc(fixture())
    moveComponent(ydoc, 's1', 'txt', 'r1', 0)
    expect(valid(ydoc).screens.s1!.components.r1!.children).toEqual(['txt', 'row'])
    moveComponent(ydoc, 's1', 'txt', 'r1', 2)
    expect(valid(ydoc).screens.s1!.components.r1!.children).toEqual(['row', 'txt'])
    moveComponent(ydoc, 's1', 'txt', 'row', 0)
    const doc = valid(ydoc)
    expect(doc.screens.s1!.components.row!.children).toEqual(['txt', 'btn'])
    expect(doc.screens.s1!.components.r1!.children).toEqual(['row'])
  })

  it('refuses to move a container into itself or to move the root', () => {
    const ydoc = projectToYDoc(fixture())
    addComponent(ydoc, 's1', { id: 'inner', type: 'Column', name: 'Col', props: {} }, 'row')
    expect(() => moveComponent(ydoc, 's1', 'row', 'inner', 0)).toThrow(ProjectOpError)
    expect(() => moveComponent(ydoc, 's1', 'r1', 'row', 0)).toThrow(ProjectOpError)
  })

  it('removes a component with its descendants', () => {
    const ydoc = projectToYDoc(fixture())
    removeComponent(ydoc, 's1', 'row')
    const doc = valid(ydoc)
    expect(Object.keys(doc.screens.s1!.components).sort()).toEqual(['r1', 'txt'])
  })

  it('duplicates a subtree with fresh ids and names', () => {
    const ydoc = projectToYDoc(fixture())
    const copy = duplicateComponent(ydoc, 's1', 'row')
    const doc = valid(ydoc)
    expect(doc.screens.s1!.components.r1!.children).toEqual(['row', copy, 'txt'])
    const copied = doc.screens.s1!.components[copy]!
    expect(copied.name).toBe('Ligne2')
    expect(doc.screens.s1!.components[copied.children![0]!]!.name).toBe('Bouton2')
  })

  it('sets and resets properties, renames', () => {
    const ydoc = projectToYDoc(fixture())
    setProp(ydoc, 's1', 'btn', 'variant', 'outline')
    setProp(ydoc, 's1', 'btn', 'text', undefined)
    renameComponent(ydoc, 's1', 'btn', 'Valider')
    expect(() => renameComponent(ydoc, 's1', 'txt', 'Valider')).toThrow(ProjectOpError)
    const btn = valid(ydoc).screens.s1!.components.btn!
    expect(btn).toMatchObject({
      name: 'Valider',
      props: { variant: 'outline' },
    })
  })
})

describe('screen operations', () => {
  it('adds, reorders and removes screens, keeping a valid start screen', () => {
    const ydoc = projectToYDoc(fixture())
    const id = addScreen(ydoc, {
      name: 'Accueil',
      root: { type: 'Screen', name: 'Accueil', props: {} },
    })
    expect(valid(ydoc).screens[id]!.name).toBe('Accueil1')
    moveScreen(ydoc, id, 0)
    expect(valid(ydoc).screenOrder[0]).toBe(id)
    removeScreen(ydoc, 's1')
    const doc = valid(ydoc)
    expect(doc.settings.navigation.startScreen).toBe(id)
    expect(doc.blocks.s1).toBeUndefined()
  })

  it('keeps at least one screen', () => {
    const ydoc = projectToYDoc(fixture())
    removeScreen(ydoc, 's2')
    expect(() => removeScreen(ydoc, 's1')).toThrow(ProjectOpError)
  })

  it('duplicates a screen with its blocks pointing at the copied components', () => {
    const ydoc = projectToYDoc(fixture())
    const id = duplicateScreen(ydoc, 's1')
    const doc = valid(ydoc)
    expect(doc.screenOrder).toEqual(['s1', id, 's2'])
    const copy = doc.screens[id]!
    const button = Object.entries(copy.components).find(([, c]) => c.type === 'Button')![0]
    expect(button).not.toBe('btn')
    expect(doc.blocks[id]!.b1!.fields).toEqual({ COMPONENT: button })
  })
})

describe('blocks and variables', () => {
  it('stores one entry per stack', () => {
    const ydoc = projectToYDoc(fixture())
    setBlockStack(ydoc, 'app', 'top', { type: 'rx_app_start', id: 'top' })
    setBlockStack(ydoc, 's1', 'b1', null)
    const doc = valid(ydoc)
    expect(doc.blocks.app).toEqual({
      top: { type: 'rx_app_start', id: 'top' },
    })
    expect(doc.blocks.s1).toEqual({})
  })

  it('keeps variable names unique across kinds', () => {
    const ydoc = projectToYDoc(fixture())
    expect(() => addVariable(ydoc, 'stored', { name: 'score' })).toThrow(ProjectOpError)
    const v = addVariable(ydoc, 'app', { name: 'vies', initial: 3 })
    updateVariable(ydoc, 'app', v.id, { name: 'coeurs' })
    expect(valid(ydoc).variables.app.map((x) => x.name)).toEqual(['score', 'coeurs'])
  })
})

describe('undo', () => {
  it('undoes and redoes one operation as a single step', () => {
    const ydoc = projectToYDoc(fixture())
    const undo = new Y.UndoManager(
      [ydoc.getMap('screens'), ydoc.getArray('screenOrder'), ydoc.getMap('blocks')],
      { captureTimeout: 0 },
    )
    const before = yDocToProject(ydoc)
    duplicateComponent(ydoc, 's1', 'row')
    const after = yDocToProject(ydoc)
    undo.undo()
    expect(yDocToProject(ydoc)).toEqual(before)
    undo.redo()
    expect(yDocToProject(ydoc)).toEqual(after)
  })
})

describe('app settings', () => {
  it('changes the theme and the navigation, and forgets removed screens', () => {
    const ydoc = projectToYDoc(fixture())
    setTheme(ydoc, { primary: '#ff0000', scheme: 'auto', radius: 4 })
    const second = addScreen(ydoc, {
      name: 'Deux',
      root: { type: 'Screen', name: 'Deux', props: {}, children: [] },
    })
    setNavigation(ydoc, {
      kind: 'tabs',
      items: [
        { screen: 's1', icon: 'house', label: 'Accueil' },
        { screen: second, icon: 'star' },
        { screen: 'nope' },
      ],
    })
    let doc = valid(ydoc)
    expect(doc.settings.theme).toMatchObject({ primary: '#ff0000', scheme: 'auto', radius: 4 })
    expect(doc.settings.navigation.kind).toBe('tabs')
    expect(doc.settings.navigation.items?.map((item) => item.screen)).toEqual(['s1', second])
    removeScreen(ydoc, second)
    doc = valid(ydoc)
    expect(doc.settings.navigation.items?.map((item) => item.screen)).toEqual(['s1'])
    setNavigation(ydoc, { items: null })
    expect(valid(ydoc).settings.navigation.items).toBeUndefined()
  })
})

describe('copy and paste', () => {
  it('copies subtrees and pastes them with new ids and free names', () => {
    const ydoc = projectToYDoc(fixture())
    const row = addComponent(
      ydoc,
      's1',
      { type: 'Row', name: 'Ligne1', props: {}, children: [] },
      'r1',
    )
    addComponent(ydoc, 's1', { type: 'Button', name: 'Bouton9', props: { text: 'A' } }, row)
    const timer = addComponent(ydoc, 's1', { type: 'Timer', name: 'Minuteur1', props: {} }, null)
    const clips = copyComponents(ydoc, 's1', [row, timer, 'r1'])
    expect(clips).toHaveLength(2)
    expect(Object.keys(clips[0]!.nodes)).toHaveLength(2)
    const pasted = pasteComponents(ydoc, 's1', clips, 'r1', 0, (type) => type !== 'Timer')
    const doc = valid(ydoc)
    const screen = doc.screens.s1!
    expect(pasted).toHaveLength(2)
    expect(screen.components[screen.rootId]!.children![0]).toBe(pasted[0])
    expect(screen.nonVisual).toContain(pasted[1])
    expect(screen.components[pasted[0]!]!.name).toMatch(/^Ligne[2-9]$/)
    // Into another screen, names stay when they are free.
    const elsewhere = pasteComponents(
      ydoc,
      's2',
      clips,
      valid(ydoc).screens.s2!.rootId,
      0,
      () => true,
    )
    expect(valid(ydoc).screens.s2!.components[elsewhere[0]!]!.name).toBe(
      clips[0]!.nodes[clips[0]!.rootId]!.name,
    )
  })
})
