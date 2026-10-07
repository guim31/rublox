import { contextOf } from '@rublox/blocks'
import type { BlocklyJson } from '@rublox/schema'
import * as Blockly from 'blockly/core'
import { useAiPanel } from '../../ai/store.ts'
import { openHelp } from '../../help/store.ts'
import { aiAllowed } from '../../lib/features.ts'
import { i18next } from '../../lib/i18n.ts'
import { setSlow, useEditor } from '../store.ts'

let registered = false

/**
 * Right-click on a block: a breakpoint for slow motion (SPEC § 4.3), and its help sheet
 * (SPEC § 4.10). Labels are read when the menu opens, so they follow the language.
 */
export function registerBlockMenu(): void {
  if (registered) return
  registered = true
  const registry = Blockly.ContextMenuRegistry.registry
  registry.register({
    id: 'rx_breakpoint',
    scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
    weight: 0,
    displayText: (scope) =>
      useEditor.getState().slow.breakpoints.includes(scope.block?.id ?? '')
        ? i18next.t('slow.removeBreakpoint')
        : i18next.t('slow.addBreakpoint'),
    // Only statements run step by step: a value block cannot stop the app.
    preconditionFn: (scope) =>
      scope.block && !scope.block.isInFlyout && !scope.block.outputConnection
        ? 'enabled'
        : 'hidden',
    callback: (scope) => {
      const id = scope.block?.id
      if (!id) return
      const { breakpoints } = useEditor.getState().slow
      setSlow({
        breakpoints: breakpoints.includes(id)
          ? breakpoints.filter((b) => b !== id)
          : [...breakpoints, id],
        enabled: true,
      })
    },
  })
  registry.register({
    id: 'rx_block_help',
    scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
    weight: 1,
    displayText: () => i18next.t('help.blockHelp'),
    preconditionFn: (scope) => (scope.block ? 'enabled' : 'hidden'),
    callback: (scope) => {
      if (scope.block) openHelp({ kind: 'block', id: scope.block.type })
    },
  })
  // The assistant (J6): only when this account may ask it something (SPEC § 8: no trace
  // without a key).
  for (const [id, target, weight] of [
    ['rx_ai_explain_block', 'block', 2],
    ['rx_ai_explain_stack', 'stack', 3],
  ] as const) {
    registry.register({
      id,
      scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
      weight,
      displayText: () => i18next.t(`ai.explain.${target}`),
      preconditionFn: (scope) => {
        if (!scope.block || scope.block.isInFlyout || !aiAllowed()) return 'hidden'
        // "This stack" only when the block has others around it.
        if (target === 'stack' && scope.block.getRootBlock().getDescendants(false).length < 2) {
          return 'hidden'
        }
        return 'enabled'
      },
      callback: (scope) => {
        const block = scope.block
        if (!block) return
        const source = target === 'stack' ? block.getRootBlock() : block
        const json = Blockly.serialization.blocks.save(source, {
          addNextBlocks: target === 'stack',
          addCoordinates: false,
        }) as BlocklyJson | null
        if (!json) return
        useAiPanel.getState().open({
          kind: 'explain',
          target,
          workspace: contextOf(block.workspace).workspace,
          block: json,
        })
      },
    })
  }
  // Blockly's own "Help" opens a web page: the help panel replaces it.
  if (registry.getItem('blockHelp')) registry.unregister('blockHelp')
}

/** Draws the breakpoints on the blocks of a workspace. */
export function showBreakpoints(workspace: Blockly.WorkspaceSvg, breakpoints: string[]): void {
  for (const block of workspace.getAllBlocks(false)) {
    if (breakpoints.includes(block.id)) block.addClass('rx-breakpoint')
    else block.removeClass('rx-breakpoint')
  }
}
