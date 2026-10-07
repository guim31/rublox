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
  entryWriter,
  isValidName,
  removeVariable,
  StackConflicts,
  setBlockStack,
  updateVariable,
  type WorkspaceKey,
  yBlocks,
  yVariables,
} from '@rublox/schema'
import * as Blockly from 'blockly/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type * as Y from 'yjs'
import { isDark, usePrefs } from '../../lib/prefs.ts'
import { useDoc, useSession } from '../context.tsx'
import { type Peer, peerStyle, usePeers } from '../presence.ts'
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
  // Keyboard navigation (SPEC § 4.2, § 5.1): Blockly 13 carries the official plugin in its
  // core (`@blockly/keyboard-navigation` stops at Blockly 12). Its jumps (Home, End, Page up
  // and down) and workspace scrolling are not registered by default.
  if (!Blockly.ShortcutRegistry.registry.getRegistry()[Blockly.ShortcutItems.names.SCROLL_UP]) {
    Blockly.ShortcutItems.registerNavigationShortcuts()
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

const serialize = (block: Blockly.Block) =>
  Blockly.serialization.blocks.save(block, { addCoordinates: true }) as BlocklyJson | null

/**
 * What a workspace last agreed with the project, stack by stack (the JSON it loaded or
 * saved). Saving writes only the stacks that changed here since then, and loading only those
 * that changed in the project: an edit received while one drags a block is never written
 * back over, and a stack one has not touched is never reverted (SPEC § 4.9).
 */
type Known = Map<string, BlocklyJson>

/**
 * Writes the stacks changed in the workspace into the project: one entry per top block. A
 * stack changed in the project since this workspace last saw it is left alone: that save came
 * first (see `overruled`).
 */
function saveToProject(
  session: ProjectSession,
  key: WorkspaceKey,
  workspace: Blockly.WorkspaceSvg,
  known: Known,
): void {
  const stored = storedStacks(session, key)
  const unseen = (id: string) => known.has(id) && !same(stored[id], known.get(id))
  const tops = workspace.getTopBlocks(false).filter((block) => !block.isInsertionMarker())
  session.ydoc.transact(() => {
    for (const block of tops) {
      const json = serialize(block)
      if (json && !same(json, known.get(block.id)) && !unseen(block.id)) {
        setBlockStack(session.ydoc, key, block.id, json, BLOCKLY_ORIGIN)
        known.set(block.id, json)
      }
    }
    const ids = new Set(tops.map((block) => block.id))
    for (const id of [...known.keys()]) {
      if (ids.has(id) || unseen(id)) continue
      setBlockStack(session.ydoc, key, id, null, BLOCKLY_ORIGIN)
      known.delete(id)
    }
  }, BLOCKLY_ORIGIN)
}

/**
 * The stacks changed both here (not saved yet: one was dragging) and in the project: the
 * other person saved first, their version wins (SPEC § 4.9). One's version is dropped from
 * the workspace, so that loading brings theirs. `busy` (the stack one types in) waits.
 */
function overruled(
  session: ProjectSession,
  key: WorkspaceKey,
  workspace: Blockly.WorkspaceSvg,
  known: Known,
  busy: string | null,
): string[] {
  const stored = storedStacks(session, key)
  const lost: string[] = []
  Blockly.Events.disable()
  try {
    for (const [id, json] of [...known]) {
      if (id === busy || same(stored[id], json)) continue
      const block = workspace.getBlockById(id)
      const current = block ? serialize(block) : null
      if (same(current, json)) continue // only changed there: loading brings it
      lost.push(id)
      block?.dispose(false)
      known.delete(id)
    }
  } finally {
    Blockly.Events.enable()
  }
  return lost
}

/**
 * Brings the workspace to what the project holds (at load, after an undo, or an edit of
 * someone else), stack by stack, without moving the view; `busy` stacks (one is typing in
 * them) wait. Returns whether some stack had to wait.
 */
function loadFromProject(
  session: ProjectSession,
  key: WorkspaceKey,
  workspace: Blockly.WorkspaceSvg,
  known: Known,
  busy: string | null = null,
): boolean {
  const stored = storedStacks(session, key)
  const selected = Blockly.getSelected()
  const selectedId = selected instanceof Blockly.BlockSvg ? selected.id : null
  let waiting = false
  Blockly.Events.disable()
  try {
    syncVariables(session, workspace)
    for (const block of workspace.getTopBlocks(false)) {
      if (block.isInsertionMarker()) continue
      const json = stored[block.id]
      if (json && same(json, known.get(block.id))) continue
      if (!json && !known.has(block.id)) continue // new here, not saved yet
      if (block.id === busy) {
        waiting = true
        continue
      }
      if (json && same(json, serialize(block))) {
        known.set(block.id, json)
        continue
      }
      block.dispose(false)
      known.delete(block.id)
    }
    for (const [id, json] of Object.entries(stored)) {
      if (workspace.getBlockById(id)) continue
      try {
        Blockly.serialization.blocks.append(json as Blockly.serialization.blocks.State, workspace)
        known.set(id, json)
      } catch (error) {
        console.warn('Rublox: skipped a stack of blocks', error)
      }
    }
    // The selected block keeps its selection when its stack was replaced.
    const again = selectedId ? workspace.getBlockById(selectedId) : null
    if (again && Blockly.getSelected() !== again) again.select()
  } finally {
    Blockly.Events.enable()
  }
  refreshReferences(workspace)
  return waiting
}

/** The top block of the stack a block id belongs to. */
function stackOf(workspace: Blockly.Workspace, id: string | null | undefined): string | null {
  const block = id ? workspace.getBlockById(id) : null
  return block ? block.getRootBlock().id : null
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
  const { t } = useTranslation()
  const tRef = useRef(t)
  tRef.current = t
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
    const known: Known = new Map()
    loadFromProject(session, workspaceKey, workspace, known)
    workspace.addChangeListener(Blockly.Events.disableOrphans)

    // Someone else's edits wait while one drags blocks (and the stack one types in waits
    // until the field closes); one's own pending changes are saved first, so that the last
    // save wins.
    let pending = false
    let retry: ReturnType<typeof setTimeout> | undefined
    const editing = () =>
      Blockly.WidgetDiv.isVisible() || Blockly.DropDownDiv.isVisible()
        ? stackOf(workspace, (Blockly.getSelected() as Blockly.BlockSvg | null)?.id)
        : null
    const sync = () => {
      clearTimeout(retry)
      if (workspace.isDragging()) {
        pending = true
        retry = setTimeout(sync, 250)
        return
      }
      const busy = editing()
      for (const stack of overruled(session, workspaceKey, workspace, known, busy)) {
        notifyConflict(stack, authors.get(stack) ?? null)
      }
      saveToProject(session, workspaceKey, workspace, known)
      pending = loadFromProject(session, workspaceKey, workspace, known, busy)
      if (pending) retry = setTimeout(sync, 250)
    }

    let queued = false
    const onChange = (event: Blockly.Events.Abstract) => {
      if (event.type === Blockly.Events.SELECTED) {
        session.presence?.set({ block: (event as Blockly.Events.Selected).newElementId ?? null })
      }
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
        if (pending) sync()
        else saveToProject(session, workspaceKey, workspace, known)
      })
    }
    workspace.addChangeListener(onChange)

    const conflicts = new StackConflicts()
    /** Who wrote each stack last, from the others' edits (conflict notices). */
    const authors = new Map<string, number | null>()
    const blocks = yBlocks(session.ydoc)
    const onRemote = (events: Y.YEvent<Y.AbstractType<unknown>>[], transaction: Y.Transaction) => {
      const stacks = blocks.get(workspaceKey)
      const mine = events.filter((event) => event.target === stacks) as Y.YMapEvent<unknown>[]
      if (transaction.origin === BLOCKLY_ORIGIN) {
        for (const event of mine) conflicts.wrote(event)
        return
      }
      const replaced = events.some(
        (event) =>
          event.target === blocks && (event as Y.YMapEvent<unknown>).keysChanged.has(workspaceKey),
      )
      if (!replaced && mine.length === 0) return
      if (!transaction.local) {
        for (const event of mine) {
          for (const [stack, change] of event.changes.keys) {
            authors.set(stack, change.action === 'delete' ? null : entryWriter(event.target, stack))
          }
          for (const { stack, client } of conflicts.lost(event)) notifyConflict(stack, client)
        }
      }
      // Observers run inside the transaction's cleanup: write back once it is over.
      queueMicrotask(sync)
    }
    const notifyConflict = (stack: string, client: number | null) => {
      const strings = tRef.current
      const name =
        (client !== null ? session.presence?.userOf(client)?.name : null) ??
        strings('collab.conflict.someone')
      toast.warning(strings('collab.conflict.title', { name }), {
        id: `conflict-${stack}`,
        description: strings('collab.conflict.text', { name }),
        action: {
          label: strings('collab.conflict.show'),
          onClick: () => {
            const block = workspace.getBlockById(stack)
            if (!block) return
            workspace.centerOnBlock(stack)
            flash(block as Blockly.BlockSvg)
          },
        },
      })
      setTimeout(() => {
        const block = workspace.getBlockById(stack)
        if (block) flash(block as Blockly.BlockSvg)
      }, 0)
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
      clearTimeout(retry)
      blocks.unobserveDeep(onRemote)
      variables.unobserveDeep(onVariables)
      session.presence?.set({ block: null })
      saveToProject(session, workspaceKey, workspace, known)
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

  // What a level adds or changes (J9), lit until the panel closes.
  const marks = useEditor((s) => s.marks)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `doc` changes when stacks are reloaded (their elements are new)
  useEffect(() => {
    const workspace = workspaceRef.current
    if (!workspace) return
    const lit: SVGElement[] = []
    for (const [id, kind] of Object.entries(marks)) {
      const block = workspace.getBlockById(id)
      if (!(block instanceof Blockly.BlockSvg)) continue
      const root = block.getSvgRoot()
      root.classList.add(kind === 'added' ? 'rx-new-added' : 'rx-new-changed')
      lit.push(root)
    }
    return () => {
      for (const root of lit) root.classList.remove('rx-new-added', 'rx-new-changed')
    }
  }, [marks, doc])

  // The tour or "what's new" asked to show a block: its stack is scrolled into view.
  const reveal = useEditor((s) => s.reveal)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `doc` changes when the block may have arrived
  useEffect(() => {
    const workspace = workspaceRef.current
    if (!workspace || !reveal) return
    const block = workspace.getBlockById(reveal)
    if (!(block instanceof Blockly.BlockSvg)) return
    const root = block.getRootBlock() as Blockly.BlockSvg
    const bounds = root.getBoundingRectangle()
    // The top of the stack, and the block itself, when the stack is taller than the view.
    workspace.scrollBoundsIntoView(bounds, 24)
    if (root !== block) workspace.scrollBoundsIntoView(block.getBoundingRectangle(), 24)
    useEditor.getState().set({ reveal: null })
  }, [reveal, doc])

  // The others' selected blocks on this workspace, in their colour (SPEC § 4.9).
  const peers = usePeers()
  const peersHere = useMemo(
    () =>
      peers.filter(
        (peer) => peer.view?.tab === 'blocks' && peer.view.screen === workspaceKey && peer.block,
      ),
    [peers, workspaceKey],
  )
  useEffect(() => {
    const workspace = workspaceRef.current
    if (!workspace || doc === null) return
    const marked: SVGElement[] = []
    for (const peer of peersHere) {
      const block = peer.block ? workspace.getBlockById(peer.block) : null
      if (!(block instanceof Blockly.BlockSvg)) continue
      const root = block.getSvgRoot()
      root.classList.add('rx-peer-block')
      root.style.setProperty('--peer', peer.color)
      root.setAttribute('data-peer', peer.user.name)
      marked.push(root)
    }
    return () => {
      for (const root of marked) {
        root.classList.remove('rx-peer-block')
        root.style.removeProperty('--peer')
        root.removeAttribute('data-peer')
      }
    }
  }, [peersHere, doc])

  return (
    <div className="relative size-full">
      <section
        ref={host}
        className="size-full"
        aria-label={label}
        data-testid="blockly-workspace"
      />
      <PeerBlockLabels workspace={workspaceRef} peers={peersHere} />
    </div>
  )
}

/** The names of the others next to the block they selected, following scroll and zoom. */
function PeerBlockLabels({
  workspace,
  peers,
}: {
  workspace: React.RefObject<Blockly.WorkspaceSvg | null>
  peers: Peer[]
}) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  const [labels, setLabels] = useState<{ peer: Peer; left: number; top: number }[]>([])
  useEffect(() => {
    if (peers.length === 0) {
      setLabels([])
      return
    }
    let frame = 0
    let last = ''
    const loop = () => {
      const area = ref.current?.getBoundingClientRect()
      const next = area
        ? peers.flatMap((peer) => {
            const block = peer.block ? workspace.current?.getBlockById(peer.block) : null
            if (!(block instanceof Blockly.BlockSvg)) return []
            const box = block.getSvgRoot().getBoundingClientRect()
            const visible =
              box.bottom > area.top &&
              box.top < area.bottom &&
              box.right > area.left &&
              box.left < area.right
            return visible
              ? [{ peer, left: box.right - area.left + 6, top: box.top - area.top }]
              : []
          })
        : []
      const key = JSON.stringify(next.map((label) => [label.peer.clientId, label.left, label.top]))
      if (key !== last) {
        last = key
        setLabels(next)
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [peers, workspace])
  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 overflow-hidden">
      {labels.map(({ peer, left, top }) => (
        <span
          key={peer.clientId}
          style={{ ...peerStyle(peer.color), left, top }}
          className="absolute flex h-5 items-center rounded-md bg-(--peer) px-1.5 text-[11px] font-semibold whitespace-nowrap text-white shadow-1"
          title={t('collab.presence.onBlock', { name: peer.user.name })}
          data-testid="peer-block-label"
        >
          {peer.user.name}
        </span>
      ))}
    </div>
  )
}

/** Draws attention to a stack (a conflict on it). */
function flash(block: Blockly.BlockSvg) {
  const root = block.getSvgRoot()
  root.classList.remove('rx-flash')
  // Restart the animation.
  void root.getBoundingClientRect()
  root.classList.add('rx-flash')
  setTimeout(() => root.classList.remove('rx-flash'), 2400)
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
