import {
  createComponent,
  createProject,
  getComponentDef,
  isLocalized,
  SCREEN_TYPE,
  stripDefaults,
} from '@rublox/catalog'
import {
  APP_WORKSPACE,
  type BlocklyJson,
  type ComponentNode,
  type Locale,
  newId,
  type ProjectDoc,
  projectDocSchema,
  type Screen,
  toValidName,
  type UiMode,
  uniqueName,
} from '@rublox/schema'
import { componentBlock, isKnownBlockType, propertyKeysOf } from './blocks.ts'
import {
  type AppSpec,
  appSpecSchema,
  type ComponentSpec,
  type ParsedAppSpec,
  type ScreenSpec,
} from './spec.ts'

/** Something a recipe asks that cannot be built: where, and why (English, for the AI). */
export type SpecIssue = { path: string; message: string }

export class SpecError extends Error {
  override name = 'SpecError'
  constructor(readonly issues: SpecIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'))
  }
}

export type BuildOptions = {
  locale: Locale
  /** Overrides the mode of the recipe. */
  mode?: UiMode
  /** Overrides the name of the recipe. */
  name?: string
  now?: Date
  /**
   * Ids derived from the recipe instead of random ones (J9, `@rublox/explore`): screens
   * `s-<key>`, components `c-<screen key>-<key>`, variables `v-<key>`, and blocks keep the
   * `id` written in the recipe. Two recipes that share keys and block ids build documents whose
   * shared parts have the same ids (levels of an app to take apart).
   */
  stableIds?: boolean
}

/** Resolves `{ fr, en }` values anywhere in a recipe. */
export function localize<T>(value: T, locale: Locale): T {
  if (Array.isArray(value)) return value.map((item) => localize(item, locale)) as T
  if (value && typeof value === 'object') {
    const keys = Object.keys(value)
    if (keys.length === 2 && isLocalized(value)) return (value as Record<Locale, T>)[locale]
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, localize(item, locale)]),
    ) as T
  }
  return value
}

type ScreenRefs = {
  id: string
  /** The screen's key in the recipe (stable ids). */
  key: string
  /** Component id by key and by name. */
  components: Map<string, string>
  screen: Screen
}

const STACK_GAP = 220

/**
 * Builds a project from a recipe. Returns the issues instead of a document when the recipe
 * asks for something unknown (a component type, a property, a block type, a name that is
 * not defined…): the AI is asked to fix them, a template test fails on them.
 */
export function buildProject(
  input: AppSpec,
  options: BuildOptions,
): { doc: ProjectDoc; issues: [] } | { doc: null; issues: SpecIssue[] } {
  const parsed = appSpecSchema.safeParse(input)
  if (!parsed.success) {
    return {
      doc: null,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.') || '(recipe)',
        message: issue.message,
      })),
    }
  }
  const spec = localize(parsed.data, options.locale) as ParsedAppSpec
  const builder = new Builder(spec, options)
  const doc = builder.build()
  if (builder.issues.length) return { doc: null, issues: builder.issues }
  const valid = projectDocSchema.safeParse(doc)
  if (!valid.success) {
    return {
      doc: null,
      issues: valid.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    }
  }
  return { doc: valid.data, issues: [] }
}

/** `buildProject`, throwing a `SpecError` on issues. */
export function buildProjectOrThrow(input: AppSpec, options: BuildOptions): ProjectDoc {
  const result = buildProject(input, options)
  if (!result.doc) throw new SpecError(result.issues)
  return result.doc
}

class Builder {
  readonly issues: SpecIssue[] = []
  private readonly screens = new Map<string, ScreenRefs>()
  private readonly screenIds = new Map<string, string>()
  private readonly variables = new Map<string, string>()
  private doc!: ProjectDoc

  constructor(
    private readonly spec: ParsedAppSpec,
    private readonly options: BuildOptions,
  ) {}

  private issue(path: string, message: string) {
    this.issues.push({ path, message })
  }

  build(): ProjectDoc {
    const { spec, options } = this
    const doc = createProject({
      name: (options.name ?? (spec.name as string)).slice(0, 80),
      locale: options.locale,
      mode: options.mode ?? spec.mode ?? 'junior',
      now: options.now,
    })
    this.doc = doc
    if (spec.description) doc.meta.description = (spec.description as string).slice(0, 500)
    if (spec.theme) doc.settings.theme = { ...doc.settings.theme, ...spec.theme }

    // Screens first: blocks may open any of them.
    const firstId = doc.screenOrder[0] as string
    doc.screens = {}
    doc.screenOrder = []
    const takenScreens: string[] = []
    spec.screens.forEach((screenSpec, index) => {
      const name = freeName(screenSpec.name as string, takenScreens, 'Screen')
      const stable = this.options.stableIds ? `s-${screenSpec.key ?? index}` : null
      const id = stable ?? (index === 0 ? firstId : newId())
      takenScreens.push(name)
      const rootId = stable ? `${stable}-root` : newId()
      const root: ComponentNode = { type: SCREEN_TYPE, name, props: {}, children: [] }
      const screen: Screen = { name, rootId, components: { [rootId]: root }, nonVisual: [] }
      doc.screens[id] = screen
      doc.screenOrder.push(id)
      this.screenIds.set(screenSpec.key ?? (screenSpec.name as string), id)
      this.screenIds.set(name, id)
      // The screen itself is a component too (`rx_Screen_on_open`), named by its key or name.
      const components = new Map([[screenSpec.key ?? name, rootId]])
      components.set(name, rootId)
      this.screens.set(id, { id, key: screenSpec.key ?? String(index), components, screen })
    })
    doc.settings.navigation = {
      kind: spec.navigation,
      startScreen: doc.screenOrder[0] ?? firstId,
    }

    for (const variable of spec.variables) {
      const name = freeName(variable.name as string, [...this.variables.keys()], 'variable')
      const id = this.options.stableIds ? `v-${variable.key ?? name}` : newId()
      doc.variables[variable.kind].push({
        id,
        name,
        ...(variable.initial !== undefined ? { initial: variable.initial as never } : {}),
      })
      this.variables.set(variable.key ?? (variable.name as string), id)
      this.variables.set(name, id)
    }

    spec.screens.forEach((screenSpec, index) => {
      const refs = this.screens.get(doc.screenOrder[index] as string) as ScreenRefs
      this.fillScreen(refs, screenSpec, `screens.${index}`)
    })

    if (spec.navigation !== 'stack') {
      doc.settings.navigation.items = spec.screens.map((screenSpec, index) => ({
        screen: doc.screenOrder[index] as string,
        ...(screenSpec.navIcon ? { icon: screenSpec.navIcon } : {}),
        label: (screenSpec.navLabel as string | undefined) ?? (screenSpec.name as string),
      }))
    }

    spec.screens.forEach((screenSpec, index) => {
      const id = doc.screenOrder[index] as string
      this.fillBlocks(id, screenSpec.blocks, `screens.${index}.blocks`, this.screens.get(id))
    })
    this.fillBlocks(APP_WORKSPACE, spec.appBlocks, 'appBlocks', undefined)
    return doc
  }

  private fillScreen(refs: ScreenRefs, spec: ScreenSpec, path: string) {
    const root = refs.screen.components[refs.screen.rootId] as ComponentNode
    if (spec.props) root.props = this.props(SCREEN_TYPE, spec.props, `${path}.props`)
    spec.components.forEach((child, index) => {
      this.addComponent(refs, child, refs.screen.rootId, SCREEN_TYPE, `${path}.components.${index}`)
    })
  }

  private addComponent(
    refs: ScreenRefs,
    spec: ComponentSpec,
    parentId: string,
    parentType: string,
    path: string,
  ) {
    const def = getComponentDef(spec.type)
    if (!def?.palette) {
      this.issue(`${path}.type`, `unknown component type "${spec.type}"`)
      return
    }
    const parentDef = getComponentDef(parentType)
    if (def.visible) {
      if (parentDef?.accepts && !parentDef.accepts.includes(def.type)) {
        this.issue(path, `a ${parentType} cannot contain a ${def.type}`)
        return
      }
      if (def.parents && !def.parents.includes(parentType)) {
        this.issue(path, `a ${def.type} must be inside a ${def.parents.join(' or ')}`)
        return
      }
    }
    const taken = Object.values(refs.screen.components).map((node) => node.name)
    const node = createComponent(def.type, this.options.locale, taken)
    if (spec.name) {
      node.name = freeName(spec.name as string, taken, node.name)
    }
    node.props = this.props(def.type, { ...node.props, ...spec.props }, `${path}.props`)
    const id = this.options.stableIds ? `c-${refs.key}-${spec.key ?? node.name}` : newId()
    refs.screen.components[id] = node
    refs.components.set(spec.key ?? (spec.name as string | undefined) ?? node.name, id)
    refs.components.set(node.name, id)
    if (def.visible) {
      refs.screen.components[parentId]?.children?.push(id)
    } else {
      refs.screen.nonVisual.push(id)
    }
    if (spec.children?.length) {
      if (!def.container) {
        this.issue(`${path}.children`, `a ${def.type} cannot contain components`)
        return
      }
      spec.children.forEach((child, index) => {
        this.addComponent(refs, child, id, def.type, `${path}.children.${index}`)
      })
    }
  }

  private props(type: string, props: Record<string, unknown>, path: string) {
    const def = getComponentDef(type)
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(props)) {
      const prop = def?.props[key]
      if (!prop || prop.state) {
        this.issue(`${path}.${key}`, `${type} has no property "${key}"`)
        continue
      }
      const coerced = prop.coerce(value)
      if (coerced === undefined) {
        this.issue(`${path}.${key}`, `invalid value ${JSON.stringify(value)} for ${type}.${key}`)
        continue
      }
      result[key] = coerced
    }
    return stripDefaults(type, result)
  }

  private fillBlocks(
    workspace: string,
    stacks: BlocklyJson[],
    path: string,
    refs: ScreenRefs | undefined,
  ) {
    if (!stacks.length) return
    const saved: Record<string, BlocklyJson> = {}
    let y = 40
    stacks.forEach((stack, index) => {
      const block = this.block(stack, refs, `${path}.${index}`, null)
      if (!block) return
      const id = typeof block.id === 'string' ? block.id : newId()
      block.id = id
      if (typeof block.x !== 'number' || typeof block.y !== 'number') {
        block.x = 40
        block.y = y
      }
      y = Math.max(y, block.y as number) + STACK_GAP + 60 * depth(block)
      saved[id] = block
    })
    this.doc.blocks[workspace] = saved
  }

  /** A checked copy of a block, with names turned into ids. */
  private block(
    input: BlocklyJson,
    refs: ScreenRefs | undefined,
    path: string,
    event: string | null,
  ): BlocklyJson | null {
    if (!input || typeof input !== 'object' || typeof input.type !== 'string') {
      this.issue(path, 'not a block')
      return null
    }
    const { id: given, ...rest } = input as BlocklyJson & { id?: unknown }
    const block: BlocklyJson = structuredClone(rest)
    if (this.options.stableIds && typeof given === 'string') block.id = given
    if (!isKnownBlockType(block.type)) {
      this.issue(`${path}.type`, `unknown block type "${block.type}"`)
      return null
    }
    const fields = (block.fields ?? {}) as Record<string, unknown>
    const component = componentBlock(block.type)
    const here = component?.kind === 'event' ? block.type : event
    if (component) {
      if (!refs) {
        this.issue(path, `"${block.type}" is not available in the app workspace`)
        return null
      }
      fields.COMPONENT = this.componentRef(refs, fields.COMPONENT, component.def.type, `${path}`)
      if (component.kind === 'get' || component.kind === 'set') {
        const keys = propertyKeysOf(component.def, component.kind)
        if (typeof fields.PROP !== 'string' || !keys.includes(fields.PROP)) {
          this.issue(
            `${path}.fields.PROP`,
            `"${String(fields.PROP)}" is not a property ${component.kind === 'get' ? 'readable' : 'writable'} on ${component.def.type} (use one of: ${keys.join(', ')})`,
          )
        }
      }
      if (component.kind === 'event') {
        const filter = component.def.events[component.name]?.filter
        if (filter) {
          const value = fields.FILTER ?? '*'
          if (value === '*') fields.FILTER = '*'
          else if (filter.kind === 'component') {
            fields.FILTER = this.componentRef(refs, value, filter.componentType, `${path}.FILTER`)
          } else if (!filter.values.includes(String(value))) {
            this.issue(`${path}.fields.FILTER`, `use "*" or one of: ${filter.values.join(', ')}`)
          }
        }
      }
      if (component.kind === 'method') {
        const args = Object.values(component.def.methods[component.name]?.args ?? {})
        args.forEach((arg, index) => {
          if (arg.kind === 'component') {
            fields[`ARG${index}`] = this.componentRef(
              refs,
              fields[`ARG${index}`],
              arg.componentType ?? component.def.type,
              `${path}.ARG${index}`,
            )
          }
        })
      }
    }
    if (block.type === 'rx_screen_open') {
      const id = this.screenIds.get(String(fields.SCREEN))
      if (id) fields.SCREEN = id
      else this.issue(`${path}.fields.SCREEN`, `no screen named "${String(fields.SCREEN)}"`)
    }
    if (block.type === 'rx_event_value') {
      const match = here ? componentBlock(here) : undefined
      const args =
        match?.kind === 'event' ? Object.keys(match.def.events[match.name]?.args ?? {}) : []
      if (!args.includes(String(fields.ARG))) {
        this.issue(
          `${path}.fields.ARG`,
          args.length
            ? `use one of: ${args.join(', ')}`
            : 'rx_event_value only works inside an event that carries values',
        )
      }
    }
    if ('VAR' in fields) fields.VAR = { id: this.variableRef(fields.VAR) }
    if (Object.keys(fields).length) block.fields = fields
    const inputs = (block.inputs ?? {}) as Record<
      string,
      { block?: BlocklyJson; shadow?: BlocklyJson }
    >
    for (const [name, connection] of Object.entries(inputs)) {
      for (const slot of ['block', 'shadow'] as const) {
        const child = connection?.[slot]
        if (!child) continue
        const built = this.block(child, refs, `${path}.inputs.${name}`, here)
        if (built) connection[slot] = built
        else delete connection[slot]
      }
    }
    const next = (block.next as { block?: BlocklyJson } | undefined)?.block
    if (next) {
      const built = this.block(next, refs, `${path}.next`, event)
      block.next = built ? { block: built } : undefined
      if (!built) delete block.next
    }
    return block
  }

  private componentRef(refs: ScreenRefs, value: unknown, type: string, path: string): string {
    const id = typeof value === 'string' ? refs.components.get(value) : undefined
    const node = id ? refs.screen.components[id] : undefined
    if (!id || !node) {
      this.issue(
        `${path}.fields`,
        `no component named "${String(value)}" on screen ${refs.screen.name}`,
      )
      return String(value)
    }
    if (node.type !== type) {
      this.issue(`${path}.fields`, `"${String(value)}" is a ${node.type}, not a ${type}`)
    }
    return id
  }

  /** A variable by key or name; an unknown name becomes a new app variable (loop counters). */
  private variableRef(value: unknown): string {
    const name =
      typeof value === 'string'
        ? value
        : value && typeof value === 'object'
          ? String(
              (value as { name?: unknown; id?: unknown }).name ??
                (value as { id?: unknown }).id ??
                '',
            )
          : ''
    const known = this.variables.get(name)
    if (known) return known
    const valid = freeName(name, [...this.variables.keys()], 'variable')
    const id = this.options.stableIds ? `v-${valid}` : newId()
    this.doc.variables.app.push({ id, name: valid })
    this.variables.set(name, id)
    this.variables.set(valid, id)
    return id
  }
}

/** `name` made valid, or the first free variant of it. */
function freeName(name: string, taken: Iterable<string>, fallback: string): string {
  const valid = toValidName(name, fallback)
  const used = new Set(taken)
  return used.has(valid) ? uniqueName(valid, used) : valid
}

/** Number of blocks of a stack, to space stacks out. */
function depth(block: BlocklyJson): number {
  let count = 1
  const inputs = (block.inputs ?? {}) as Record<string, { block?: BlocklyJson }>
  for (const connection of Object.values(inputs)) {
    if (connection.block) count += depth(connection.block) - 0.5
  }
  const next = (block.next as { block?: BlocklyJson } | undefined)?.block
  if (next) count += depth(next)
  return count
}
