import { APP_WORKSPACE, type BlocklyJson, type ProjectDoc, type WorkspaceKey } from '@rublox/schema'

/** Screens, components and blocks of a project (the proposal of "Create with AI"). */
export function countProject(doc: ProjectDoc) {
  let blocks = 0
  const visit = (block: BlocklyJson) => {
    blocks += 1
    const inputs = (block.inputs ?? {}) as Record<string, { block?: BlocklyJson }>
    for (const connection of Object.values(inputs)) if (connection.block) visit(connection.block)
    const next = (block.next as { block?: BlocklyJson } | undefined)?.block
    if (next) visit(next)
  }
  for (const stacks of Object.values(doc.blocks))
    for (const top of Object.values(stacks)) visit(top)
  const components = Object.values(doc.screens).reduce(
    (total, screen) => total + Object.keys(screen.components).length - 1,
    0,
  )
  return { screens: doc.screenOrder.length, components, blocks }
}

/** Whether every stack of every workspace loads into Blockly and generates code. */
export async function loadsInBlockly(doc: ProjectDoc): Promise<boolean> {
  const blocks = await import('@rublox/blocks')
  try {
    blocks.setupBlocks(doc.meta.locale)
    for (const key of [APP_WORKSPACE, ...doc.screenOrder]) {
      const stacks = doc.blocks[key] ?? {}
      const workspace = blocks.headlessWorkspace(
        stacks,
        blocks.contextFromDoc(doc, key),
        blocks.projectVariables(doc),
      )
      const loaded = workspace.getTopBlocks(false).length
      workspace.dispose()
      if (loaded !== Object.keys(stacks).length) return false
    }
    blocks.generateProjectCode(doc)
    return true
  } catch {
    return false
  }
}

/**
 * A block or a stack as the assistant reads it: Blockly JSON where the ids of components,
 * screens and variables are replaced by their names, without positions.
 */
export function withNames(
  json: BlocklyJson,
  doc: ProjectDoc,
  workspace: WorkspaceKey,
): BlocklyJson {
  const screen = workspace === APP_WORKSPACE ? undefined : doc.screens[workspace]
  const variables = new Map(
    [...doc.variables.app, ...doc.variables.stored, ...doc.variables.shared].map((v) => [
      v.id,
      v.name,
    ]),
  )
  const visit = (block: BlocklyJson): BlocklyJson => {
    const { x: _x, y: _y, ...rest } = block as BlocklyJson & { x?: number; y?: number }
    const copy: BlocklyJson = { ...rest }
    if (copy.fields) {
      const fields: Record<string, unknown> = { ...(copy.fields as Record<string, unknown>) }
      for (const [key, value] of Object.entries(fields)) {
        if (
          typeof value === 'string' &&
          screen?.components[value] &&
          (key === 'COMPONENT' || key === 'FILTER' || /^ARG\d+$/.test(key))
        ) {
          fields[key] = screen.components[value]?.name
        }
        if (key === 'SCREEN' && typeof value === 'string' && doc.screens[value]) {
          fields[key] = doc.screens[value]?.name
        }
        if (key === 'VAR' && value && typeof value === 'object') {
          const id = (value as { id?: string }).id ?? ''
          fields[key] = variables.get(id) ?? id
        }
      }
      copy.fields = fields
    }
    if (copy.inputs) {
      const inputs: Record<string, unknown> = {}
      for (const [name, connection] of Object.entries(
        copy.inputs as Record<string, { block?: BlocklyJson; shadow?: BlocklyJson }>,
      )) {
        const child = connection.block ?? connection.shadow
        inputs[name] = child ? { block: visit(child) } : {}
      }
      copy.inputs = inputs
    }
    const next = (copy.next as { block?: BlocklyJson } | undefined)?.block
    if (next) copy.next = { block: visit(next) }
    return copy
  }
  return visit(json)
}

/** A screen for the assistant: its components (as a tree) and every stack of blocks. */
export function describeScreen(doc: ProjectDoc, screenId: string): string {
  const screen = doc.screens[screenId]
  if (!screen) return ''
  const lines: string[] = [`Screen ${screen.name}. Components:`]
  const visit = (id: string, depth: number) => {
    const node = screen.components[id]
    if (!node) return
    if (id !== screen.rootId) {
      lines.push(`${'  '.repeat(depth)}- ${node.name} (${node.type}) ${JSON.stringify(node.props)}`)
    }
    for (const child of node.children ?? []) visit(child, id === screen.rootId ? depth : depth + 1)
  }
  visit(screen.rootId, 0)
  for (const id of screen.nonVisual) {
    const node = screen.components[id]
    if (node) lines.push(`- ${node.name} (${node.type}, invisible) ${JSON.stringify(node.props)}`)
  }
  const stacks = Object.values(doc.blocks[screenId] ?? {}).map((stack) =>
    withNames(stack, doc, screenId),
  )
  lines.push(`Other screens: ${doc.screenOrder.map((id) => doc.screens[id]?.name).join(', ')}`)
  const variables = [...doc.variables.app, ...doc.variables.stored].map((v) => v.name)
  if (variables.length) lines.push(`Variables: ${variables.join(', ')}`)
  lines.push('Blocks (JSON, one entry per stack):')
  lines.push(JSON.stringify(stacks))
  const app = Object.values(doc.blocks[APP_WORKSPACE] ?? {})
  if (app.length) {
    lines.push('Blocks of the app workspace (app start, shared functions):')
    lines.push(JSON.stringify(app.map((stack) => withNames(stack, doc, APP_WORKSPACE))))
  }
  return truncate(lines.join('\n'))
}

/** At most what the server accepts (60 000 characters). */
export function truncate(text: string, max = 58_000): string {
  return text.length > max ? `${text.slice(0, max)}\n…` : text
}
