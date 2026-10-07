import type { BlocklyJson, ProjectDoc, WorkspaceKey } from '@rublox/schema'
import { allBlocks } from './blocks.ts'

/** A block that a level adds, or changes, compared with the level before (J9). */
export type ChangedBlock = {
  id: string
  workspace: WorkspaceKey
  type: string
  status: 'added' | 'changed'
  /** The top block of its stack. */
  stack: string
}

/** A component that a level adds (J9). */
export type AddedComponent = { id: string; screen: string; type: string; name: string }

export type LevelChanges = { blocks: ChangedBlock[]; components: AddedComponent[] }

/**
 * What a block says by itself: its type, fields and extra state. Comments, position and the
 * blocks it holds are left out: a block that gains a neighbour is not "changed".
 */
function signature(block: BlocklyJson): string {
  return JSON.stringify([block.type, block.fields ?? {}, block.extraState ?? null])
}

/**
 * What is new in `after` compared with `before`, matched by id: both documents are built from
 * recipes whose shared blocks and components keep their ids (`buildProject(…, { stableIds })`).
 */
export function levelChanges(before: ProjectDoc, after: ProjectDoc): LevelChanges {
  const previous = new Map(
    allBlocks(before)
      .filter(({ block }) => typeof block.id === 'string')
      .map(({ block }) => [block.id as string, signature(block)]),
  )
  const blocks: ChangedBlock[] = []
  for (const { workspace, block, ancestorIds } of allBlocks(after)) {
    if (typeof block.id !== 'string') continue
    const old = previous.get(block.id)
    if (old === signature(block)) continue
    blocks.push({
      id: block.id,
      workspace,
      type: block.type,
      status: old === undefined ? 'added' : 'changed',
      stack: ancestorIds.at(-1) ?? block.id,
    })
  }
  const components: AddedComponent[] = []
  for (const [screenId, screen] of Object.entries(after.screens)) {
    const old = before.screens[screenId]
    for (const [id, node] of Object.entries(screen.components)) {
      if (id === screen.rootId || old?.components[id]) continue
      components.push({ id, screen: screenId, type: node.type, name: node.name })
    }
  }
  return { blocks, components }
}
