import {
  APP_WORKSPACE,
  type BlocklyJson,
  type Locale,
  type ProjectDoc,
  type UiMode,
  type WorkspaceKey,
} from '@rublox/schema'
import * as Blockly from 'blockly/core'
import { type BlocksContext, setBlocksContext } from './context.ts'
import { type GeneratedCode, RubloxGenerator, workspaceToModule } from './generator.ts'
import { setupBlocks } from './setup.ts'

let generator: RubloxGenerator | undefined

function getGenerator(): RubloxGenerator {
  generator ??= new RubloxGenerator()
  return generator
}

/** The context of a workspace of a project: its screen's components, the screens. */
export function contextFromDoc(
  doc: ProjectDoc,
  workspace: WorkspaceKey,
  options: { locale?: Locale; mode?: UiMode; showAll?: boolean } = {},
): BlocksContext {
  const screen = workspace === APP_WORKSPACE ? undefined : doc.screens[workspace]
  return {
    workspace,
    locale: options.locale ?? doc.meta.locale,
    mode: options.mode ?? doc.meta.mode,
    showAll: options.showAll ?? false,
    components: screen
      ? Object.entries(screen.components).map(([id, node]) => ({
          id,
          name: node.name,
          type: node.type,
        }))
      : [],
    screens: doc.screenOrder.map((id) => ({ id, name: doc.screens[id]?.name ?? id })),
  }
}

/**
 * Loads stacks into a headless workspace with the project's app variables. The caller must
 * dispose of it.
 */
export function headlessWorkspace(
  stacks: Record<string, BlocklyJson>,
  context: BlocksContext,
  variables: { id: string; name: string }[] = [],
): Blockly.Workspace {
  setupBlocks(context.locale)
  const workspace = new Blockly.Workspace(new Blockly.Options({ oneBasedIndex: true }))
  setBlocksContext(workspace, () => context)
  const wasEnabled = Blockly.Events.isEnabled()
  Blockly.Events.disable()
  try {
    for (const variable of variables) {
      workspace.getVariableMap().createVariable(variable.name, '', variable.id)
    }
    for (const json of Object.values(stacks)) {
      try {
        Blockly.serialization.blocks.append(json as Blockly.serialization.blocks.State, workspace)
      } catch (error) {
        // A stack that cannot be loaded (unknown block type…) is left out, not fatal.
        console.warn('Rublox: skipped a stack of blocks', error)
      }
    }
  } finally {
    if (wasEnabled) Blockly.Events.enable()
  }
  return workspace
}

/** Generates the module of one workspace from its saved stacks. */
export function generateWorkspaceCode(
  stacks: Record<string, BlocklyJson>,
  context: BlocksContext,
  variables: { id: string; name: string }[] = [],
): GeneratedCode {
  const workspace = headlessWorkspace(stacks, context, variables)
  try {
    return workspaceToModule(getGenerator(), workspace)
  } finally {
    workspace.dispose()
  }
}

/** Generates every module of a project: one per screen, plus `app`. */
export function generateProjectCode(doc: ProjectDoc): Record<WorkspaceKey, GeneratedCode> {
  const variables = [...doc.variables.app, ...doc.variables.stored, ...doc.variables.shared]
  const result: Record<WorkspaceKey, GeneratedCode> = {}
  for (const key of [APP_WORKSPACE, ...doc.screenOrder]) {
    result[key] = generateWorkspaceCode(doc.blocks[key] ?? {}, contextFromDoc(doc, key), variables)
  }
  return result
}

/** Generates the module of a live workspace (the one being edited). */
export function generateFromWorkspace(workspace: Blockly.Workspace): GeneratedCode {
  return workspaceToModule(getGenerator(), workspace)
}
