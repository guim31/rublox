import {
  type BlocksContext,
  blocklyTheme,
  buildToolbox,
  CREATE_APP_VARIABLE,
  CREATE_SHARED_VARIABLE,
  CREATE_STORED_VARIABLE,
  contextFromDoc,
  injectWorkspace,
  refreshDataBlocks,
  refreshReferences,
  setBlocksContext,
  setupBlocks,
  VARIABLES_CATEGORY,
  variablesFlyout,
} from '@rublox/blocks'
import { messages } from '@rublox/i18n'
import {
  addVariable,
  allVariableNames,
  type BlocklyJson,
  isValidName,
  removeVariable,
  setBlockStack,
  updateVariable,
  type WorkspaceKey,
  yBlocks,
  yVariables,
} from '@rublox/schema'
import * as Blockly from 'blockly/core'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import type * as Y from 'yjs'
import { isDark, usePrefs } from '../../lib/prefs.ts'
import { useDoc, useSession } from '../context.tsx'
import { BLOCKLY_ORIGIN, type ProjectSession } from '../session.ts'
import { useEditor } from '../store.ts'
import { registerBlockMenu, showBreakpoints } from './block-menu.ts'
import { askName } from './prompt.tsx'

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

let shortcutsPatched = false

/** Undo and redo belong to the project (`Y.UndoManager`), not to Blockly. */
function patchBlockly(): void {
  if (shortcutsPatched) return
  shortcutsPatched = true
  for (const name of [Blockly.ShortcutItems.names.UNDO, Blockly.ShortcutItems.names.REDO]) {
    if (Blockly.ShortcutRegistry.registry.getRegistry()[name])
      Blockly.ShortcutRegistry.registry.unregister(name)
  }
  for (const id of ['undoWorkspace', 'redoWorkspace']) {
    if (Blockly.ContextMenuRegistry.registry.getItem(id))
      Blockly.ContextMenuRegistry.registry.unregister(id)
  }
  Blockly.dialog.setPrompt((message, defaultValue, callback) => {
    void askName(message, defaultValue).then(callback)
  })
}

function storedStacks(session: ProjectSession, key: WorkspaceKey): Record<string, BlocklyJson> {
  return (yBlocks(session.ydoc).get(key)?.toJSON() ?? {}) as Record<string, BlocklyJson>
}

/** Writes the workspace's stacks into the project: one entry per top block (SPEC § 6.4). */
function saveToProject(
  session: ProjectSession,
  key: WorkspaceKey,
  workspace: Blockly.WorkspaceSvg,
): void {
  const stored = storedStacks(session, key)
  const tops = workspace.getTopBlocks(false).filter((block) => !block.isInsertionMarker())
  session.ydoc.transact(() => {
    for (const block of tops) {
      const json = Blockly.serialization.blocks.save(block, {
        addCoordinates: true,
      }) as BlocklyJson | null
      if (json && !same(json, stored[block.id]))
        setBlockStack(session.ydoc, key, block.id, json, BLOCKLY_ORIGIN)
    }
    const ids = new Set(tops.map((block) => block.id))
    for (const id of Object.keys(stored)) {
      if (!ids.has(id)) setBlockStack(session.ydoc, key, id, null, BLOCKLY_ORIGIN)
    }
  }, BLOCKLY_ORIGIN)
}

/** Brings the workspace to what the project holds (after an undo, or at load). */
function loadFromProject(
  session: ProjectSession,
  key: WorkspaceKey,
  workspace: Blockly.WorkspaceSvg,
): void {
  const stored = storedStacks(session, key)
  Blockly.Events.disable()
  try {
    syncVariables(session, workspace)
    for (const block of workspace.getTopBlocks(false)) {
      const json = stored[block.id]
      const current = Blockly.serialization.blocks.save(block, { addCoordinates: true })
      if (!json || !same(json, current)) block.dispose(false)
    }
    for (const [id, json] of Object.entries(stored)) {
      if (workspace.getBlockById(id)) continue
      try {
        Blockly.serialization.blocks.append(json as Blockly.serialization.blocks.State, workspace)
      } catch (error) {
        console.warn('Rublox: skipped a stack of blocks', error)
      }
    }
  } finally {
    Blockly.Events.enable()
  }
  refreshReferences(workspace)
}

/** Project variables (all kinds) → the workspace's variable map. */
function syncVariables(session: ProjectSession, workspace: Blockly.Workspace): void {
  const doc = session.getDoc()
  const map = workspace.getVariableMap()
  for (const variable of [...doc.variables.app, ...doc.variables.stored, ...doc.variables.shared]) {
    const existing = map.getVariableById(variable.id)
    if (!existing) map.createVariable(variable.name, '', variable.id)
    else if (existing.getName() !== variable.name) map.renameVariable(existing, variable.name)
  }
}

/**
 * The Blockly workspace of one screen (or of `app`), kept in sync with the Yjs document in
 * both directions: Blockly changes are saved per stack, undo/redo and other changes are
 * applied back to Blockly.
 */
export function BlocksWorkspace({
  workspaceKey,
  label,
}: {
  workspaceKey: WorkspaceKey
  label: string
}) {
  const session = useSession()
  const doc = useDoc()
  const { mode, locale, theme, moreBlocks } = usePrefs()
  const host = useRef<HTMLElement>(null)
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null)
  const contextRef = useRef<BlocksContext>(
    contextFromDoc(doc, workspaceKey, { locale, mode, showAll: moreBlocks }),
  )
  contextRef.current = contextFromDoc(doc, workspaceKey, { locale, mode, showAll: moreBlocks })
  const dark = isDark(theme)

  // Create the workspace; recreate it when the language or the mode changes (labels and
  // renderer are fixed at creation).
  // biome-ignore lint/correctness/useExhaustiveDependencies: theme and context are applied by the effects below
  useEffect(() => {
    const element = host.current
    if (!element) return
    setupBlocks(locale)
    patchBlockly()
    registerBlockMenu()
    const workspace = injectWorkspace(element, {
      mode,
      dark,
      toolbox: buildToolbox(contextRef.current),
    })
    workspaceRef.current = workspace
    setBlocksContext(workspace, () => contextRef.current)
    // Variables: app ones, then stored ones (kept on the device), each with its button.
    workspace.registerToolboxCategoryCallback(
      VARIABLES_CATEGORY,
      (target) => variablesFlyout(target) as Blockly.utils.toolbox.FlyoutItemInfoArray,
    )
    workspace.registerButtonCallback(CREATE_APP_VARIABLE, () =>
      Blockly.Variables.createVariableButtonHandler(workspace),
    )
    // Stored variables (kept on the device) and shared ones (on the server, J5).
    const createVariable = (kind: 'stored' | 'shared', prompt: string) => {
      const strings = messages[locale].catalog.blocks
      void askName(prompt, '').then((name) => {
        const trimmed = name?.trim()
        if (!trimmed) return
        if (!isValidName(trimmed) || allVariableNames(session.ydoc).includes(trimmed)) {
          toast.error(strings.nameTaken)
          return
        }
        addVariable(session.ydoc, kind, { name: trimmed, initial: 0 })
        workspace.refreshToolboxSelection()
      })
    }
    workspace.registerButtonCallback(CREATE_STORED_VARIABLE, () =>
      createVariable('stored', messages[locale].catalog.blocks.storedPrompt),
    )
    workspace.registerButtonCallback(CREATE_SHARED_VARIABLE, () =>
      createVariable('shared', messages[locale].studio.data.sharedPrompt),
    )
    loadFromProject(session, workspaceKey, workspace)
    workspace.addChangeListener(Blockly.Events.disableOrphans)

    let queued = false
    const onChange = (event: Blockly.Events.Abstract) => {
      if (event.isUiEvent || !Blockly.Events.isEnabled()) return
      if (
        event.type === Blockly.Events.VAR_CREATE ||
        event.type === Blockly.Events.VAR_RENAME ||
        event.type === Blockly.Events.VAR_DELETE
      ) {
        onVariableEvent(session, workspace, event)
      }
      if (queued) return
      queued = true
      requestAnimationFrame(() => {
        queued = false
        showBreakpoints(workspace, useEditor.getState().slow.breakpoints)
        if (workspace.isDragging()) return
        saveToProject(session, workspaceKey, workspace)
      })
    }
    workspace.addChangeListener(onChange)

    const blocks = yBlocks(session.ydoc)
    const onRemote = (_events: Y.YEvent<Y.AbstractType<unknown>>[], transaction: Y.Transaction) => {
      if (transaction.origin === BLOCKLY_ORIGIN) return
      loadFromProject(session, workspaceKey, workspace)
    }
    blocks.observeDeep(onRemote)
    const variables = yVariables(session.ydoc)
    const onVariables = (_events: unknown, transaction: Y.Transaction) => {
      if (transaction.origin === BLOCKLY_ORIGIN) return
      Blockly.Events.disable()
      try {
        syncVariables(session, workspace)
      } finally {
        Blockly.Events.enable()
      }
    }
    variables.observeDeep(onVariables)

    const resize = new ResizeObserver(() => Blockly.svgResize(workspace))
    resize.observe(element)
    return () => {
      resize.disconnect()
      blocks.unobserveDeep(onRemote)
      variables.unobserveDeep(onVariables)
      saveToProject(session, workspaceKey, workspace)
      workspace.dispose()
      workspaceRef.current = null
    }
  }, [session, workspaceKey, locale, mode])

  // Theme follows the studio without recreating the workspace.
  useEffect(() => {
    workspaceRef.current?.setTheme(blocklyTheme(mode, dark))
  }, [mode, dark])

  // Components, screens or "More blocks" changed: new toolbox, names refreshed.
  const toolboxKey = JSON.stringify([
    contextRef.current.components,
    contextRef.current.screens,
    contextRef.current.appFunctions,
    contextRef.current.tables,
    contextRef.current.apis,
    moreBlocks,
  ])
  // biome-ignore lint/correctness/useExhaustiveDependencies: toolboxKey sums up the context
  useEffect(() => {
    const workspace = workspaceRef.current
    if (!workspace) return
    workspace.updateToolbox(buildToolbox(contextRef.current))
    refreshDataBlocks(workspace)
    refreshReferences(workspace)
  }, [toolboxKey])

  // Slow motion: the running block lights up; breakpoints are drawn.
  const step = useEditor((s) => s.slow.step)
  const breakpoints = useEditor((s) => s.slow.breakpoints)
  useEffect(() => {
    const workspace = workspaceRef.current
    if (!workspace) return
    const id = step?.workspace === workspaceKey ? step.blockId : null
    workspace.highlightBlock(id && workspace.getBlockById(id) ? id : null)
    if (id && step?.paused) workspace.centerOnBlock(id)
  }, [step, workspaceKey])
  useEffect(() => {
    const workspace = workspaceRef.current
    if (workspace) showBreakpoints(workspace, breakpoints)
  }, [breakpoints])

  // A console error asked to show its block.
  const focusBlock = useEditor((s) => s.focusBlock)
  useEffect(() => {
    const workspace = workspaceRef.current
    if (!workspace || !focusBlock) return
    const block = workspace.getBlockById(focusBlock)
    if (block) {
      workspace.centerOnBlock(focusBlock)
      ;(block as Blockly.BlockSvg).select()
    }
    useEditor.getState().set({ focusBlock: null })
  }, [focusBlock])

  return (
    <section ref={host} className="size-full" aria-label={label} data-testid="blockly-workspace" />
  )
}

function onVariableEvent(
  session: ProjectSession,
  workspace: Blockly.Workspace,
  event: Blockly.Events.Abstract,
): void {
  const id = (event as Blockly.Events.VarBase).varId
  if (!id) return
  const doc = session.getDoc()
  const kind = (['app', 'stored', 'shared'] as const).find((k) =>
    doc.variables[k].some((v) => v.id === id),
  )
  const declared = kind ? doc.variables[kind].find((v) => v.id === id) : undefined
  if (event.type === Blockly.Events.VAR_CREATE) {
    const variable = workspace.getVariableMap().getVariableById(id)
    if (variable && !declared && !allVariableNames(session.ydoc).includes(variable.getName())) {
      addVariable(session.ydoc, 'app', { id, name: variable.getName(), initial: 0 }, BLOCKLY_ORIGIN)
    }
  } else if (event.type === Blockly.Events.VAR_RENAME) {
    const name = (event as Blockly.Events.VarRename).newName
    if (kind && declared && name && name !== declared.name)
      updateVariable(session.ydoc, kind, id, { name }, BLOCKLY_ORIGIN)
  } else if (event.type === Blockly.Events.VAR_DELETE && kind && declared) {
    removeVariable(session.ydoc, kind, id, BLOCKLY_ORIGIN)
  }
}
