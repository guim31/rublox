import type { Locale, UiMode, WorkspaceKey } from '@rublox/schema'
import type * as Blockly from 'blockly/core'

export type ComponentRef = { id: string; name: string; type: string }
export type ScreenRef = { id: string; name: string }
/** A variable of the project and where it lives (`app.x`, `stored.x`, `shared.x`). */
export type VariableRef = { id: string; name: string; kind: 'app' | 'stored' | 'shared' }
/** A function of the `app` workspace, callable from every screen (`functions.name`). */
export type AppFunctionRef = { name: string; params: string[]; returns: boolean }

/**
 * What the blocks of one workspace need to know about the project: dropdowns list these
 * components and screens, labels use this language, the toolbox follows this mode.
 */
export type BlocksContext = {
  workspace: WorkspaceKey
  locale: Locale
  mode: UiMode
  /** Junior's "More blocks": show everything Studio shows. */
  showAll: boolean
  /** Components of the workspace's screen (none for the `app` workspace). */
  components: ComponentRef[]
  screens: ScreenRef[]
  /** Every variable of the project, with its kind. */
  variables?: VariableRef[]
  /** Functions defined in the `app` workspace. */
  appFunctions?: AppFunctionRef[]
}

const contexts = new WeakMap<Blockly.Workspace, () => BlocksContext>()
let fallback: BlocksContext = {
  workspace: 'app',
  locale: 'fr',
  mode: 'junior',
  showAll: false,
  components: [],
  screens: [],
}

/** Ties a workspace to a context getter, read each time a dropdown opens or code is generated. */
export function setBlocksContext(workspace: Blockly.Workspace, get: () => BlocksContext): void {
  contexts.set(workspace, get)
  fallback = get()
}

/**
 * The context of the workspace a block lives in. Blocks in a flyout or a mutator belong to a
 * child workspace: walk up to the one that was registered.
 */
export function contextOf(workspace: Blockly.Workspace | null | undefined): BlocksContext {
  let current = workspace as (Blockly.Workspace & { targetWorkspace?: Blockly.Workspace }) | null
  for (let depth = 0; current && depth < 4; depth++) {
    const get = contexts.get(current)
    if (get) return get()
    const parent: Blockly.Workspace | null =
      current.targetWorkspace ??
      (
        current as unknown as {
          options?: { parentWorkspace?: Blockly.Workspace }
        }
      ).options?.parentWorkspace ??
      null
    current = parent as typeof current
  }
  return fallback
}

/** The language blocks are created in (block labels are read when a block is created). */
let currentLocale: Locale = 'fr'
export function getBlocksLocale(): Locale {
  return currentLocale
}
export function setBlocksLocaleValue(locale: Locale): void {
  currentLocale = locale
}
