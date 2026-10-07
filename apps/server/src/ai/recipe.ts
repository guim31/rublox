import type { AppSpec, ComponentSpec } from '@rublox/templates'
import type { CreateAnswer } from './prompts.ts'

/** Turns the model's flat answer into a recipe, or lists what cannot be read. */
export function answerToSpec(answer: CreateAnswer): { spec: AppSpec | null; issues: string[] } {
  const issues: string[] = []
  const json = <T>(text: string, path: string, fallback: T): T => {
    try {
      return text.trim() ? (JSON.parse(text) as T) : fallback
    } catch {
      issues.push(`${path}: not valid JSON`)
      return fallback
    }
  }
  const screens = answer.screens.map((screen, index) => {
    const path = `screens.${index}`
    const nodes = new Map<string, ComponentSpec & { parent: string }>()
    for (const component of screen.components) {
      if (nodes.has(component.name)) {
        issues.push(`${path}: two components are named "${component.name}"`)
        continue
      }
      nodes.set(component.name, {
        type: component.type,
        name: component.name,
        props: json<Record<string, unknown>>(
          component.propsJson,
          `${path}.${component.name}.propsJson`,
          {},
        ),
        parent: component.parent,
      })
    }
    const roots: ComponentSpec[] = []
    for (const node of nodes.values()) {
      const parent = node.parent ? nodes.get(node.parent) : undefined
      if (node.parent && !parent) {
        issues.push(`${path}: "${node.name}" sits in "${node.parent}", which does not exist`)
        continue
      }
      if (parent) {
        parent.children ??= []
        parent.children.push(node)
      } else roots.push(node)
    }
    // A component reachable from no root sits in a loop of parents.
    const reached = new Set<string>()
    const visit = (node: ComponentSpec) => {
      reached.add(node.name as string)
      for (const child of node.children ?? []) visit(child)
    }
    roots.forEach(visit)
    for (const name of nodes.keys()) {
      if (!reached.has(name)) issues.push(`${path}: "${name}" is inside itself`)
    }
    const strip = (node: ComponentSpec & { parent?: string }): ComponentSpec => {
      const { parent: _parent, ...rest } = node
      return { ...rest, ...(rest.children ? { children: rest.children.map(strip) } : {}) }
    }
    return {
      name: screen.name,
      props: json<Record<string, unknown>>(screen.propsJson, `${path}.propsJson`, {}),
      components: roots.map(strip),
      blocks: json<AppSpec['appBlocks']>(screen.blocksJson, `${path}.blocksJson`, []),
    }
  })
  const spec: AppSpec = {
    name: answer.name,
    description: answer.summary.slice(0, 500),
    navigation: answer.navigation,
    ...(/^#[0-9a-f]{6}$/i.test(answer.primaryColor)
      ? { theme: { primary: answer.primaryColor } }
      : {}),
    variables: answer.variables.map((variable, index) => ({
      name: variable.name,
      kind: variable.kind,
      initial: json<unknown>(variable.initialJson, `variables.${index}.initialJson`, undefined),
    })),
    screens,
    appBlocks: json<AppSpec['appBlocks']>(answer.appBlocksJson, 'appBlocksJson', []),
  }
  return issues.length ? { spec: null, issues } : { spec, issues }
}
