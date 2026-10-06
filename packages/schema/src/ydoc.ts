import * as Y from 'yjs'
import {
  type BlocklyJson,
  type ComponentNode,
  PROJECT_FORMAT,
  PROJECT_FORMAT_VERSION,
  type ProjectDoc,
  type Screen,
  type VarKind,
} from './project.ts'

/**
 * Layout of a project inside a `Y.Doc`:
 *
 * - `rublox`: `format`, `formatVersion`
 * - `meta`: the fields of `ProjectDoc.meta`
 * - `settings`: `theme` and `navigation` as nested maps, the rest as plain values
 * - `screenOrder`: array of screen ids
 * - `screens`: screen id → map { name, rootId, components, nonVisual }
 *   - `components`: component id → map { type, name, props (map), children (array), hidden, locked }
 * - `blocks`: workspace key → map { top block id → Blockly JSON (plain object) }
 * - `variables`: `app`, `stored`, `shared` → arrays of plain `VarDecl`
 * - `assets`: asset id → plain object
 * - `data`: `tables`, `apis` → maps of plain objects
 *
 * One map per level so that concurrent edits of different fields merge, and blocks stored per
 * stack so that two people working on different stacks never conflict.
 */
export const Y_ROOTS = {
  root: 'rublox',
  meta: 'meta',
  settings: 'settings',
  screenOrder: 'screenOrder',
  screens: 'screens',
  blocks: 'blocks',
  variables: 'variables',
  assets: 'assets',
  data: 'data',
} as const

// Y.Map values are heterogeneous: the layout above is the contract.
// biome-ignore lint/suspicious/noExplicitAny: see above
export type YMap = Y.Map<any>
export type YArray<T> = Y.Array<T>

export function yRoot(ydoc: Y.Doc): YMap {
  return ydoc.getMap(Y_ROOTS.root)
}
export function yMeta(ydoc: Y.Doc): YMap {
  return ydoc.getMap(Y_ROOTS.meta)
}
export function ySettings(ydoc: Y.Doc): YMap {
  return ydoc.getMap(Y_ROOTS.settings)
}
export function yScreenOrder(ydoc: Y.Doc): YArray<string> {
  return ydoc.getArray<string>(Y_ROOTS.screenOrder)
}
export function yScreens(ydoc: Y.Doc): Y.Map<YMap> {
  return ydoc.getMap<YMap>(Y_ROOTS.screens)
}
export function yBlocks(ydoc: Y.Doc): Y.Map<Y.Map<BlocklyJson>> {
  return ydoc.getMap<Y.Map<BlocklyJson>>(Y_ROOTS.blocks)
}
export function yVariables(ydoc: Y.Doc): YMap {
  return ydoc.getMap(Y_ROOTS.variables)
}
export function yAssets(ydoc: Y.Doc): YMap {
  return ydoc.getMap(Y_ROOTS.assets)
}
export function yData(ydoc: Y.Doc): YMap {
  return ydoc.getMap(Y_ROOTS.data)
}

export function mapFrom(entries: Record<string, unknown>): YMap {
  const map: YMap = new Y.Map()
  for (const [key, value] of Object.entries(entries)) {
    if (value !== undefined) map.set(key, value)
  }
  return map
}

export function componentToY(node: ComponentNode): YMap {
  const map = mapFrom({ type: node.type, name: node.name })
  map.set('props', mapFrom(node.props))
  if (node.children) map.set('children', Y.Array.from(node.children))
  if (node.hidden) map.set('hidden', true)
  if (node.locked) map.set('locked', true)
  return map
}

export function screenToY(screen: Screen): YMap {
  const map = mapFrom({ name: screen.name, rootId: screen.rootId })
  const components: YMap = new Y.Map()
  for (const [componentId, node] of Object.entries(screen.components)) {
    components.set(componentId, componentToY(node))
  }
  map.set('components', components)
  map.set('nonVisual', Y.Array.from(screen.nonVisual))
  return map
}

/** Writes `doc` into an empty `Y.Doc` (a new one by default) in a single transaction. */
export function projectToYDoc(doc: ProjectDoc, ydoc: Y.Doc = new Y.Doc()): Y.Doc {
  ydoc.transact(() => {
    const root = yRoot(ydoc)
    root.set('format', doc.format)
    root.set('formatVersion', doc.formatVersion)

    const meta = yMeta(ydoc)
    for (const [key, value] of Object.entries(doc.meta)) {
      if (value !== undefined) meta.set(key, value)
    }

    const settings = ySettings(ydoc)
    settings.set('theme', mapFrom(doc.settings.theme))
    settings.set('navigation', mapFrom(doc.settings.navigation))
    settings.set('orientation', doc.settings.orientation)
    if (doc.settings.icon) settings.set('icon', doc.settings.icon)

    yScreenOrder(ydoc).push(doc.screenOrder)
    const screens = yScreens(ydoc)
    for (const [screenId, screen] of Object.entries(doc.screens)) {
      screens.set(screenId, screenToY(screen))
    }

    const blocks = yBlocks(ydoc)
    for (const [workspace, stacks] of Object.entries(doc.blocks)) {
      blocks.set(workspace, mapFrom(stacks) as Y.Map<BlocklyJson>)
    }

    const variables = yVariables(ydoc)
    for (const kind of ['app', 'stored', 'shared'] as const satisfies VarKind[]) {
      variables.set(kind, Y.Array.from(doc.variables[kind]))
    }

    const assets = yAssets(ydoc)
    for (const [assetId, asset] of Object.entries(doc.assets)) assets.set(assetId, asset)

    const data = yData(ydoc)
    data.set('tables', mapFrom(doc.data.tables))
    data.set('apis', mapFrom(doc.data.apis))
  })
  return ydoc
}

/**
 * Reads the JSON form of a project. The result is not validated: pass it to
 * `projectDocSchema.parse` when it comes from an untrusted source.
 */
export function yDocToProject(ydoc: Y.Doc): ProjectDoc {
  const root = yRoot(ydoc)
  const variables = yVariables(ydoc).toJSON()
  const data = yData(ydoc).toJSON()
  return {
    format: root.get('format') ?? PROJECT_FORMAT,
    formatVersion: root.get('formatVersion') ?? PROJECT_FORMAT_VERSION,
    meta: yMeta(ydoc).toJSON() as ProjectDoc['meta'],
    settings: ySettings(ydoc).toJSON() as ProjectDoc['settings'],
    screenOrder: yScreenOrder(ydoc).toArray(),
    screens: yScreens(ydoc).toJSON() as ProjectDoc['screens'],
    blocks: yBlocks(ydoc).toJSON() as ProjectDoc['blocks'],
    variables: {
      app: variables.app ?? [],
      stored: variables.stored ?? [],
      shared: variables.shared ?? [],
    },
    assets: yAssets(ydoc).toJSON() as ProjectDoc['assets'],
    data: { tables: data.tables ?? {}, apis: data.apis ?? {} },
  }
}

/** True once the document holds a project (it may still be loading from storage). */
export function hasProject(ydoc: Y.Doc): boolean {
  return yRoot(ydoc).get('format') === PROJECT_FORMAT
}
