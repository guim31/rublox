import * as Y from 'yjs'
import { newId, uniqueName } from './names.ts'
import type {
  Asset,
  BlocklyJson,
  ComponentId,
  ComponentNode,
  ProjectMeta,
  Screen,
  ScreenId,
  VarDecl,
  VarKind,
  WorkspaceKey,
} from './project.ts'
import {
  componentToY,
  mapFrom,
  screenToY,
  type YArray,
  type YMap,
  yAssets,
  yBlocks,
  yMeta,
  yScreenOrder,
  yScreens,
  ySettings,
  yVariables,
} from './ydoc.ts'

/**
 * Editing operations on a project held in a `Y.Doc`. Each one runs in a single transaction,
 * so that it is one step for `Y.UndoManager`, and keeps the invariants checked by
 * `projectDocSchema` (unique names, a tree without orphans, a valid start screen).
 *
 * `origin` is passed to `transact`: the studio tags its own writes so that observers can tell
 * them apart from remote ones.
 */
export type Origin = unknown

export class ProjectOpError extends Error {
  override name = 'ProjectOpError'
}

function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new ProjectOpError(`${what} not found`)
  return value
}

export function screenMap(ydoc: Y.Doc, screenId: ScreenId): YMap {
  return must(yScreens(ydoc).get(screenId), `screen ${screenId}`)
}

export function componentsMap(ydoc: Y.Doc, screenId: ScreenId): Y.Map<YMap> {
  return screenMap(ydoc, screenId).get('components')
}

export function componentMap(ydoc: Y.Doc, screenId: ScreenId, componentId: ComponentId): YMap {
  return must(componentsMap(ydoc, screenId).get(componentId), `component ${componentId}`)
}

function childrenOf(component: YMap): YArray<string> {
  let children = component.get('children') as YArray<string> | undefined
  if (!children) {
    children = new Y.Array<string>()
    component.set('children', children)
  }
  return children
}

/** Where a component sits: its parent (null for non-visual ones) and its index. */
export function locateComponent(
  ydoc: Y.Doc,
  screenId: ScreenId,
  componentId: ComponentId,
): { parentId: ComponentId | null; index: number } | undefined {
  const screen = screenMap(ydoc, screenId)
  const nonVisual = (screen.get('nonVisual') as YArray<string>).toArray().indexOf(componentId)
  if (nonVisual >= 0) return { parentId: null, index: nonVisual }
  for (const [parentId, component] of componentsMap(ydoc, screenId).entries()) {
    const children = component.get('children') as YArray<string> | undefined
    const index = children ? children.toArray().indexOf(componentId) : -1
    if (index >= 0) return { parentId, index }
  }
  return undefined
}

export function componentNames(ydoc: Y.Doc, screenId: ScreenId): string[] {
  return Array.from(componentsMap(ydoc, screenId).values(), (c) => c.get('name') as string)
}

export function screenNames(ydoc: Y.Doc): string[] {
  return Array.from(yScreens(ydoc).values(), (s) => s.get('name') as string)
}

function descendants(ydoc: Y.Doc, screenId: ScreenId, componentId: ComponentId): ComponentId[] {
  const components = componentsMap(ydoc, screenId)
  const result: ComponentId[] = []
  const visit = (id: ComponentId): void => {
    result.push(id)
    const children = components.get(id)?.get('children') as YArray<string> | undefined
    for (const child of children?.toArray() ?? []) visit(child)
  }
  visit(componentId)
  return result
}

function isInside(
  ydoc: Y.Doc,
  screenId: ScreenId,
  id: ComponentId,
  ancestor: ComponentId,
): boolean {
  return descendants(ydoc, screenId, ancestor).includes(id)
}

// Screens

export type NewScreen = {
  id?: ScreenId
  name: string
  root: ComponentNode
  rootId?: ComponentId
}

export function addScreen(ydoc: Y.Doc, input: NewScreen, index?: number, origin?: Origin) {
  const id = input.id ?? newId()
  const rootId = input.rootId ?? newId()
  ydoc.transact(() => {
    const name = screenNames(ydoc).includes(input.name)
      ? uniqueName(input.name, screenNames(ydoc))
      : input.name
    const screen: Screen = {
      name,
      rootId,
      components: {
        [rootId]: { ...input.root, children: input.root.children ?? [] },
      },
      nonVisual: [],
    }
    yScreens(ydoc).set(id, screenToY(screen))
    const order = yScreenOrder(ydoc)
    order.insert(Math.min(index ?? order.length, order.length), [id])
  }, origin)
  return id
}

export function renameScreen(ydoc: Y.Doc, screenId: ScreenId, name: string, origin?: Origin) {
  ydoc.transact(() => {
    const screen = screenMap(ydoc, screenId)
    if (screen.get('name') === name) return
    if (screenNames(ydoc).includes(name)) throw new ProjectOpError(`screen name ${name} is taken`)
    // The root component carries the screen's name ("when Home opens"): rename both.
    const rootId = screen.get('rootId') as string
    const components = screen.get('components') as Y.Map<YMap>
    for (const [id, component] of components.entries()) {
      if (id !== rootId && component.get('name') === name) {
        throw new ProjectOpError(`component name ${name} is taken in this screen`)
      }
    }
    screen.set('name', name)
    components.get(rootId)?.set('name', name)
  }, origin)
}

export function moveScreen(ydoc: Y.Doc, screenId: ScreenId, toIndex: number, origin?: Origin) {
  ydoc.transact(() => {
    const order = yScreenOrder(ydoc)
    const from = order.toArray().indexOf(screenId)
    if (from < 0) throw new ProjectOpError(`screen ${screenId} not found`)
    const target = Math.max(0, Math.min(toIndex, order.length - 1))
    if (from === target) return
    order.delete(from, 1)
    order.insert(target, [screenId])
  }, origin)
}

export function removeScreen(ydoc: Y.Doc, screenId: ScreenId, origin?: Origin) {
  ydoc.transact(() => {
    const order = yScreenOrder(ydoc)
    const index = order.toArray().indexOf(screenId)
    if (index < 0) throw new ProjectOpError(`screen ${screenId} not found`)
    if (order.length === 1) throw new ProjectOpError('a project keeps at least one screen')
    order.delete(index, 1)
    yScreens(ydoc).delete(screenId)
    yBlocks(ydoc).delete(screenId)
    const navigation = ySettings(ydoc).get('navigation') as YMap
    if (navigation.get('startScreen') === screenId) navigation.set('startScreen', order.get(0))
  }, origin)
}

export function setStartScreen(ydoc: Y.Doc, screenId: ScreenId, origin?: Origin) {
  ydoc.transact(() => {
    screenMap(ydoc, screenId)
    ;(ySettings(ydoc).get('navigation') as YMap).set('startScreen', screenId)
  }, origin)
}

/** Replaces every string equal to a key of `ids` (component ids in block fields, typically). */
function remapIds<T>(value: T, ids: Map<string, string>): T {
  if (typeof value === 'string') return (ids.get(value) ?? value) as T
  if (Array.isArray(value)) return value.map((item) => remapIds(item, ids)) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, remapIds(item, ids)]),
    ) as T
  }
  return value
}

/** Copies a screen (components and blocks) right after it, under a free name. */
export function duplicateScreen(ydoc: Y.Doc, screenId: ScreenId, origin?: Origin): ScreenId {
  const id = newId()
  ydoc.transact(() => {
    const source = screenMap(ydoc, screenId).toJSON() as Screen
    const ids = new Map(Object.keys(source.components).map((old) => [old, newId()]))
    const copy: Screen = {
      name: uniqueName(source.name, screenNames(ydoc)),
      rootId: must(ids.get(source.rootId), 'root'),
      components: Object.fromEntries(
        Object.entries(source.components).map(([old, node]) => [
          ids.get(old),
          {
            ...node,
            children: node.children?.map((child) => ids.get(child) ?? child),
          },
        ]),
      ) as Screen['components'],
      nonVisual: source.nonVisual.map((old) => ids.get(old) ?? old),
    }
    yScreens(ydoc).set(id, screenToY(copy))
    const order = yScreenOrder(ydoc)
    order.insert(order.toArray().indexOf(screenId) + 1, [id])
    const stacks = yBlocks(ydoc).get(screenId)?.toJSON() as Record<string, BlocklyJson> | undefined
    if (stacks) yBlocks(ydoc).set(id, mapFrom(remapIds(stacks, ids)) as Y.Map<BlocklyJson>)
  }, origin)
  return id
}

// Components

export type NewComponent = ComponentNode & { id?: ComponentId }

/**
 * Inserts a component (and nothing else: its `children` must be empty or already present).
 * `parentId` null puts it in the non-visual list. The name is made unique in the screen.
 */
export function addComponent(
  ydoc: Y.Doc,
  screenId: ScreenId,
  input: NewComponent,
  parentId: ComponentId | null,
  index?: number,
  origin?: Origin,
): ComponentId {
  const { id: requested, ...node } = input
  const id = requested ?? newId()
  ydoc.transact(() => {
    const names = componentNames(ydoc, screenId)
    const name = names.includes(node.name) ? uniqueName(node.name, names) : node.name
    componentsMap(ydoc, screenId).set(id, componentToY({ ...node, name }))
    const list =
      parentId === null
        ? (screenMap(ydoc, screenId).get('nonVisual') as YArray<string>)
        : childrenOf(componentMap(ydoc, screenId, parentId))
    list.insert(Math.min(index ?? list.length, list.length), [id])
  }, origin)
  return id
}

export function moveComponent(
  ydoc: Y.Doc,
  screenId: ScreenId,
  componentId: ComponentId,
  parentId: ComponentId,
  index: number,
  origin?: Origin,
) {
  ydoc.transact(() => {
    if (componentId === screenMap(ydoc, screenId).get('rootId')) {
      throw new ProjectOpError('the screen root cannot move')
    }
    if (isInside(ydoc, screenId, parentId, componentId)) {
      throw new ProjectOpError('a component cannot move inside itself')
    }
    const from = must(locateComponent(ydoc, screenId, componentId), `component ${componentId}`)
    const target = childrenOf(componentMap(ydoc, screenId, parentId))
    let at = index
    if (from.parentId === parentId) {
      if (from.index < index) at -= 1
      if (from.index === at) return
    }
    const source =
      from.parentId === null
        ? (screenMap(ydoc, screenId).get('nonVisual') as YArray<string>)
        : childrenOf(componentMap(ydoc, screenId, from.parentId))
    source.delete(from.index, 1)
    target.insert(Math.max(0, Math.min(at, target.length)), [componentId])
  }, origin)
}

export function removeComponent(
  ydoc: Y.Doc,
  screenId: ScreenId,
  componentId: ComponentId,
  origin?: Origin,
) {
  ydoc.transact(() => {
    if (componentId === screenMap(ydoc, screenId).get('rootId')) {
      throw new ProjectOpError('the screen root cannot be removed')
    }
    const at = must(locateComponent(ydoc, screenId, componentId), `component ${componentId}`)
    const list =
      at.parentId === null
        ? (screenMap(ydoc, screenId).get('nonVisual') as YArray<string>)
        : childrenOf(componentMap(ydoc, screenId, at.parentId))
    list.delete(at.index, 1)
    const components = componentsMap(ydoc, screenId)
    for (const id of descendants(ydoc, screenId, componentId)) components.delete(id)
  }, origin)
}

/** Copies a component and its descendants right after it; returns the id of the copy. */
export function duplicateComponent(
  ydoc: Y.Doc,
  screenId: ScreenId,
  componentId: ComponentId,
  origin?: Origin,
): ComponentId {
  let copyId = ''
  ydoc.transact(() => {
    const at = must(locateComponent(ydoc, screenId, componentId), `component ${componentId}`)
    const components = componentsMap(ydoc, screenId)
    const names = new Set(componentNames(ydoc, screenId))
    const copy = (id: ComponentId): ComponentId => {
      const node = components.get(id)?.toJSON() as ComponentNode
      const newIdValue = newId()
      const name = uniqueName(node.name, names)
      names.add(name)
      const children = node.children?.map(copy)
      components.set(newIdValue, componentToY({ ...node, name, children, locked: false }))
      return newIdValue
    }
    copyId = copy(componentId)
    const list =
      at.parentId === null
        ? (screenMap(ydoc, screenId).get('nonVisual') as YArray<string>)
        : childrenOf(componentMap(ydoc, screenId, at.parentId))
    list.insert(at.index + 1, [copyId])
  }, origin)
  return copyId
}

/** Sets a property; `undefined` goes back to the catalog default. */
export function setProp(
  ydoc: Y.Doc,
  screenId: ScreenId,
  componentId: ComponentId,
  key: string,
  value: unknown,
  origin?: Origin,
) {
  ydoc.transact(() => {
    const props = componentMap(ydoc, screenId, componentId).get('props') as YMap
    if (value === undefined) props.delete(key)
    else if (props.get(key) !== value) props.set(key, value)
  }, origin)
}

export function renameComponent(
  ydoc: Y.Doc,
  screenId: ScreenId,
  componentId: ComponentId,
  name: string,
  origin?: Origin,
) {
  ydoc.transact(() => {
    const component = componentMap(ydoc, screenId, componentId)
    if (component.get('name') === name) return
    if (componentNames(ydoc, screenId).includes(name)) {
      throw new ProjectOpError(`component name ${name} is taken`)
    }
    component.set('name', name)
  }, origin)
}

export function setComponentFlag(
  ydoc: Y.Doc,
  screenId: ScreenId,
  componentId: ComponentId,
  flag: 'hidden' | 'locked',
  value: boolean,
  origin?: Origin,
) {
  ydoc.transact(() => {
    const component = componentMap(ydoc, screenId, componentId)
    if (value) component.set(flag, true)
    else component.delete(flag)
  }, origin)
}

// Blocks

/** Writes (or with `null` deletes) one stack of blocks. */
export function setBlockStack(
  ydoc: Y.Doc,
  workspace: WorkspaceKey,
  topBlockId: string,
  json: BlocklyJson | null,
  origin?: Origin,
) {
  ydoc.transact(() => {
    const blocks = yBlocks(ydoc)
    let stacks = blocks.get(workspace)
    if (!stacks) {
      if (json === null) return
      stacks = new Y.Map()
      blocks.set(workspace, stacks)
    }
    if (json === null) stacks.delete(topBlockId)
    else stacks.set(topBlockId, json)
  }, origin)
}

// Meta, variables, assets

export function setMeta(
  ydoc: Y.Doc,
  patch: Partial<Pick<ProjectMeta, 'name' | 'description' | 'mode' | 'locale' | 'updatedAt'>>,
  origin?: Origin,
) {
  ydoc.transact(() => {
    const meta = yMeta(ydoc)
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) meta.delete(key)
      else if (meta.get(key) !== value) meta.set(key, value)
    }
  }, origin)
}

function variableList(ydoc: Y.Doc, kind: VarKind): YArray<VarDecl> {
  let list = yVariables(ydoc).get(kind) as YArray<VarDecl> | undefined
  if (!list) {
    list = new Y.Array<VarDecl>()
    yVariables(ydoc).set(kind, list)
  }
  return list
}

export function allVariableNames(ydoc: Y.Doc): string[] {
  return (['app', 'stored', 'shared'] as const).flatMap((kind) =>
    variableList(ydoc, kind)
      .toArray()
      .map((v) => v.name),
  )
}

export function addVariable(
  ydoc: Y.Doc,
  kind: VarKind,
  decl: Omit<VarDecl, 'id'> & { id?: string },
  origin?: Origin,
): VarDecl {
  const variable: VarDecl = { ...decl, id: decl.id ?? newId() }
  ydoc.transact(() => {
    if (allVariableNames(ydoc).includes(variable.name)) {
      throw new ProjectOpError(`variable name ${variable.name} is taken`)
    }
    variableList(ydoc, kind).push([variable])
  }, origin)
  return variable
}

export function updateVariable(
  ydoc: Y.Doc,
  kind: VarKind,
  variableId: string,
  patch: Partial<Omit<VarDecl, 'id'>>,
  origin?: Origin,
) {
  ydoc.transact(() => {
    const list = variableList(ydoc, kind)
    const index = list.toArray().findIndex((v) => v.id === variableId)
    const current = must(list.get(index), `variable ${variableId}`)
    if (patch.name && patch.name !== current.name && allVariableNames(ydoc).includes(patch.name)) {
      throw new ProjectOpError(`variable name ${patch.name} is taken`)
    }
    list.delete(index, 1)
    list.insert(index, [{ ...current, ...patch }])
  }, origin)
}

export function removeVariable(ydoc: Y.Doc, kind: VarKind, variableId: string, origin?: Origin) {
  ydoc.transact(() => {
    const list = variableList(ydoc, kind)
    const index = list.toArray().findIndex((v) => v.id === variableId)
    if (index >= 0) list.delete(index, 1)
  }, origin)
}

export function addAsset(ydoc: Y.Doc, asset: Asset, id = newId(), origin?: Origin): string {
  ydoc.transact(() => yAssets(ydoc).set(id, asset), origin)
  return id
}

export function removeAsset(ydoc: Y.Doc, assetId: string, origin?: Origin) {
  ydoc.transact(() => yAssets(ydoc).delete(assetId), origin)
}
