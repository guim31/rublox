import type { BlocklyJson, ProjectDoc, WorkspaceKey } from '@rublox/schema'

/** A block found in a saved stack, with the types of the blocks around it (nearest first). */
export type FoundBlock = {
  workspace: WorkspaceKey
  block: BlocklyJson
  /** Types of the enclosing blocks, from the nearest to the top block. */
  ancestors: string[]
  /** The stack's top block is enabled (a disabled stack produces no code). */
  enabled: boolean
}

type Connection = { block?: BlocklyJson; shadow?: BlocklyJson }

function children(block: BlocklyJson): { child: BlocklyJson; enclosing: boolean }[] {
  const result: { child: BlocklyJson; enclosing: boolean }[] = []
  const inputs = (block.inputs ?? {}) as Record<string, Connection>
  for (const connection of Object.values(inputs)) {
    const child = connection.block ?? connection.shadow
    if (child) result.push({ child, enclosing: true })
  }
  const next = (block.next as Connection | undefined)?.block
  // The next block follows: it is not inside this one.
  if (next) result.push({ child: next, enclosing: false })
  return result
}

/** Every block of a project (or of one workspace), with what encloses it. */
export function allBlocks(doc: ProjectDoc, only?: WorkspaceKey): FoundBlock[] {
  const found: FoundBlock[] = []
  for (const [workspace, stacks] of Object.entries(doc.blocks)) {
    if (only && workspace !== only) continue
    for (const top of Object.values(stacks)) {
      const enabled = top.enabled !== false
      const visit = (block: BlocklyJson, ancestors: string[]) => {
        found.push({ workspace, block, ancestors, enabled })
        for (const { child, enclosing } of children(block)) {
          visit(child, enclosing ? [block.type, ...ancestors] : ancestors)
        }
      }
      visit(top, [])
    }
  }
  return found
}

/**
 * Whether `ancestors` contains `path` in order (nearest first, not necessarily adjacent):
 * `['rx_Text_set', 'rx_Button_on_click']` means "in a Text setter, itself in a click handler".
 */
export function isInside(ancestors: string[], path: string[]): boolean {
  let at = 0
  for (const wanted of path) {
    const index = ancestors.indexOf(wanted, at)
    if (index < 0) return false
    at = index + 1
  }
  return true
}

/** Number of real blocks of a project (shadows excluded): "with N blocks or fewer". */
export function countBlocks(doc: ProjectDoc): number {
  let count = 0
  for (const stacks of Object.values(doc.blocks)) {
    for (const top of Object.values(stacks)) {
      const visit = (block: BlocklyJson) => {
        count += 1
        const inputs = (block.inputs ?? {}) as Record<string, Connection>
        for (const connection of Object.values(inputs))
          if (connection.block) visit(connection.block)
        const next = (block.next as Connection | undefined)?.block
        if (next) visit(next)
      }
      visit(top)
    }
  }
  return count
}
