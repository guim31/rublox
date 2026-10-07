import { getComponentDef, resolveProps } from '@rublox/catalog'
import { format, messages } from '@rublox/i18n'
import {
  APP_WORKSPACE,
  type ComponentId,
  type Locale,
  type ProjectDoc,
  type ScreenId,
  type UiMode,
  type WorkspaceKey,
} from '@rublox/schema'
import { friendlyError, StopSignal } from './errors.ts'
import { FrameClock } from './game/clock.ts'
import { GameInstance } from './game/instance.ts'
import { type Body, isWorldType, type World } from './game/world.ts'

/** A generated module and the block of each of its lines (see `@rublox/blocks`). */
export type ModuleCode = { code: string; lineMap: (string | null)[] }

export type LogLevel = 'log' | 'warn' | 'error'
export type LogEntry = {
  level: LogLevel
  message: string
  /** The block that was running, when it is known. */
  blockId?: string
  workspace?: WorkspaceKey
  time: number
}

export type EngineHost = {
  log(entry: LogEntry): void
  state?(state: { screenId: ScreenId | null; running: boolean }): void
}

export type LoadedModule = {
  run: (api: ModuleApi) => Promise<void> | void
  /** Address the module was loaded from: it appears in stack traces. */
  url: string
  dispose(): void
}

export type ModuleLoader = (code: string) => Promise<LoadedModule>

export type EngineOptions = {
  doc: ProjectDoc
  code: Record<WorkspaceKey, ModuleCode>
  host: EngineHost
  /** Language of the messages the engine writes (the interface language). */
  locale?: Locale
  /** Junior gets plain-language errors only; Studio also sees the JavaScript error. */
  mode?: UiMode
  loadModule?: ModuleLoader
  /** Screen to show first instead of the start screen (the editor's current screen). */
  initialScreen?: ScreenId
  /** Frames of the game scenes (tests drive one by hand). */
  clock?: FrameClock
}

// biome-ignore lint/suspicious/noExplicitAny: generated code passes any value
type Value = any
type Handler = (...args: Value[]) => Promise<void> | void

/** A registered handler, with the filter chosen in its block (`null`: any). */
type HandlerEntry = { fn: Handler; filter: string | null; busy: boolean }

/** What a component proxy designates, for filters and component arguments. */
const TARGET = Symbol('rx.target')
type Target = { componentId: ComponentId; body?: Body }
/** What a generated module receives (SPEC § 6.5). */
export type ModuleApi = {
  components: Record<string, Value>
  app: Record<string, Value>
  stored: Record<string, Value>
  shared: Record<string, Value>
  screens: { open(name: string): void; back(): void }
  ui: {
    alert(message: Value): Promise<void>
    confirm(message: Value): Promise<boolean>
    prompt(message: Value): Promise<string | null>
    toast(message: Value): void
  }
  device: Record<string, Value>
  rx: {
    tick(): Promise<void>
    wait(seconds: Value): Promise<void>
    log(...values: Value[]): void
    step(blockId: string): Promise<void>
  }
}

type Instance = {
  key: number
  screenId: ScreenId
  overrides: Map<ComponentId, Record<string, unknown>>
  handlers: Map<ComponentId, Map<string, HandlerEntry[]>>
  alive: boolean
  /** Game scenes of the screen (J7). */
  game?: GameInstance
  /** Proxy of a scene body (a clone), set when the screen's module runs. */
  proxyOf?: (body: Body) => Value
}

export type Dialog = {
  id: number
  kind: 'alert' | 'confirm' | 'prompt'
  message: string
  resolve: (value: unknown) => void
}

export type Toast = { id: number; message: string }

export type EngineSnapshot = {
  doc: ProjectDoc
  screen: Instance | null
  depth: number
  running: boolean
  dialogs: readonly Dialog[]
  toasts: readonly Toast[]
  version: number
}

/** Default loader: the code becomes a `blob:` module (never `eval`, SPEC § 6.5). */
export const loadBlobModule: ModuleLoader = async (code) => {
  const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))
  const module = await import(/* @vite-ignore */ url)
  return { run: module.default, url, dispose: () => URL.revokeObjectURL(url) }
}

const TICK_BUDGET_MS = 16
const TOAST_MS = 2500

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function now(): number {
  return globalThis.performance?.now() ?? Date.now()
}

/** How a value reads in the console or a message. */
export function display(value: unknown): string {
  if (typeof value === 'string') return value
  if (value === undefined || value === null) return ''
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/**
 * Runs an app: the screens stack, the values the code sets, the handlers it registers. The
 * React side (`PlayerApp`) draws `getSnapshot()` and calls `emit` and `setValue`.
 */
export class Engine {
  private doc: ProjectDoc
  private code: Record<WorkspaceKey, ModuleCode>
  private readonly host: EngineHost
  private readonly locale: Locale
  private readonly mode: UiMode
  private readonly loadModule: ModuleLoader
  private readonly appVars = new Map<string, unknown>()
  private readonly storedVars = new Map<string, unknown>()
  private stack: Instance[] = []
  private running = false
  private generation = 0
  private nextKey = 1
  private lastYield = now()
  private dialogs: Dialog[] = []
  private toasts: Toast[] = []
  private readonly timers = new Set<{
    timer: ReturnType<typeof setTimeout>
    reject: (e: unknown) => void
  }>()
  private readonly modules = new Map<string, Promise<LoadedModule>>()
  private readonly lineMaps = new Map<
    string,
    { workspace: WorkspaceKey; lineMap: (string | null)[] }
  >()
  private readonly listeners = new Set<() => void>()
  private snapshot: EngineSnapshot
  private notifyQueued = false
  private initialScreen?: ScreenId
  private readonly clock: FrameClock
  /**
   * The frame during which a game scene last changed something visible: loops running in
   * that frame give way until the next one.
   */
  private redrawFrame = -1

  constructor(options: EngineOptions) {
    this.doc = options.doc
    this.code = options.code
    this.host = options.host
    this.locale = options.locale ?? options.doc.meta.locale
    this.mode = options.mode ?? options.doc.meta.mode
    this.loadModule = options.loadModule ?? loadBlobModule
    this.initialScreen = options.initialScreen
    this.clock = options.clock ?? new FrameClock()
    this.snapshot = this.makeSnapshot(0)
  }

  // React binding

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): EngineSnapshot => this.snapshot

  private makeSnapshot(version: number): EngineSnapshot {
    return {
      doc: this.doc,
      screen: this.stack.at(-1) ?? null,
      depth: this.stack.length,
      running: this.running,
      dialogs: [...this.dialogs],
      toasts: [...this.toasts],
      version,
    }
  }

  private notify(): void {
    if (this.notifyQueued) return
    this.notifyQueued = true
    queueMicrotask(() => {
      this.notifyQueued = false
      this.snapshot = this.makeSnapshot(this.snapshot.version + 1)
      for (const listener of this.listeners) listener()
      this.host.state?.({
        screenId: this.snapshot.screen?.screenId ?? null,
        running: this.running,
      })
    })
  }

  // Life cycle

  /** Starts the app: app variables, the `app` module, then the start screen. */
  async start(): Promise<void> {
    this.running = true
    this.generation += 1
    this.appVars.clear()
    this.initVariables()
    this.lastYield = now()
    const appRun = this.runModule(APP_WORKSPACE, null)
    const first =
      this.initialScreen && this.doc.screens[this.initialScreen]
        ? this.initialScreen
        : this.doc.settings.navigation.startScreen
    this.initialScreen = undefined
    const screenRun = this.push(first)
    this.notify()
    await Promise.all([appRun, screenRun])
  }

  /** Stops everything: loops end at their next `rx.tick()`, waits and dialogs are cancelled. */
  stop(): void {
    if (!this.running) return
    this.running = false
    this.generation += 1
    for (const instance of this.stack) this.kill(instance)
    this.clock.release()
    for (const entry of this.timers) {
      clearTimeout(entry.timer)
      entry.reject(new StopSignal())
    }
    this.timers.clear()
    for (const dialog of this.dialogs) dialog.resolve(new StopSignal())
    this.dialogs = []
    this.toasts = []
    this.notify()
  }

  /** Restarts from scratch (the "Restart the app" button). */
  async restart(screenId?: ScreenId): Promise<void> {
    this.stop()
    this.stack = []
    this.initialScreen = screenId
    await this.start()
  }

  /**
   * Applies a new version of the project. A design change keeps the state; a change in the
   * blocks of a screen restarts that screen; a change in the `app` blocks restarts the app.
   */
  async update(doc: ProjectDoc, code: Record<WorkspaceKey, ModuleCode>): Promise<void> {
    const previous = this.code
    this.doc = doc
    this.code = code
    this.forgetUnusedModules()
    if (!this.running) {
      this.notify()
      return
    }
    if (previous[APP_WORKSPACE]?.code !== code[APP_WORKSPACE]?.code) {
      await this.restart(this.stack.at(-1)?.screenId)
      return
    }
    if (this.stack.some((instance) => !doc.screens[instance.screenId])) {
      await this.restart()
      return
    }
    this.initVariables()
    for (const instance of this.stack) {
      const screen = doc.screens[instance.screenId]
      if (screen && instance.game) instance.game.sync(screen)
    }
    const restarts: Promise<void>[] = []
    this.stack.forEach((instance, index) => {
      if (previous[instance.screenId]?.code !== code[instance.screenId]?.code) {
        restarts.push(this.restartInstance(index))
      }
    })
    this.notify()
    await Promise.all(restarts)
  }

  dispose(): void {
    this.stop()
    this.clock.dispose()
    this.listeners.clear()
    for (const loaded of this.modules.values())
      loaded.then(
        (m) => m.dispose(),
        () => {},
      )
    this.modules.clear()
  }

  private initVariables(): void {
    for (const variable of this.doc.variables.app) {
      if (!this.appVars.has(variable.name)) this.appVars.set(variable.name, variable.initial ?? 0)
    }
  }

  // Screens

  private screenByName(name: string): ScreenId | undefined {
    if (this.doc.screens[name]) return name
    return this.doc.screenOrder.find((id) => this.doc.screens[id]?.name === name)
  }

  private newInstance(screenId: ScreenId): Instance {
    const instance: Instance = {
      key: this.nextKey++,
      screenId,
      overrides: new Map(),
      handlers: new Map(),
      alive: true,
    }
    const screen = this.doc.screens[screenId]
    if (screen && GameInstance.needed(screen)) {
      instance.game = new GameInstance(
        screen,
        this.doc.meta.locale,
        this.worldHost(instance),
        this.clock,
      )
    }
    return instance
  }

  /** An instance leaves for good: its handlers stop, its game scenes too. */
  private kill(instance: Instance): void {
    instance.alive = false
    instance.game?.dispose()
  }

  private async push(screenId: ScreenId): Promise<void> {
    const instance = this.newInstance(screenId)
    this.stack.at(-1)?.game?.deactivate()
    this.stack.push(instance)
    this.notify()
    await this.runModule(screenId, instance)
    this.fireOpen(instance)
  }

  private async restartInstance(index: number): Promise<void> {
    const old = this.stack[index]
    if (!old) return
    this.kill(old)
    const instance = this.newInstance(old.screenId)
    this.stack[index] = instance
    await this.runModule(instance.screenId, instance)
    if (this.stack.at(-1) === instance) this.fireOpen(instance)
  }

  private fireOpen(instance: Instance): void {
    const rootId = this.doc.screens[instance.screenId]?.rootId
    if (rootId) this.fire(instance, rootId, 'open')
    if (instance.alive) instance.game?.activate()
  }

  openScreen(name: string): void {
    if (!this.running) return
    const screenId = this.screenByName(name)
    if (!screenId) {
      this.log('warn', format(messages[this.locale].runtime.noScreen, { name }))
      return
    }
    void this.push(screenId)
  }

  back(): void {
    if (!this.running || this.stack.length < 2) return
    const instance = this.stack.pop()
    if (instance) this.kill(instance)
    this.notify()
    const top = this.stack.at(-1)
    if (top) this.fireOpen(top)
  }

  // Events from the rendering

  /** A component of the visible screen fired an event (a click…). */
  emit(componentId: ComponentId, event: string): void {
    const instance = this.stack.at(-1)
    if (instance) this.fire(instance, componentId, event)
  }

  /** A value changed by the person using the app (typing in a text input). */
  setValue(componentId: ComponentId, prop: string, value: unknown): void {
    const instance = this.stack.at(-1)
    if (!instance) return
    this.writeProp(instance, componentId, prop, value)
  }

  /**
   * Runs the handlers of an event. `filter` is matched against the filter of each handler
   * (`Pomme.onHit(Panier, …)` only hears about Panier).
   */
  private fire(
    instance: Instance,
    componentId: ComponentId,
    event: string,
    args: unknown[] = [],
    filter?: string,
  ): void {
    if (!this.running || !instance.alive) return
    const entries = instance.handlers.get(componentId)?.get(event)
    if (!entries?.length) return
    const skipIfBusy = this.eventDef(instance, componentId, event)?.skipIfBusy === true
    for (const entry of entries) {
      if (entry.filter !== null && entry.filter !== filter) continue
      if (skipIfBusy && entry.busy) continue
      entry.busy = true
      this.lastYield = now()
      Promise.resolve()
        .then(() => entry.fn(...args))
        .catch((error) => this.report(error))
        .finally(() => {
          entry.busy = false
        })
    }
  }

  private eventDef(instance: Instance, componentId: ComponentId, event: string) {
    const node = this.doc.screens[instance.screenId]?.components[componentId]
    return node ? getComponentDef(node.type)?.events[event] : undefined
  }

  /** How the game scenes of an instance reach its handlers. */
  private worldHost(instance: Instance) {
    return {
      fire: (
        self: Body | null,
        componentId: ComponentId,
        event: string,
        args: unknown[],
        filter?: string,
      ) => {
        const proxy = (value: unknown) =>
          value && typeof value === 'object' && 'key' in value && 'values' in value
            ? instance.proxyOf?.(value as Body)
            : value
        const node = this.doc.screens[instance.screenId]?.components[componentId]
        const clonable = Boolean(node && getComponentDef(node.type)?.clonable)
        const values = args.map(proxy)
        this.fire(
          instance,
          componentId,
          event,
          clonable && self ? [proxy(self), ...values] : values,
          filter,
        )
      },
      listens: (componentId: ComponentId, event: string) =>
        (instance.handlers.get(componentId)?.get(event)?.length ?? 0) > 0,
      redraw: () => {
        this.redrawFrame = this.clock.frames
      },
      warn: (key: 'tooManyClones', values: Record<string, unknown>) =>
        this.log('warn', format(messages[this.locale].runtime.game[key], values)),
    }
  }

  /** The world of a game scene of the visible screen, for its renderer. */
  live(screenKey: number, componentId: ComponentId): World | undefined {
    const instance = this.stack.find((entry) => entry.key === screenKey)
    return instance?.game?.worlds.get(componentId)
  }

  // Values

  private componentValue(instance: Instance, componentId: ComponentId, prop: string): unknown {
    const node = this.doc.screens[instance.screenId]?.components[componentId]
    if (!node) return undefined
    const override = instance.overrides.get(componentId)
    if (override && prop in override) return override[prop]
    return resolveProps(node.type, node.props, this.doc.meta.locale)[prop]
  }

  private writeProp(
    instance: Instance,
    componentId: ComponentId,
    prop: string,
    value: unknown,
  ): void {
    const node = this.doc.screens[instance.screenId]?.components[componentId]
    const def = node && getComponentDef(node.type)
    const propDef = def?.props[prop]
    if (!node || !propDef) return
    const coerced = propDef.coerce(value)
    if (coerced === undefined) {
      this.invalid(node.name, prop, value)
      return
    }
    const current = instance.overrides.get(componentId) ?? {}
    instance.overrides.set(componentId, { ...current, [prop]: coerced })
    if (instance.alive) this.notify()
  }

  // Generated code

  private async runModule(workspace: WorkspaceKey, instance: Instance | null): Promise<void> {
    const code = this.code[workspace]?.code
    if (!code) return
    const generation = this.generation
    try {
      const loaded = await this.load(workspace, code)
      if (generation !== this.generation || (instance && !instance.alive)) return
      await loaded.run(this.api(instance))
    } catch (error) {
      this.report(error)
    }
  }

  private load(workspace: WorkspaceKey, code: string): Promise<LoadedModule> {
    let loaded = this.modules.get(code)
    if (!loaded) {
      loaded = this.loadModule(code)
      this.modules.set(code, loaded)
    }
    const lineMap = this.code[workspace]?.lineMap ?? []
    return loaded.then((module) => {
      this.lineMaps.set(module.url, { workspace, lineMap })
      return module
    })
  }

  private forgetUnusedModules(): void {
    const used = new Set(Object.values(this.code).map((module) => module.code))
    for (const [code, loaded] of this.modules) {
      if (used.has(code)) continue
      this.modules.delete(code)
      loaded.then(
        (module) => {
          this.lineMaps.delete(module.url)
          module.dispose()
        },
        () => {},
      )
    }
  }

  private ensureAlive(instance: Instance | null, generation: number): void {
    if (!this.running || generation !== this.generation || (instance && !instance.alive)) {
      throw new StopSignal()
    }
  }

  private api(instance: Instance | null): ModuleApi {
    const generation = this.generation
    const screen = instance ? this.doc.screens[instance.screenId] : undefined

    /** A component, or with `clone` one of its clones in a game scene. */
    const componentProxy = (componentId: ComponentId, clone?: Body) => {
      const target = {}
      // The body behind a game component (the original, or the clone).
      const bodyOf = (): { world: World; body: Body } | undefined => {
        if (!instance?.game) return undefined
        const found = instance.game.bodyOf(componentId)
        if (!found) return undefined
        if (!clone) return found
        // A deleted clone stops the blocks that still use it (like Scratch).
        if (clone.deleted) throw new StopSignal()
        return { world: found.world, body: clone }
      }
      return new Proxy(target, {
        get: (_, key) => {
          if (key === TARGET) return { componentId, body: bodyOf()?.body } satisfies Target
          if (typeof key !== 'string' || !instance) return undefined
          const node = this.doc.screens[instance.screenId]?.components[componentId]
          const def = node && getComponentDef(node.type)
          if (!node || !def) return undefined
          if (key === 'name') return node.name
          if (key === 'type') return node.type
          if (/^on[A-Z]/.test(key)) {
            const event = key.charAt(2).toLowerCase() + key.slice(3)
            if (def.events[event]) {
              // `onClick(handler)`, or with a filter `onHit(Panier, handler)`.
              return (...args: unknown[]) => {
                const fn = args.at(-1)
                if (typeof fn !== 'function') return
                const filter = args.length > 1 ? filterKey(args[0]) : null
                const byEvent =
                  instance.handlers.get(componentId) ?? new Map<string, HandlerEntry[]>()
                byEvent.set(event, [
                  ...(byEvent.get(event) ?? []),
                  { fn: fn as Handler, filter, busy: false },
                ])
                instance.handlers.set(componentId, byEvent)
              }
            }
          }
          const live = isWorldType(node.type) ? bodyOf() : undefined
          if (def.methods[key]) {
            if (live) return (...args: unknown[]) => callInWorld(live.world, live.body, key, args)
            return (...args: unknown[]) => this.callMethod(instance, componentId, key, args)
          }
          if (def.props[key]) {
            if (live) return live.world.get(live.body, key)
            return this.componentValue(instance, componentId, key)
          }
          if (key === 'then' || key === 'toJSON') return undefined
          this.log(
            'warn',
            format(messages[this.locale].runtime.errors.unknownProperty, {
              component: node.name,
              property: key,
            }),
          )
          return undefined
        },
        set: (_, key, value) => {
          if (typeof key !== 'string' || !instance) return true
          const node = this.doc.screens[instance.screenId]?.components[componentId]
          const def = node && getComponentDef(node.type)
          if (node && def && !def.props[key]) {
            this.log(
              'warn',
              format(messages[this.locale].runtime.errors.unknownProperty, {
                component: node.name,
                property: key,
              }),
            )
            return true
          }
          const live = node && isWorldType(node.type) ? bodyOf() : undefined
          if (live && node && def) {
            const coerced = def.props[key]?.coerce(value)
            if (coerced === undefined || def.props[key]?.live) this.invalid(node.name, key, value)
            else live.world.set(live.body, key, coerced)
            return true
          }
          this.writeProp(instance, componentId, key, value)
          return true
        },
      })
    }

    /** A filter given before a handler: a component (its id), a value, or `null` for any. */
    const filterKey = (value: unknown): string | null => {
      if (value === null || value === undefined) return null
      if (typeof value === 'object') {
        const target = (value as { [TARGET]?: Target })[TARGET]
        return target?.componentId ?? null
      }
      return String(value)
    }

    /** A method of a game component: sync, except a glide that the code awaits. */
    const callInWorld = (world: World, body: Body, method: string, args: unknown[]) => {
      check()
      const values = args.map((arg) =>
        arg && typeof arg === 'object'
          ? ((arg as { [TARGET]?: Target })[TARGET]?.body ?? arg)
          : arg,
      )
      const result = world.call(body, method, values)
      if (result instanceof Promise) {
        return result.then(() => {
          this.lastYield = now()
          check()
        })
      }
      return result
    }

    if (instance) {
      const proxies = new WeakMap<Body, Value>()
      instance.proxyOf = (body) => {
        let proxy = proxies.get(body)
        if (!proxy) {
          proxy = componentProxy(body.componentId, body.clone ? body : undefined)
          proxies.set(body, proxy)
        }
        return proxy
      }
    }

    const named = new Map<string, Value>()
    const components = new Proxy({} as Record<string, Value>, {
      get: (_, key) => {
        if (typeof key !== 'string' || !screen) return undefined
        const entry = Object.entries(screen.components).find(([, node]) => node.name === key)
        if (!entry) return undefined
        // One proxy per component, so that a handler's filter can recognize it.
        let proxy = named.get(entry[0])
        if (!proxy) {
          proxy = componentProxy(entry[0])
          named.set(entry[0], proxy)
        }
        return proxy
      },
    })

    const app = new Proxy({} as Record<string, Value>, {
      get: (_, key) =>
        typeof key === 'string' ? (this.appVars.has(key) ? this.appVars.get(key) : 0) : undefined,
      set: (_, key, value) => {
        if (typeof key === 'string') this.appVars.set(key, value)
        return true
      },
    })

    // Stored and shared variables arrive at J5; until then they live in memory.
    const stored = new Proxy({} as Record<string, Value>, {
      get: (_, key) => (typeof key === 'string' ? (this.storedVars.get(key) ?? 0) : undefined),
      set: (_, key, value) => {
        if (typeof key === 'string') this.storedVars.set(key, value)
        return true
      },
    })

    const check = () => this.ensureAlive(instance, generation)

    return {
      components,
      app,
      stored,
      shared: stored,
      device: {},
      screens: {
        open: (name) => {
          check()
          this.openScreen(String(name))
        },
        back: () => {
          check()
          this.back()
        },
      },
      ui: {
        alert: async (message) => {
          check()
          await this.dialog('alert', message)
        },
        confirm: async (message) => {
          check()
          return (await this.dialog('confirm', message)) === true
        },
        prompt: async (message) => {
          check()
          const answer = await this.dialog('prompt', message)
          return typeof answer === 'string' ? answer : null
        },
        toast: (message) => {
          check()
          this.toast(display(message))
        },
      },
      rx: {
        tick: async () => {
          check()
          // In a game, a loop that moved something waits for the next frame (like Scratch).
          if (this.redrawFrame === this.clock.frames) {
            await this.clock.nextFrame()
            this.lastYield = now()
            check()
          } else if (now() - this.lastYield >= TICK_BUDGET_MS) {
            await yieldToBrowser()
            this.lastYield = now()
            check()
          }
        },
        wait: (seconds) => {
          check()
          const ms = Math.max(0, Number(seconds) || 0) * 1000
          return new Promise<void>((resolve, reject) => {
            const entry = {
              timer: setTimeout(() => {
                this.timers.delete(entry)
                resolve()
              }, ms),
              reject,
            }
            this.timers.add(entry)
          }).then(() => {
            this.lastYield = now()
            check()
          })
        },
        log: (...values) => {
          const blockId = this.blockFromStack(new Error().stack)
          this.log('log', values.map(display).join(' '), blockId)
        },
        // Slow motion (J3) replaces this: the engine will light the block and wait.
        step: async () => check(),
      },
    }
  }

  private async callMethod(
    instance: Instance,
    componentId: ComponentId,
    method: string,
    _args: unknown[],
  ) {
    const node = this.doc.screens[instance.screenId]?.components[componentId]
    if (!node) return undefined
    if (node.type === 'TextInput') {
      if (method === 'clear') this.writeProp(instance, componentId, 'text', '')
      if (method === 'focus') {
        const element = globalThis.document?.querySelector<HTMLElement>(
          `[data-rx-id="${CSS.escape(componentId)}"] input, [data-rx-id="${CSS.escape(componentId)}"] textarea`,
        )
        element?.focus()
      }
    }
    return undefined
  }

  private invalid(component: string, property: string, value: unknown): void {
    this.log(
      'warn',
      format(messages[this.locale].runtime.errors.invalidValue, {
        value: display(value),
        component,
        property,
      }),
    )
  }

  private dialog(kind: Dialog['kind'], message: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const dialog: Dialog = {
        id: this.nextKey++,
        kind,
        message: display(message),
        resolve: (value) => {
          this.dialogs = this.dialogs.filter((d) => d !== dialog)
          this.notify()
          if (value instanceof StopSignal) reject(value)
          else resolve(value)
        },
      }
      this.dialogs.push(dialog)
      this.notify()
    })
  }

  private toast(message: string): void {
    const toast = { id: this.nextKey++, message }
    this.toasts = [...this.toasts, toast]
    this.notify()
    setTimeout(() => {
      this.toasts = this.toasts.filter((t) => t !== toast)
      this.notify()
    }, TOAST_MS)
  }

  // Console

  private log(level: LogLevel, message: string, blockId?: string, workspace?: WorkspaceKey): void {
    this.host.log({ level, message, blockId, workspace, time: Date.now() })
  }

  /** The block whose code is in a stack trace, through the line maps of loaded modules. */
  blockFromStack(stack: string | undefined): string | undefined {
    return this.locateStack(stack)?.blockId
  }

  private locateStack(
    stack: string | undefined,
  ): { blockId?: string; workspace: WorkspaceKey } | undefined {
    if (!stack) return undefined
    for (const [url, info] of this.lineMaps) {
      const at = stack.indexOf(`${url}:`)
      if (at < 0) continue
      const match = /^:(\d+):\d+/.exec(stack.slice(at + url.length))
      if (!match) continue
      const line = Number(match[1])
      return {
        blockId: info.lineMap[line - 1] ?? undefined,
        workspace: info.workspace,
      }
    }
    return undefined
  }

  /** Reports an error from generated code in the console, linked to its block. */
  report(error: unknown): void {
    if (error instanceof StopSignal) return
    const where = this.locateStack(error instanceof Error ? error.stack : undefined)
    const message = friendlyError(error, this.locale, this.mode)
    this.log('error', message, where?.blockId, where?.workspace)
  }
}
