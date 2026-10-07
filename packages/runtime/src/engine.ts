import { getComponentDef, resolveProps } from '@rublox/catalog'
import { format, messages } from '@rublox/i18n'
import {
  APP_WORKSPACE,
  type ComponentId,
  type Locale,
  type ProjectDoc,
  rowToObject,
  type ScreenId,
  type UiMode,
  type WorkspaceKey,
} from '@rublox/schema'
import { BEHAVIORS } from './behaviors/registry.ts'
import type { AiProvider, BehaviorContext } from './behaviors/types.ts'
import type { BoundRow } from './components/types.ts'
import { createDataApi, createWebApi, fromJson, objectGet, objectSet, toJson } from './data/api.ts'
import { type DataServices, DataStore } from './data/store.ts'
import { friendlyError, listItem, StopSignal } from './errors.ts'
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

/** Something the person did in the app (tutorials and challenges check it). */
export type AppEvent = {
  screenId: ScreenId
  componentId: ComponentId
  componentType: string
  componentName: string
  event: string
}

/** Slow motion (SPEC § 4.3): each block waits `delay` ms; breakpoints pause the app. */
export type SlowMotion = { enabled: boolean; delay: number; breakpoints: string[] }

/** The block running in slow motion (`null`: nothing runs now). */
export type StepInfo = { blockId: string | null; workspace: WorkspaceKey | null; paused: boolean }

export type EngineHost = {
  log(entry: LogEntry): void
  state?(state: { screenId: ScreenId | null; running: boolean }): void
  event?(event: AppEvent): void
  step?(step: StepInfo): void
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
  /** Slow motion; the code must then be generated with `slow: true`. */
  slow?: SlowMotion
  /** Stored variables are kept under this id (SPEC § 6.6); the project id by default. */
  appId?: string
  /** Where stored variables live: `localStorage` by default, `null` to keep them in memory. */
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
  /** URL of an asset property value, for behaviors (a sound to play). */
  assetUrl?: (value: string) => string | undefined
  /** The API relay and the shared data (J5); without them, only local tables work. */
  services?: DataServices
  /** The AI assistant for the AI component (J6); absent, the component answers nothing. */
  ai?: AiProvider
}

// biome-ignore lint/suspicious/noExplicitAny: generated code passes any value
type Value = any
type Handler = (...args: Value[]) => Promise<void> | void
type EventArgs = Record<string, unknown>

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
  /** Tables (`data.Contacts.rows()`) and "when a shared variable changes" (J5). */
  data: Record<string, Value>
  /** API connections (`await web.Meteo.get('/forecast')`, J5). */
  web: Record<string, Value>
  screens: { open(name: string): void; back(): void }
  ui: {
    alert(message: Value): Promise<void>
    confirm(message: Value): Promise<boolean>
    prompt(message: Value): Promise<string | null>
    toast(message: Value): void
  }
  device: Record<string, Value>
  /** Functions of the `app` workspace, shared by every screen. */
  functions: Record<string, Value>
  rx: {
    tick(): Promise<void>
    wait(seconds: Value): Promise<void>
    log(...values: Value[]): void
    step(blockId: string): Promise<void>
    /** Item `index` (from 1) of a list, with an error a child can read when it is missing. */
    item(list: Value, index: Value): Value
    /** A field of an object by its path (`current.temperature_2m`, `items[0].name`). */
    get(object: Value, path: Value): Value
    /** Sets a field of an object (creates the object when it is not one). */
    set(object: Value, key: Value, value: Value): Value
    fromJson(text: Value): Value
    toJson(value: Value): string
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
  /** Handlers of data events (`table:<id>`, `var:<id>`). */
  dataHandlers: Map<string, HandlerEntry[]>
  /** What renderers exposed (`useExpose`), by component. */
  handles: Map<ComponentId, unknown>
  /** Behavior contexts, created when the screen opens or a method is first called. */
  contexts: Map<ComponentId, BehaviorContext>
  cleanups: (() => void)[]
}

export type Dialog = {
  id: number
  kind: 'alert' | 'confirm' | 'prompt'
  message: string
  resolve: (value: unknown) => void
}

export type Toast = { id: number; message: string }

/** A full-screen panel over the app (QR scanner…), drawn by `OVERLAYS[kind]`. */
export type Overlay = {
  id: number
  kind: string
  data: unknown
  resolve: (value: unknown) => void
}

export type EngineSnapshot = {
  doc: ProjectDoc
  screen: Instance | null
  depth: number
  running: boolean
  /** The screen at the bottom of the stack: the current tab with tabs or drawer. */
  root: ScreenId | null
  dialogs: readonly Dialog[]
  toasts: readonly Toast[]
  overlays: readonly Overlay[]
  version: number
}

function defaultStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

const httpsOnly = (value: string) => (/^https:\/\//i.test(value) ? value : undefined)

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
  private functions: Record<string, Value> = {}
  private readonly appId: string
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null
  private readonly assetUrl: (value: string) => string | undefined
  private readonly ai: AiProvider | undefined
  private overlays: Overlay[] = []
  private stack: Instance[] = []
  /** Tabs and drawer: the instance of each top-level screen, kept while another one shows. */
  private readonly roots = new Map<ScreenId, Instance>()
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
  private slow: SlowMotion = { enabled: false, delay: 500, breakpoints: [] }
  private readonly breakpoints = new Set<string>()
  /** Waiting at a breakpoint: resolves (go on) or rejects (stop). */
  private paused: { resolve: () => void; reject: (e: unknown) => void }[] = []
  /** "Next block": pause again at the next step. */
  private stepping = false
  private active = 0
  /** Tables, shared variables and APIs (J5). */
  readonly data: DataStore
  /** Data handlers of the `app` module (it has no screen instance). */
  private appDataHandlers = new Map<string, HandlerEntry[]>()

  constructor(options: EngineOptions) {
    this.doc = options.doc
    this.code = options.code
    this.host = options.host
    this.locale = options.locale ?? options.doc.meta.locale
    this.mode = options.mode ?? options.doc.meta.mode
    this.loadModule = options.loadModule ?? loadBlobModule
    this.initialScreen = options.initialScreen
    this.clock = options.clock ?? new FrameClock()
    if (options.slow) this.setSlowMotion(options.slow)
    this.appId = options.appId ?? options.doc.meta.id
    this.storage = options.storage === undefined ? defaultStorage() : options.storage
    this.assetUrl = options.assetUrl ?? httpsOnly
    this.data = new DataStore({
      doc: options.doc,
      appId: this.appId,
      storage: this.storage,
      services: options.services,
      changed: (key) => this.dataChanged(key),
      warn: (key) => this.log('warn', messages[this.locale].runtime.data[key]),
    })
    this.ai = options.ai
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
      root: this.stack[0]?.screenId ?? null,
      depth: this.stack.length,
      running: this.running,
      dialogs: [...this.dialogs],
      toasts: [...this.toasts],
      overlays: [...this.overlays],
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
    this.functions = {}
    this.appDataHandlers = new Map()
    this.data.start()
    this.loadStored()
    this.initVariables()
    this.lastYield = now()
    // The app module defines the shared functions before its first `await`: load it first so
    // that they exist when the screen's code runs.
    const appCode = this.code[APP_WORKSPACE]?.code
    if (appCode) await this.load(APP_WORKSPACE, appCode).catch(() => undefined)
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
    this.data.stop()
    for (const instance of this.stack) this.disposeInstance(instance)
    this.clock.release()
    for (const instance of this.roots.values()) this.disposeInstance(instance)
    this.roots.clear()
    for (const entry of this.timers) {
      clearTimeout(entry.timer)
      entry.reject(new StopSignal())
    }
    this.timers.clear()
    for (const pause of this.paused) pause.reject(new StopSignal())
    this.paused = []
    this.stepping = false
    this.active = 0
    this.host.step?.({ blockId: null, workspace: null, paused: false })
    for (const dialog of this.dialogs) dialog.resolve(new StopSignal())
    this.dialogs = []
    for (const overlay of this.overlays) overlay.resolve(new StopSignal())
    this.overlays = []
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
    this.data.setDoc(doc)
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
    // Hidden tabs whose blocks changed start again the next time they show.
    for (const [screenId, instance] of this.roots) {
      if (this.stack.includes(instance)) continue
      if (previous[screenId]?.code !== code[screenId]?.code || !doc.screens[screenId]) {
        this.disposeInstance(instance)
        this.roots.delete(screenId)
      }
    }
    this.initVariables()
    for (const instance of this.stack) {
      const screen = doc.screens[instance.screenId]
      if (screen && instance.game) instance.game.sync(screen)
      this.mountWorlds(instance)
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
    for (const variable of this.doc.variables.stored) {
      if (!this.storedVars.has(variable.name))
        this.storedVars.set(variable.name, variable.initial ?? 0)
    }
  }

  // Stored variables: kept on the device, under the app's id (SPEC § 6.6)

  private storageKey(): string {
    return `rublox:${this.appId}:stored`
  }

  private loadStored(): void {
    this.storedVars.clear()
    try {
      const text = this.storage?.getItem(this.storageKey())
      const saved = text ? (JSON.parse(text) as Record<string, unknown>) : {}
      const names = new Set(this.doc.variables.stored.map((variable) => variable.name))
      for (const [name, value] of Object.entries(saved)) {
        if (names.has(name)) this.storedVars.set(name, value)
      }
    } catch {
      // Unreadable storage (private mode, bad JSON): start from the initial values.
    }
  }

  private saveStored(): void {
    try {
      this.storage?.setItem(this.storageKey(), JSON.stringify(Object.fromEntries(this.storedVars)))
    } catch {
      this.log('warn', messages[this.locale].catalog.runtime.storageFull)
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
      dataHandlers: new Map(),
      alive: true,
      handles: new Map(),
      contexts: new Map(),
      cleanups: [],
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

  private async push(screenId: ScreenId): Promise<void> {
    const instance = this.newInstance(screenId)
    this.stack.at(-1)?.game?.deactivate()
    if (this.stack.length === 0 && this.isTopLevel(screenId)) this.roots.set(screenId, instance)
    this.stack.push(instance)
    this.notify()
    await this.runModule(screenId, instance)
    this.mountBehaviors(instance)
    this.fireOpen(instance)
  }

  private async restartInstance(index: number): Promise<void> {
    const old = this.stack[index]
    if (!old) return
    this.disposeInstance(old)
    const instance = this.newInstance(old.screenId)
    // What the renderers exposed stays valid: they are not redrawn for a code change.
    for (const [id, handle] of old.handles) instance.handles.set(id, handle)
    this.mountWorlds(instance)
    this.stack[index] = instance
    if (this.roots.get(old.screenId) === old) this.roots.set(old.screenId, instance)
    await this.runModule(instance.screenId, instance)
    this.mountBehaviors(instance)
    if (this.stack.at(-1) === instance) this.fireOpen(instance)
  }

  /** Ends a screen instance: its behaviors stop (timers, sensors, sounds), its game too. */
  private disposeInstance(instance: Instance): void {
    if (!instance.alive) return
    instance.alive = false
    instance.game?.dispose()
    for (const cleanup of instance.cleanups.splice(0)) {
      try {
        cleanup()
      } catch (error) {
        console.warn('Rublox: a component did not stop cleanly', error)
      }
    }
  }

  // Behaviors (SPEC § 6.3): what components do beyond showing their properties

  private mountBehaviors(instance: Instance): void {
    if (!instance.alive) return
    const screen = this.doc.screens[instance.screenId]
    if (!screen) return
    for (const [id, node] of Object.entries(screen.components)) {
      const behavior = BEHAVIORS[node.type]
      if (!behavior) continue
      const ctx = this.contextOf(instance, id)
      if (behavior.available && getComponentDef(node.type)?.props.available) {
        let available = false
        try {
          available = behavior.available(ctx)
        } catch {
          available = false
        }
        ctx.set('available', available)
      }
      try {
        behavior.mount?.(ctx)
      } catch (error) {
        this.report(error)
      }
    }
  }

  private contextOf(instance: Instance, componentId: ComponentId): BehaviorContext {
    const existing = instance.contexts.get(componentId)
    if (existing) return existing
    const name = () => this.doc.screens[instance.screenId]?.components[componentId]?.name ?? ''
    const ctx: BehaviorContext = {
      id: componentId,
      get name() {
        return name()
      },
      type: this.doc.screens[instance.screenId]?.components[componentId]?.type ?? '',
      locale: this.locale,
      appId: this.appId,
      get: (prop) => this.componentValue(instance, componentId, prop),
      set: (prop, value) => this.writeProp(instance, componentId, prop, value),
      emit: (event, args) => this.fire(instance, componentId, event, args),
      fail: (message) => {
        this.log('warn', `${name()} : ${message}`)
        this.fire(instance, componentId, 'error', { message })
      },
      handle: <T>() => instance.handles.get(componentId) as T | undefined,
      assetUrl: (value) => this.resolveAsset(value),
      onDispose: (cleanup) => {
        if (instance.alive) instance.cleanups.push(cleanup)
        else cleanup()
      },
      alive: () => instance.alive && this.running,
      overlay: <T>(kind: string, data?: unknown) => this.overlay(kind, data) as Promise<T>,
      sheet: (url) => this.data.sheet(url),
      ai: this.ai,
    }
    instance.contexts.set(componentId, ctx)
    return ctx
  }

  /** URL of an asset property: a project asset, https:, or one made while running. */
  resolveAsset(value: string): string | undefined {
    if (/^(blob:|data:(image|audio|video)\/)/i.test(value)) return value
    return this.assetUrl(value)
  }

  /** A renderer of the visible screen exposed (or withdrew) its imperative handle. */
  expose(instanceKey: number, componentId: ComponentId, handle: unknown): void {
    const instance = this.stack.find((entry) => entry.key === instanceKey)
    if (!instance) return
    if (handle === null || handle === undefined) {
      instance.handles.delete(componentId)
      instance.game?.worlds.get(componentId)?.unmount()
    } else instance.handles.set(componentId, handle)
    this.mountWorlds(instance)
  }

  /** Draws each game scene into the stage its renderer exposed (`{ stage }`). */
  private mountWorlds(instance: Instance): void {
    for (const [id, world] of instance.game?.worlds ?? []) {
      const stage = (instance.handles.get(id) as { stage?: HTMLElement } | undefined)?.stage
      if (stage && world.stage !== stage) world.mount(stage, (value) => this.resolveAsset(value))
    }
  }

  private overlay(kind: string, data: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const overlay: Overlay = {
        id: this.nextKey++,
        kind,
        data,
        resolve: (value) => {
          this.overlays = this.overlays.filter((o) => o !== overlay)
          this.notify()
          if (value instanceof StopSignal) reject(value)
          else resolve(value)
        },
      }
      this.overlays.push(overlay)
      this.notify()
    })
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
    if (this.isTopLevel(screenId)) this.switchTo(screenId)
    else void this.push(screenId)
  }

  // Tabs and drawer (SPEC § 4.1): their screens are top-level, each keeps its state

  /** The screens of the tab bar or the drawer: the navigation items, or every screen. */
  navigationScreens(): ScreenId[] {
    const navigation = this.doc.settings.navigation
    if (navigation.kind === 'stack') return []
    const items = navigation.items?.map((item) => item.screen) ?? this.doc.screenOrder
    return items.filter((id) => this.doc.screens[id])
  }

  private isTopLevel(screenId: ScreenId): boolean {
    return this.navigationScreens().includes(screenId)
  }

  /** Shows a tab (or a drawer entry): closes the screens opened above, keeps the tab's state. */
  switchTo(screenId: ScreenId): void {
    if (!this.running || !this.doc.screens[screenId]) return
    const [root, ...above] = this.stack
    if (root?.screenId === screenId && above.length === 0) return
    root?.game?.deactivate()
    for (const instance of above) this.disposeInstance(instance)
    if (root && !this.roots.has(root.screenId)) this.disposeInstance(root)
    const kept = this.roots.get(screenId)
    if (kept?.alive) {
      this.stack = [kept]
      this.notify()
      this.fireOpen(kept)
      return
    }
    this.stack = []
    void this.push(screenId)
  }

  back(): void {
    if (!this.running || this.stack.length < 2) return
    const instance = this.stack.pop()
    if (instance) this.disposeInstance(instance)
    this.notify()
    const top = this.stack.at(-1)
    if (top) this.fireOpen(top)
  }

  // Data events (J5): a table or a shared variable changed

  private dataChanged(key: string): void {
    this.notify()
    if (!this.running) return
    const instances = new Set([...this.stack, ...this.roots.values()])
    const lists = [this.appDataHandlers, ...[...instances].map((i) => i.dataHandlers)]
    for (const handlers of lists) {
      for (const entry of handlers.get(key) ?? []) {
        if (entry.busy) continue
        entry.busy = true
        this.lastYield = now()
        void this.track(() => Promise.resolve().then(() => entry.fn()))
          .catch((error) => this.report(error))
          .finally(() => {
            entry.busy = false
          })
      }
    }
  }

  /** Rows of a table, for the components bound to it (`source`). */
  tableRows = (tableId: string): BoundRow[] | undefined => {
    const table = this.doc.data.tables[tableId]
    if (!table) return undefined
    return this.data.rows(tableId).map((row) => ({ row, object: rowToObject(table.columns, row) }))
  }

  // Events from the rendering

  /** A component of the visible screen fired an event (a click…), with its values. */
  emit(componentId: ComponentId, event: string, args?: Record<string, unknown>): void {
    const instance = this.stack.at(-1)
    if (!instance) return
    const node = this.doc.screens[instance.screenId]?.components[componentId]
    if (node && this.running)
      this.host.event?.({
        screenId: instance.screenId,
        componentId,
        componentType: node.type,
        componentName: node.name,
        event,
      })
    this.fire(instance, componentId, event, args)
  }

  // Slow motion

  setSlowMotion(slow: SlowMotion): void {
    this.slow = { ...slow }
    this.breakpoints.clear()
    for (const id of slow.breakpoints) this.breakpoints.add(id)
    // Turned off while paused: let the code run on.
    if (!slow.enabled) this.resume(false)
  }

  /** Leaves a pause: runs on, or (`step`) stops again at the next block. */
  resume(step: boolean): void {
    this.stepping = step && this.slow.enabled
    const waiting = this.paused
    this.paused = []
    for (const pause of waiting) pause.resolve()
  }

  isPaused(): boolean {
    return this.paused.length > 0
  }

  /** Counts running handlers, to switch the highlight off when the last one ends. */
  private track<T>(run: () => Promise<T>): Promise<T> {
    if (!this.slow.enabled) return run()
    this.active += 1
    return run().finally(() => {
      this.active = Math.max(0, this.active - 1)
      if (this.active === 0 && this.slow.enabled && this.running)
        this.host.step?.({ blockId: null, workspace: null, paused: false })
    })
  }

  private async step(blockId: string, workspace: WorkspaceKey, check: () => void): Promise<void> {
    check()
    if (!this.slow.enabled) return
    const pause = this.stepping || this.breakpoints.has(blockId)
    this.host.step?.({ blockId, workspace, paused: pause })
    if (pause) {
      this.stepping = false
      await new Promise<void>((resolve, reject) => this.paused.push({ resolve, reject }))
      this.host.step?.({ blockId, workspace, paused: false })
    } else {
      await this.sleep(this.slow.delay)
    }
    this.lastYield = now()
    check()
  }

  private sleep(ms: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const entry = {
        timer: setTimeout(() => {
          this.timers.delete(entry)
          resolve()
        }, ms),
        reject,
      }
      this.timers.add(entry)
    })
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
    args: EventArgs = {},
    filter?: string,
    self?: Value,
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
      void this.track(() =>
        Promise.resolve().then(() => (self === undefined ? entry.fn(args) : entry.fn(self, args))),
      )
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
        args: EventArgs,
        filter?: string,
      ) => {
        const proxy = (value: unknown) =>
          value && typeof value === 'object' && 'key' in value && 'values' in value
            ? instance.proxyOf?.(value as Body)
            : value
        const node = this.doc.screens[instance.screenId]?.components[componentId]
        const clonable = Boolean(node && getComponentDef(node.type)?.clonable)
        const values = Object.fromEntries(Object.entries(args).map(([k, v]) => [k, proxy(v)]))
        this.fire(
          instance,
          componentId,
          event,
          values,
          filter,
          clonable && self ? proxy(self) : undefined,
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
    // Writing the same value again changes nothing (and redraws nothing).
    if (prop in current && Object.is(current[prop], coerced)) return
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
      await this.track(async () => loaded.run(this.api(instance)))
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
            if (coerced === undefined || def.props[key]?.state) this.invalid(node.name, key, value)
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

    // Stored variables are kept on the device, shared ones on the server (J5).
    const stored = new Proxy({} as Record<string, Value>, {
      get: (_, key) => (typeof key === 'string' ? (this.storedVars.get(key) ?? 0) : undefined),
      set: (_, key, value) => {
        if (typeof key === 'string') {
          this.storedVars.set(key, value)
          this.saveStored()
        }
        return true
      },
    })
    const shared = new Proxy({} as Record<string, Value>, {
      get: (_, key) => (typeof key === 'string' ? this.data.getShared(key) : undefined),
      set: (_, key, value) => {
        if (typeof key === 'string') this.data.setShared(key, value)
        return true
      },
    })
    const onData = (key: string, fn: Handler) => {
      const handlers = instance ? instance.dataHandlers : this.appDataHandlers
      handlers.set(key, [...(handlers.get(key) ?? []), { fn, filter: null, busy: false }])
    }

    const check = () => this.ensureAlive(instance, generation)

    return {
      components,
      app,
      stored,
      shared,
      data: createDataApi(this.data, onData, () => check()),
      web: createWebApi(
        this.data,
        () => check(),
        () => {
          this.lastYield = now()
        },
      ),
      device: {},
      functions: this.functions,
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
          return this.sleep(ms).then(() => {
            this.lastYield = now()
            check()
          })
        },
        log: (...values) => {
          const blockId = this.blockFromStack(new Error().stack)
          this.log('log', values.map(display).join(' '), blockId)
        },
        // Slow motion: lights the block up in the editor, then waits (or pauses).
        step: (blockId) => this.step(String(blockId), instance?.screenId ?? APP_WORKSPACE, check),
        item: (list, index) => listItem(list, index),
        get: objectGet,
        set: objectSet,
        fromJson,
        toJson,
      },
    }
  }

  private callMethod(
    instance: Instance,
    componentId: ComponentId,
    method: string,
    args: unknown[],
  ): unknown {
    const node = this.doc.screens[instance.screenId]?.components[componentId]
    const run = node && BEHAVIORS[node.type]?.methods?.[method]
    if (!run) return undefined
    return run(this.contextOf(instance, componentId), ...args)
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
