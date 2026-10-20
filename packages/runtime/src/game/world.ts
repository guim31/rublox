import { GAME_KEYS, resolveProps, SCENE_CHILD_TYPES } from '@rublox/catalog'
import type { ComponentId, Locale, Screen } from '@rublox/schema'
import type { FrameClock } from './clock.ts'
import {
  costumeOf,
  joystickStyle,
  knobTransform,
  num,
  type Offset,
  sceneTextStyle,
  scrollOf,
  spriteStyle,
} from './draw.ts'
import { extent, overlap, type Shape } from './geometry.ts'

type Values = Record<string, unknown>

/** Something drawn in a scene: a sprite (or one of its clones), a scene text, a joystick. */
export type Body = {
  /** Unique in the world, never reused. */
  key: number
  type: string
  /** The component in the project; clones share their original's. */
  componentId: ComponentId
  name: string
  clone: boolean
  values: Values
  /** Properties changed while running: a design change no longer overrides them. */
  written: Set<string>
  deleted: boolean
  dirty: boolean
  el?: HTMLElement
  /** The costume drawn now, to swap the element's content only when it changes. */
  drawn?: string
  /** Style values written to the element, to write only what changed. */
  styles?: Map<string, string>
  /**
   * Whether it takes touches (draggable, or a handler listens). Computed at the first draw and
   * again when the handlers of its component change (`listenersChanged`): never per frame.
   */
  touchable?: boolean
  /** Edges touched at the last frame, one bit each (`EDGES` order). */
  edgesTouched: number
  glide?: Glide
  dragging?: { pointer: number; dx: number; dy: number; moved: boolean }
  /** Drawing order set by "bring to the front" / "send to the back" (0 = as in the project). */
  z: number
  /** Costumes flipping on their own (`animate`). */
  anim?: { first: number; last: number; fps: number; time: number }
  /** The camera offset this body was last drawn with, to redraw it when the camera moves. */
  offset?: string
}

type Glide = {
  from: { x: number; y: number }
  to: { x: number; y: number }
  elapsed: number
  duration: number
  resolve: () => void
}

/** What a world needs from the engine. */
export type WorldHost = {
  /**
   * Runs the handlers of `event` of `componentId`. `self` is the body that fired (a clone's
   * handlers receive it first); `filter` is matched against the handlers' filters.
   */
  fire(
    self: Body | null,
    componentId: ComponentId,
    event: string,
    args: Record<string, unknown>,
    filter?: string,
  ): void
  /** Whether a handler exists, to skip work nobody listens to. */
  listens(componentId: ComponentId, event: string): boolean
  /** Something visible changed: loops waiting for the next frame should wait for it. */
  redraw(): void
  warn(message: string, values: Record<string, unknown>): void
}

export const MAX_CLONES = 300

const EDGES = ['top', 'bottom', 'left', 'right'] as const

/** Properties whose change needs the body to be drawn again. */
const VISUAL = new Set([
  'x',
  'y',
  'width',
  'height',
  'rotation',
  'costumes',
  'costume',
  'visible',
  'opacity',
  'text',
  'fontSize',
  'color',
  'bold',
  'outline',
  'align',
  'size',
  'dx',
  'dy',
  'draggable',
  'flipX',
  'tiled',
  'scroll',
])

/** A key of the keyboard, as games name it (`GAME_KEYS`), or `undefined`. */
export function gameKey(event: { key: string; code?: string }): string | undefined {
  const arrows: Record<string, string> = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowUp: 'up',
    ArrowDown: 'down',
    ' ': 'space',
    Spacebar: 'space',
    Enter: 'enter',
  }
  const key = arrows[event.key] ?? event.key.toLowerCase()
  return (GAME_KEYS as readonly string[]).includes(key) ? key : undefined
}

/** The keys that steer a joystick: right, left, down, up. */
const STEERING: Record<string, [string[], string[], string[], string[]]> = {
  arrows: [['right'], ['left'], ['down'], ['up']],
  wasd: [['d'], ['a', 'q'], ['s'], ['w', 'z']],
}

/** How far a finger goes before it is a swipe, in scene units. */
const SWIPE_DISTANCE = 36

const SCENE_CHILDREN = new Set<string>(SCENE_CHILD_TYPES)

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true
  // Numbers and texts change at every frame: only lists (costumes) need a deep look.
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  return JSON.stringify(a) === JSON.stringify(b)
}

/** One number for a pair of bodies, the smaller key first (keys stay below a million). */
const PAIR = 1_000_000
const pairKey = (a: Body, b: Body) => (a.key < b.key ? a.key * PAIR + b.key : b.key * PAIR + a.key)

/**
 * A running game scene (SPEC § 4.4): its bodies, the physics (speed, gravity, edges, bounces,
 * collisions), clones, touch and drag, drawn by writing CSS transforms on plain elements. The
 * engine reads and writes properties here instead of re-rendering React.
 */
export class World {
  readonly scene: Body
  /** Drawing order, back to front. */
  bodies: Body[] = []
  private readonly originals = new Map<ComponentId, Body>()
  private readonly contacts = new Set<number>()
  private nextKey = 1
  private started = false
  private active = false
  private disposed = false
  private unsubscribe: (() => void) | null = null
  private drawingOn: HTMLElement | null = null
  private assetUrl: (value: string) => string | undefined = () => undefined
  private pendingDrags = new Map<number, { x: number; y: number }>()
  /** Joysticks moved since the last frame (several at once: one finger each). */
  private pendingMoves = new Map<number, { dx: number; dy: number; body: Body }>()
  /** Keys held down now (`GAME_KEYS`). */
  private readonly pressed = new Set<string>()
  /** Fingers on the scene that may become a swipe. */
  private readonly swipes = new Map<number, { x: number; y: number; done: boolean }>()
  /** The sprite the camera follows, and its shaking. */
  private following: Body | null = null
  private snap = false
  private shaking = { left: 0, duration: 0 }
  private shakeOffset = { x: 0, y: 0 }
  private keyTarget: (Window & typeof globalThis) | null = null

  constructor(
    readonly sceneId: ComponentId,
    screen: Screen,
    private readonly locale: Locale,
    private readonly host: WorldHost,
    private readonly clock: FrameClock,
  ) {
    const node = screen.components[sceneId]
    this.scene = this.makeBody(sceneId, node?.type ?? 'GameScene', node?.name ?? '', {
      ...resolveProps(node?.type ?? 'GameScene', node?.props ?? {}, locale),
    })
    this.sync(screen)
  }

  // Bodies

  private makeBody(componentId: ComponentId, type: string, name: string, values: Values): Body {
    return {
      key: this.nextKey++,
      type,
      componentId,
      name,
      clone: false,
      values,
      written: new Set(),
      deleted: false,
      dirty: true,
      edgesTouched: 0,
      z: 0,
    }
  }

  /** Follows the project: new, removed and edited children of the scene. */
  sync(screen: Screen): void {
    const sceneNode = screen.components[this.sceneId]
    if (!sceneNode) return
    this.refresh(this.scene, resolveProps(sceneNode.type, sceneNode.props, this.locale))
    this.scene.name = sceneNode.name
    const children = (sceneNode.children ?? []).filter((id) => {
      const type = screen.components[id]?.type
      return type !== undefined && SCENE_CHILDREN.has(type)
    })
    for (const id of [...this.originals.keys()]) {
      if (!children.includes(id)) {
        for (const other of this.bodies.filter((b) => b.componentId === id)) this.remove(other)
        this.originals.delete(id)
      }
    }
    for (const id of children) {
      const node = screen.components[id]
      if (!node) continue
      const values = resolveProps(node.type, node.props, this.locale)
      const existing = this.originals.get(id)
      if (existing) {
        existing.name = node.name
        this.refresh(existing, values)
      } else {
        const body = this.makeBody(id, node.type, node.name, values)
        this.originals.set(id, body)
        this.bodies.push(body)
        if (this.drawingOn) this.createElement(body)
      }
    }
    // Back to front as in the project; clones just behind their original.
    const order = new Map(children.map((id, index) => [id, index]))
    const sorted = [...this.bodies].sort((a, b) => {
      if (a.z !== b.z) return a.z - b.z
      const byComponent = (order.get(a.componentId) ?? 0) - (order.get(b.componentId) ?? 0)
      if (byComponent) return byComponent
      return Number(b.clone) - Number(a.clone) || a.key - b.key
    })
    if (sorted.some((body, index) => body !== this.bodies[index])) {
      this.bodies = sorted
      if (this.drawingOn) for (const body of sorted) if (body.el) this.drawingOn.append(body.el)
    }
  }

  private refresh(body: Body, values: Values): void {
    for (const [key, value] of Object.entries(values)) {
      if (body.written.has(key) || same(body.values[key], value)) continue
      body.values[key] = value
      body.dirty = true
    }
  }

  original(componentId: ComponentId): Body | undefined {
    return componentId === this.sceneId ? this.scene : this.originals.get(componentId)
  }

  has(componentId: ComponentId): boolean {
    return componentId === this.sceneId || this.originals.has(componentId)
  }

  get(body: Body, key: string): unknown {
    if (key === 'isClone') return body.clone
    return body.values[key]
  }

  /** Writes a property (already validated by the engine). */
  set(body: Body, key: string, value: unknown): void {
    body.written.add(key)
    if (same(body.values[key], value)) return
    if (key === 'draggable') body.touchable = undefined
    body.values[key] = value
    if (VISUAL.has(key)) {
      body.dirty = true
      this.redraw()
    }
    if (body === this.scene && (key === 'cameraX' || key === 'cameraY')) this.redraw()
  }

  /**
   * A property written by the blocks: choosing a costume stops an animation; the camera set
   * by hand takes it from the sprite it followed.
   */
  write(body: Body, key: string, value: unknown): void {
    if (key === 'costume') body.anim = undefined
    this.set(body, key, value)
  }

  /**
   * Something visible changed: a loop waits for the next frame. Not while the scene is
   * paused, so that a level is built at once (J10).
   */
  private redraw(): void {
    if (this.scene.values.paused !== true) this.host.redraw()
  }

  /** The size of the world: the scene's, unless the world is set bigger (J10). */
  private size(): { width: number; height: number; viewWidth: number; viewHeight: number } {
    const viewWidth = num(this.scene.values.sceneWidth, 360)
    const viewHeight = num(this.scene.values.sceneHeight, 640)
    return {
      width: Math.max(viewWidth, num(this.scene.values.worldWidth)),
      height: Math.max(viewHeight, num(this.scene.values.worldHeight)),
      viewWidth,
      viewHeight,
    }
  }

  private move(body: Body, x: number, y: number): void {
    this.set(body, 'x', x)
    this.set(body, 'y', y)
  }

  clones(): number {
    return this.bodies.filter((body) => body.clone).length
  }

  /** A copy of `body`, just behind it, that runs the same blocks (`when … starts as a clone`). */
  cloneOf(body: Body): Body | null {
    if (body.type !== 'Sprite' || body.deleted) return null
    if (this.clones() >= MAX_CLONES) {
      this.host.warn('tooManyClones', { count: MAX_CLONES, name: body.name })
      return null
    }
    const copy = this.makeBody(body.componentId, body.type, body.name, structuredClone(body.values))
    copy.clone = true
    copy.written = new Set(Object.keys(copy.values))
    copy.glide = undefined
    copy.z = body.z
    copy.anim = body.anim ? { ...body.anim } : undefined
    const at = this.bodies.indexOf(body)
    this.bodies.splice(at < 0 ? this.bodies.length : at, 0, copy)
    if (this.drawingOn) this.createElement(copy, body.el)
    this.redraw()
    this.host.fire(copy, copy.componentId, 'clone', {})
    return copy
  }

  /** Deletes a clone; the original is hidden instead (it keeps its blocks). */
  delete(body: Body): void {
    if (body.deleted) return
    if (!body.clone) {
      this.set(body, 'visible', false)
      return
    }
    this.remove(body)
  }

  private remove(body: Body): void {
    body.deleted = true
    body.glide?.resolve()
    body.glide = undefined
    body.el?.remove()
    body.el = undefined
    this.bodies = this.bodies.filter((other) => other !== body)
    for (const key of [...this.contacts]) {
      if (Math.floor(key / PAIR) === body.key || key % PAIR === body.key) this.contacts.delete(key)
    }
    this.pendingDrags.delete(body.key)
    if (this.following === body) this.following = null
    this.redraw()
  }

  deleteClones(): void {
    for (const body of this.bodies.filter((b) => b.clone)) this.remove(body)
  }

  // Methods called by the generated code

  /** A method of a body: returns its result (a promise for `glideTo`). */
  call(body: Body, method: string, args: unknown[]): unknown {
    const n = (index: number, fallback = 0) => {
      const value = Number(args[index])
      return Number.isFinite(value) ? value : fallback
    }
    const target =
      args[0] instanceof Object && 'key' in (args[0] as object) ? (args[0] as Body) : null
    const v = body.values
    switch (method) {
      case 'pause':
        return this.set(this.scene, 'paused', true)
      case 'resume':
        return this.set(this.scene, 'paused', false)
      case 'deleteClones':
        return this.deleteClones()
      case 'follow':
        if (!target || target.deleted) return undefined
        if (this.following !== target) this.snap = true
        this.following = target
        return this.followCamera(0)
      case 'stopFollowing':
        this.following = null
        return undefined
      case 'shake':
        this.shaking = { left: Math.max(0, n(0, 0.3)), duration: Math.max(0.01, n(0, 0.3)) }
        return this.wake()
      case 'isKeyPressed':
        return this.pressed.has(String(args[0] ?? ''))
      case 'toFront':
      case 'toBack':
        return this.reorder(body, method === 'toFront')
      case 'animate': {
        const first = Math.max(1, Math.round(n(0, 1)))
        const last = Math.max(1, Math.round(n(1, first)))
        const fps = Math.max(0, n(2, 8))
        const anim = body.anim
        // Asked again at every frame (in a loop): the animation goes on where it is.
        if (anim && anim.first === first && anim.last === last && anim.fps === fps) return
        body.anim = { first, last, fps, time: 0 }
        return this.set(body, 'costume', first)
      }
      case 'stopAnimation':
        body.anim = undefined
        return undefined
      case 'moveForward': {
        const angle = (num(v.rotation) * Math.PI) / 180
        return this.move(body, num(v.x) + Math.cos(angle) * n(0), num(v.y) + Math.sin(angle) * n(0))
      }
      case 'moveBy':
        return this.move(body, num(v.x) + n(0), num(v.y) + n(1))
      case 'goTo':
        body.glide?.resolve()
        body.glide = undefined
        return this.move(body, n(0), n(1))
      case 'glideTo':
        return this.glide(body, n(0), n(1), Math.max(0, n(2, 1)))
      case 'turn':
        return this.set(body, 'rotation', num(v.rotation) + n(0))
      case 'pointTowards':
        if (!target || target.deleted) return undefined
        return this.pointAt(body, num(target.values.x), num(target.values.y))
      case 'pointAt':
        return this.pointAt(body, n(0), n(1))
      case 'nextCostume': {
        const count = Array.isArray(v.costumes) ? v.costumes.length : 1
        return this.set(body, 'costume', (Math.round(num(v.costume, 1)) % Math.max(1, count)) + 1)
      }
      case 'clone':
        this.cloneOf(body)
        return undefined
      case 'delete':
        return this.delete(body)
      case 'isTouching':
        return Boolean(target && this.touching(body, target))
      case 'distanceTo':
        if (!target) return 0
        return Math.hypot(num(target.values.x) - num(v.x), num(target.values.y) - num(v.y))
    }
    return undefined
  }

  /** Puts a body in front of (or behind) all the others, clones included. */
  private reorder(body: Body, front: boolean): void {
    const zs = this.bodies.map((other) => other.z)
    const z = front ? Math.max(0, ...zs) + 1 : Math.min(0, ...zs) - 1
    body.z = z
    this.bodies = [...this.bodies.filter((other) => other !== body)]
    if (front) this.bodies.push(body)
    else this.bodies.unshift(body)
    const stage = this.drawingOn
    if (stage && body.el) {
      if (front) stage.append(body.el)
      else stage.prepend(body.el)
    }
    this.redraw()
  }

  private pointAt(body: Body, x: number, y: number): void {
    const dx = x - num(body.values.x)
    const dy = y - num(body.values.y)
    if (dx === 0 && dy === 0) return
    this.set(body, 'rotation', Math.round(((Math.atan2(dy, dx) * 180) / Math.PI) * 100) / 100)
  }

  private glide(body: Body, x: number, y: number, seconds: number): Promise<void> {
    body.glide?.resolve()
    if (seconds <= 0 || body.deleted) {
      body.glide = undefined
      this.move(body, x, y)
      return Promise.resolve()
    }
    return new Promise((resolve) => {
      body.glide = {
        from: { x: num(body.values.x), y: num(body.values.y) },
        to: { x, y },
        elapsed: 0,
        duration: seconds,
        resolve,
      }
      this.wake()
    })
  }

  // Life cycle

  /** The screen is shown: the scene starts once (`when Scene1 starts`), then runs. */
  activate(): void {
    if (this.disposed) return
    this.active = true
    if (!this.started) {
      this.started = true
      this.host.fire(null, this.sceneId, 'start', {})
    }
    this.wake()
  }

  /** Another screen covers this one: the game waits. */
  deactivate(): void {
    this.active = false
    this.unsubscribe?.()
    this.unsubscribe = null
    this.pressed.clear()
    this.swipes.clear()
  }

  private wake(): void {
    if (!this.active || this.disposed || this.unsubscribe) return
    this.unsubscribe = this.clock.subscribe((dt) => this.frame(dt))
  }

  dispose(): void {
    this.disposed = true
    this.deactivate()
    for (const body of this.bodies) {
      body.glide?.resolve()
      body.glide = undefined
    }
    this.unmount()
  }

  // One frame

  /** Advances the game by `dt` seconds: glides, physics, edges, collisions, events, drawing. */
  frame(dt: number): void {
    if (this.disposed) return
    if (this.scene.values.paused !== true) {
      for (const body of this.bodies) {
        if (body.type === 'Sprite' && body.values.onGround === true)
          this.set(body, 'onGround', false)
      }
      for (const body of [...this.bodies]) {
        if (body.deleted) continue
        if (body.type === 'Sprite') this.integrate(body, dt)
      }
      this.collide(dt)
      this.steerByKeys()
      for (const [key, point] of this.pendingDrags) {
        const body = this.bodies.find((b) => b.key === key)
        if (body) this.host.fire(body, body.componentId, 'drag', { x: point.x, y: point.y })
      }
      this.pendingDrags.clear()
      const moves = [...this.pendingMoves.values()]
      this.pendingMoves.clear()
      for (const { body, dx, dy } of moves) {
        if (!body.deleted) this.host.fire(body, body.componentId, 'move', { dx, dy })
      }
      this.followCamera(dt)
      this.host.fire(null, this.sceneId, 'frame', { dt })
    } else {
      this.pendingDrags.clear()
    }
    this.shake(dt)
    this.render()
  }

  // Camera (J10)

  /** Moves the camera towards the followed sprite (at once the first time), within the world. */
  private followCamera(dt: number): void {
    const target = this.following
    if (!target || target.deleted) return
    const { width, height, viewWidth, viewHeight } = this.size()
    const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value))
    const wantX = clamp(num(target.values.x) - viewWidth / 2, width - viewWidth)
    const wantY = clamp(num(target.values.y) - viewHeight / 2, height - viewHeight)
    // A smooth follow, the same at any frame rate; the first frame jumps.
    const k = this.snap ? 1 : 1 - Math.exp(-dt * 12)
    this.snap = false
    const x = num(this.scene.values.cameraX)
    const y = num(this.scene.values.cameraY)
    const round = (value: number) => Math.round(value * 100) / 100
    this.set(this.scene, 'cameraX', round(x + (wantX - x) * k))
    this.set(this.scene, 'cameraY', round(y + (wantY - y) * k))
  }

  private shake(dt: number): void {
    const shaking = this.shaking
    if (shaking.left <= 0) {
      if (this.shakeOffset.x || this.shakeOffset.y) this.shakeOffset = { x: 0, y: 0 }
      return
    }
    shaking.left = Math.max(0, shaking.left - dt)
    const amplitude = 10 * (shaking.left / shaking.duration)
    this.shakeOffset = {
      x: Math.round((Math.random() * 2 - 1) * amplitude),
      y: Math.round((Math.random() * 2 - 1) * amplitude),
    }
  }

  /** Where the camera is now, shaking included: bodies are drawn that far to the left and up. */
  private view(): Offset {
    return {
      x: num(this.scene.values.cameraX) + this.shakeOffset.x,
      y: num(this.scene.values.cameraY) + this.shakeOffset.y,
    }
  }

  // Keyboard (J10)

  /** A key goes down (from the keyboard, or a test): events, joysticks. */
  keyDown(key: string): void {
    if (!this.active || this.pressed.has(key)) return
    this.pressed.add(key)
    this.wake()
    this.host.fire(null, this.sceneId, 'keyDown', { key }, key)
  }

  keyUp(key: string): void {
    if (!this.pressed.delete(key)) return
    this.host.fire(null, this.sceneId, 'keyUp', { key }, key)
  }

  /** Whether a scene listens to the keyboard (its events, or a joystick driven by keys). */
  private hearsKeys(): boolean {
    return (
      this.host.listens(this.sceneId, 'keyDown') ||
      this.host.listens(this.sceneId, 'keyUp') ||
      this.bodies.some((body) => body.type === 'Joystick' && body.values.keys !== 'none')
    )
  }

  /** Joysticks driven by the keyboard, when no finger holds them. */
  private steerByKeys(): void {
    for (const body of this.bodies) {
      if (body.type !== 'Joystick' || body.dragging) continue
      const keys = STEERING[String(body.values.keys ?? 'arrows')]
      if (!keys) continue
      const held = (list: string[]) => (list.some((key) => this.pressed.has(key)) ? 1 : 0)
      let dx = held(keys[0]) - held(keys[1])
      let dy = held(keys[2]) - held(keys[3])
      if (dx && dy) {
        dx *= Math.SQRT1_2
        dy *= Math.SQRT1_2
      }
      dx = Math.round(dx * 100) / 100
      dy = Math.round(dy * 100) / 100
      const before = { dx: num(body.values.dx), dy: num(body.values.dy) }
      if (before.dx === dx && before.dy === dy) continue
      this.set(body, 'dx', dx)
      this.set(body, 'dy', dy)
      if (dx || dy) this.pendingMoves.set(body.key, { body, dx, dy })
      else this.host.fire(body, body.componentId, 'release', {})
    }
  }

  private onKey = (event: KeyboardEvent): void => {
    if (!this.active || event.ctrlKey || event.metaKey || event.altKey) return
    const target = event.target as HTMLElement | null
    if (target?.closest?.('input, textarea, select, [contenteditable="true"]')) return
    const key = gameKey(event)
    if (!key || !this.hearsKeys()) return
    // The arrows and space would scroll the page under the game.
    event.preventDefault()
    if (event.type === 'keydown') this.keyDown(key)
    else this.keyUp(key)
  }

  private onBlur = (): void => {
    for (const key of [...this.pressed]) this.keyUp(key)
  }

  private integrate(body: Body, dt: number): void {
    const v = body.values
    const anim = body.anim
    if (anim) {
      anim.time += dt
      const count = Math.abs(anim.last - anim.first) + 1
      const step = anim.fps > 0 ? Math.floor(anim.time * anim.fps) % count : 0
      this.set(body, 'costume', anim.first + (anim.last >= anim.first ? step : -step))
    }
    if (body.glide) {
      const glide = body.glide
      glide.elapsed += dt
      const t = Math.min(1, glide.elapsed / glide.duration)
      const ease = t * t * (3 - 2 * t)
      this.move(
        body,
        glide.from.x + (glide.to.x - glide.from.x) * ease,
        glide.from.y + (glide.to.y - glide.from.y) * ease,
      )
      if (t >= 1) {
        body.glide = undefined
        glide.resolve()
      }
    } else if (!body.dragging) {
      const gravity = num(v.gravity)
      let vy = num(v.vy)
      const vx = num(v.vx)
      if (gravity) {
        vy += gravity * dt
        this.set(body, 'vy', vy)
      }
      if (vx || vy) this.move(body, num(v.x) + vx * dt, num(v.y) + vy * dt)
    }
    this.edges(body)
  }

  private shape(body: Body): Shape {
    const v = body.values
    const x = num(v.x)
    const y = num(v.y)
    const w = num(v.width, 64)
    const h = num(v.height, 64)
    return v.collision === 'circle'
      ? { kind: 'circle', x, y, r: Math.min(w, h) / 2 }
      : { kind: 'box', x, y, hw: w / 2, hh: h / 2 }
  }

  /** Keeps a body that stops or bounces at the edges inside them (after a push). */
  private keepInside(body: Body): void {
    const v = body.values
    const mode = v.edges === 'scene' || v.edges === undefined ? this.scene.values.edges : v.edges
    if (mode !== 'stop' && mode !== 'bounce') return
    const { width, height } = this.size()
    const { hw, hh } = extent(this.shape(body))
    const x = Math.max(hw, Math.min(width - hw, num(v.x)))
    const y = Math.max(hh, Math.min(height - hh, num(v.y)))
    if (x !== num(v.x) || y !== num(v.y)) this.move(body, x, y)
  }

  /** Stops, bounces or lets through at the scene's edges, and reports the edges touched. */
  private edges(body: Body): void {
    const v = body.values
    const mode = v.edges === 'scene' || v.edges === undefined ? this.scene.values.edges : v.edges
    const { width, height } = this.size()
    const { hw, hh } = extent(this.shape(body))
    let x = num(v.x)
    let y = num(v.y)
    const restitution = Math.max(0, Math.min(100, num(v.bounce, 100))) / 100
    // Bits in `EDGES` order: top, bottom, left, right.
    const touched =
      (y - hh <= 0 ? 1 : 0) |
      (y + hh >= height ? 2 : 0) |
      (x - hw <= 0 ? 4 : 0) |
      (x + hw >= width ? 8 : 0)
    if (mode === 'stop' || mode === 'bounce') {
      const bounce = mode === 'bounce'
      const vx = num(v.vx)
      const vy = num(v.vy)
      if (x - hw < 0 || x + hw > width) {
        x = Math.max(hw, Math.min(width - hw, x))
        if ((x <= hw && vx < 0) || (x >= width - hw && vx > 0)) {
          this.set(body, 'vx', bounce ? -vx * restitution : 0)
        }
      }
      if (y - hh < 0 || y + hh > height) {
        y = Math.max(hh, Math.min(height - hh, y))
        if ((y <= hh && vy < 0) || (y >= height - hh && vy > 0)) {
          this.set(body, 'vy', bounce ? -vy * restitution : 0)
        }
        if (y >= height - hh && !bounce) this.set(body, 'onGround', true)
      }
      if (x !== num(v.x) || y !== num(v.y)) this.move(body, x, y)
    }
    const begun = v.visible === false ? 0 : touched & ~body.edgesTouched
    body.edgesTouched = v.visible === false ? 0 : touched
    if (begun) {
      EDGES.forEach((edge, index) => {
        if (begun & (1 << index) && !body.deleted) {
          this.host.fire(body, body.componentId, 'edge', { edge }, edge)
        }
      })
      if (body.deleted) return
    }
    // A clone that left the scene for good disappears, so that falling objects do not pile up.
    if (
      body.clone &&
      (x + hw < -hw || x - hw > width + hw || y + hh < -height || y - hh > height + hh)
    ) {
      this.remove(body)
    }
  }

  private collides(body: Body): boolean {
    return (
      body.type === 'Sprite' &&
      !body.deleted &&
      body.values.visible !== false &&
      body.values.collision !== 'none'
    )
  }

  private touching(a: Body, b: Body): boolean {
    if (a === b || !this.collides(a) || !this.collides(b)) return false
    return overlap(this.shape(a), this.shape(b)) !== null
  }

  /**
   * Contacts between sprites: events when they start, pushes between solid ones. Sprites are
   * sorted along x and only those whose spans overlap are compared (sweep and prune).
   */
  private collide(dt: number): void {
    const entries: { body: Body; shape: Shape; min: number; max: number; hit: boolean }[] = []
    let listened = false
    let solids = 0
    for (const body of this.bodies) {
      if (!this.collides(body)) continue
      const shape = this.shape(body)
      const { hw } = extent(shape)
      const hit = this.host.listens(body.componentId, 'hit')
      const solid = body.values.solid === true
      listened ||= hit
      if (solid) solids += 1
      entries.push({ body, shape, min: shape.x - hw, max: shape.x + hw, hit: hit || solid })
    }
    if (!listened && solids < 2) {
      this.contacts.clear()
      return
    }
    entries.sort((a, b) => a.min - b.min)
    const now = new Set<number>()
    const begun: [Body, Body][] = []
    for (let i = 0; i < entries.length; i++) {
      const a = entries[i] as (typeof entries)[number]
      for (let j = i + 1; j < entries.length; j++) {
        const b = entries[j] as (typeof entries)[number]
        if (b.min > a.max) break
        if (!a.hit && !b.hit) continue
        const contact = overlap(a.shape, b.shape)
        if (!contact) continue
        const key = pairKey(a.body, b.body)
        now.add(key)
        if (!this.contacts.has(key)) begun.push([a.body, b.body])
        if (a.body.values.solid === true && b.body.values.solid === true) {
          this.separate(a.body, b.body, contact, dt)
        }
      }
    }
    this.contacts.clear()
    for (const key of now) this.contacts.add(key)
    for (const [a, b] of begun) {
      if (!a.deleted && !b.deleted)
        this.host.fire(a, a.componentId, 'hit', { other: b }, b.componentId)
      if (!a.deleted && !b.deleted)
        this.host.fire(b, b.componentId, 'hit', { other: a }, a.componentId)
    }
  }

  /**
   * Pushes two solid sprites apart and makes them bounce (J10: by their speed relative to each
   * other, so that a moving bat sets a resting puck off). A sprite that does not move is not
   * pushed (a wall), unless the other cannot be pushed (a bat steered by a joystick); one that
   * cannot be pushed never is (a platform). A sprite pushed upwards stands on the other one
   * (`onGround`), which carries it along.
   */
  private separate(
    a: Body,
    b: Body,
    hit: { nx: number; ny: number; depth: number },
    dt: number,
  ): void {
    const moving = (body: Body) =>
      num(body.values.vx) !== 0 || num(body.values.vy) !== 0 || num(body.values.gravity) !== 0
    const free = (body: Body, other: Body) =>
      body.values.pushable !== false &&
      !body.dragging &&
      (moving(body) ||
        ((other.values.pushable === false || Boolean(other.dragging)) && moving(other)))
    const ma = free(a, b)
    const mb = free(b, a)
    if (!ma && !mb) return
    const share = ma && mb ? 0.5 : 1
    for (const [body, sign, pushed] of [
      [a, -1, ma],
      [b, 1, mb],
    ] as const) {
      if (!pushed) continue
      const v = body.values
      this.move(
        body,
        num(v.x) + sign * hit.nx * hit.depth * share,
        num(v.y) + sign * hit.ny * hit.depth * share,
      )
      // A bat cannot push a puck through the edge of the table.
      this.keepInside(body)
    }
    // Speeds along the contact: they bounce if they come closer.
    const relative =
      (num(b.values.vx) - num(a.values.vx)) * hit.nx +
      (num(b.values.vy) - num(a.values.vy)) * hit.ny
    const restitution = (body: Body) =>
      Math.max(0, Math.min(100, num(body.values.bounce, 100))) / 100
    if (relative < 0) {
      const e = ma && mb ? (restitution(a) + restitution(b)) / 2 : restitution(ma ? a : b)
      const impulse = -(1 + e) * relative * share
      if (ma) {
        this.set(a, 'vx', num(a.values.vx) - impulse * hit.nx)
        this.set(a, 'vy', num(a.values.vy) - impulse * hit.ny)
      }
      if (mb) {
        this.set(b, 'vx', num(b.values.vx) + impulse * hit.nx)
        this.set(b, 'vy', num(b.values.vy) + impulse * hit.ny)
      }
    }
    // Standing on the other one: grounded, and carried by a moving platform.
    for (const [body, other, up, pushed] of [
      [a, b, hit.ny > 0.5, ma],
      [b, a, hit.ny < -0.5, mb],
    ] as const) {
      if (!pushed || !up) continue
      this.set(body, 'onGround', true)
      if (other.values.pushable === false || !free(other, body)) {
        const carryX = num(other.values.vx) * dt
        const carryY = Math.max(0, num(other.values.vy)) * dt
        if (carryX || carryY)
          this.move(body, num(body.values.x) + carryX, num(body.values.y) + carryY)
      }
    }
  }

  // Drawing

  /** Draws the world into a stage element (the running scene); returns `unmount`. */
  mount(stage: HTMLElement, assetUrl: (value: string) => string | undefined): () => void {
    this.unmount()
    this.drawingOn = stage
    this.assetUrl = assetUrl
    stage.addEventListener('pointerdown', this.onPointerDown)
    stage.addEventListener('pointermove', this.onPointerMove)
    stage.addEventListener('pointerup', this.onPointerUp)
    stage.addEventListener('pointercancel', this.onPointerUp)
    const view = stage.ownerDocument.defaultView
    if (view) {
      this.keyTarget = view as Window & typeof globalThis
      view.addEventListener('keydown', this.onKey)
      view.addEventListener('keyup', this.onKey)
      view.addEventListener('blur', this.onBlur)
    }
    for (const body of this.bodies) this.createElement(body)
    this.render(true)
    return () => {
      if (this.drawingOn === stage) this.unmount()
    }
  }

  /** The element the world draws into, if any. */
  get stage(): HTMLElement | null {
    return this.drawingOn
  }

  /** Stops drawing (the scene left the page); the game goes on. */
  unmount(): void {
    const stage = this.drawingOn
    if (!stage) return
    stage.removeEventListener('pointerdown', this.onPointerDown)
    stage.removeEventListener('pointermove', this.onPointerMove)
    stage.removeEventListener('pointerup', this.onPointerUp)
    stage.removeEventListener('pointercancel', this.onPointerUp)
    const view = this.keyTarget
    if (view) {
      view.removeEventListener('keydown', this.onKey)
      view.removeEventListener('keyup', this.onKey)
      view.removeEventListener('blur', this.onBlur)
      this.keyTarget = null
    }
    for (const body of this.bodies) {
      body.el?.remove()
      body.offset = undefined
      body.el = undefined
      body.drawn = undefined
      body.styles = undefined
    }
    this.drawingOn = null
  }

  private createElement(body: Body, before?: HTMLElement): void {
    const stage = this.drawingOn
    if (!stage || body.el) return
    const el = stage.ownerDocument.createElement('div')
    el.className = `rx-body rx-body-${body.type}`
    el.dataset.rxBody = String(body.key)
    el.dataset.rxType = body.type
    el.dataset.rxName = body.name
    if (body.clone) el.dataset.rxClone = ''
    else el.dataset.rxId = body.componentId
    if (body.type === 'Joystick') {
      const knob = stage.ownerDocument.createElement('div')
      knob.className = 'rx-joystick-knob'
      el.append(knob)
    }
    body.el = el
    body.drawn = undefined
    body.styles = undefined
    body.dirty = true
    if (before?.parentElement === stage) stage.insertBefore(el, before)
    else stage.append(el)
  }

  private interactive(body: Body): boolean {
    if (body.type === 'Joystick') return true
    if (body.type === 'Sprite' && body.values.draggable === true) return true
    const id = body.componentId
    return (
      this.host.listens(id, 'tap') ||
      (body.type === 'Sprite' && (this.host.listens(id, 'drag') || this.host.listens(id, 'drop')))
    )
  }

  /**
   * The handlers of a component changed (the app registered one): its bodies, the original and
   * its clones, take touches or let them through to what is behind, from now on. The first draw
   * happens before the app's code runs (the renderer exposes the stage first), so what it
   * computed is stale; a decorative sprite must still let a tap reach the scene.
   */
  listenersChanged(componentId: ComponentId): void {
    let changed = false
    for (const body of this.bodies) {
      if (body.componentId !== componentId || body.deleted) continue
      const touchable = this.interactive(body)
      if (body.touchable === touchable) continue
      body.touchable = touchable
      body.dirty = true
      changed = true
    }
    if (changed && this.drawingOn) this.render()
  }

  /** Writes what changed to the DOM: transforms, costumes, texts. */
  render(all = false): void {
    if (!this.drawingOn) return
    const view = this.view()
    for (const body of this.bodies) {
      const el = body.el
      if (!el) continue
      // The camera moved: every body that scrolls with it is drawn again.
      const scroll = scrollOf(body.type, body.values)
      const offset = { x: view.x * scroll, y: view.y * scroll }
      const offsetKey = `${offset.x},${offset.y}`
      if (body.offset !== offsetKey) {
        body.offset = offsetKey
        body.dirty = true
      }
      if (!body.dirty && !all) continue
      body.dirty = false
      const v = body.values
      // Only what changed reaches the DOM: a moving sprite costs one transform per frame.
      const write = (key: string, value: string) => {
        const written = body.styles ?? new Map<string, string>()
        body.styles = written
        if (!all && written.get(key) === value) return
        written.set(key, value)
        el.style.setProperty(key, value)
      }
      write('display', v.visible === false ? 'none' : '')
      write('opacity', num(v.opacity, 100) < 100 ? String(num(v.opacity, 100) / 100) : '')
      body.touchable ??= this.interactive(body)
      write('pointer-events', body.touchable ? 'auto' : 'none')
      if (body.type === 'Sprite') {
        const box = spriteStyle(v, offset)
        write('width', box.width)
        write('height', box.height)
        write('transform', box.transform)
        write('font-size', box.fontSize)
        const costume = costumeOf(v, this.assetUrl)
        const tiled = costume?.kind === 'image' && v.tiled === true
        const key = costume
          ? `${tiled ? 'tiles' : costume.kind}:${costume.kind === 'image' ? costume.src : costume.text}`
          : ''
        if (key !== body.drawn) {
          const previous = body.drawn ?? ''
          body.drawn = key
          const child = el.firstElementChild as HTMLElement | null
          // Same kind of costume: update it in place (cheaper than a new element).
          if (costume?.kind === 'glyph' && previous.startsWith('glyph:') && child) {
            child.textContent = costume.text
          } else if (
            costume?.kind === 'image' &&
            !tiled &&
            previous.startsWith('image:') &&
            child
          ) {
            ;(child as HTMLImageElement).src = costume.src
          } else el.replaceChildren()
          if (el.firstElementChild) {
            // Updated in place above.
          } else if (costume?.kind === 'image' && tiled) {
            const tiles = el.ownerDocument.createElement('span')
            tiles.className = 'rx-body-tiles'
            tiles.style.backgroundImage = `url(${JSON.stringify(costume.src)})`
            tiles.style.backgroundSize = 'auto 100%'
            tiles.style.backgroundRepeat = 'repeat-x'
            el.append(tiles)
          } else if (costume?.kind === 'image') {
            const img = el.ownerDocument.createElement('img')
            img.src = costume.src
            img.alt = ''
            img.draggable = false
            el.append(img)
          } else if (costume) {
            const glyph = el.ownerDocument.createElement('span')
            glyph.textContent = costume.text
            el.append(glyph)
          }
        }
      } else if (body.type === 'SceneText') {
        const style = sceneTextStyle(v, offset)
        write('transform', style.transform)
        write('font-size', style.fontSize)
        write('color', style.color)
        write('font-weight', style.fontWeight)
        write('text-align', style.textAlign)
        write('text-shadow', style.textShadow)
        const text = String(v.text ?? '')
        if (el.textContent !== text) el.textContent = text
      } else if (body.type === 'Joystick') {
        const style = joystickStyle(v)
        write('width', style.width)
        write('height', style.height)
        write('transform', style.transform)
        write('color', style.color)
        const knob = el.firstElementChild as HTMLElement | null
        if (knob) knob.style.transform = knobTransform(v)
      }
    }
  }

  // Touch and drag

  /** A pointer position in scene units. */
  private point(event: PointerEvent): { x: number; y: number } {
    const stage = this.drawingOn
    if (!stage) return { x: 0, y: 0 }
    const rect = stage.getBoundingClientRect()
    const width = num(this.scene.values.sceneWidth, 360)
    const height = num(this.scene.values.sceneHeight, 640)
    return {
      x: Math.round(((event.clientX - rect.left) / (rect.width || 1)) * width * 10) / 10,
      y: Math.round(((event.clientY - rect.top) / (rect.height || 1)) * height * 10) / 10,
    }
  }

  private bodyAt(target: EventTarget | null): Body | undefined {
    const el = (target as Element | null)?.closest?.('[data-rx-body]')
    const key = Number(el?.getAttribute('data-rx-body'))
    return this.bodies.find((body) => body.key === key && !body.deleted)
  }

  private joystickDirection(body: Body, point: { x: number; y: number }) {
    const reach = num(body.values.size, 120) * 0.32
    let dx = (point.x - num(body.values.x)) / reach
    let dy = (point.y - num(body.values.y)) / reach
    const length = Math.hypot(dx, dy)
    if (length > 1) {
      dx /= length
      dy /= length
    }
    return { dx: Math.round(dx * 100) / 100, dy: Math.round(dy * 100) / 100 }
  }

  /** A point of the screen in the coordinates of a body that scrolls by `scroll` (0 to 1). */
  private inLayer(point: { x: number; y: number }, scroll: number): { x: number; y: number } {
    const round = (value: number) => Math.round(value * 10) / 10
    return {
      x: round(point.x + num(this.scene.values.cameraX) * scroll),
      y: round(point.y + num(this.scene.values.cameraY) * scroll),
    }
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (!this.active) return
    const point = this.point(event)
    const body = this.bodyAt(event.target)
    const grabs =
      body?.type === 'Joystick' || (body?.type === 'Sprite' && body.values.draggable === true)
    // A finger that does not hold anything may swipe (J10).
    if (!grabs) this.swipes.set(event.pointerId, { ...point, done: false })
    if (!body) {
      const world = this.inLayer(point, 1)
      this.host.fire(null, this.sceneId, 'tap', { x: world.x, y: world.y })
      return
    }
    event.preventDefault()
    if (body && grabs) {
      ;(event.target as Element).setPointerCapture?.(event.pointerId)
      const at = this.inLayer(point, scrollOf(body.type, body.values))
      body.dragging = {
        pointer: event.pointerId,
        dx: num(body.values.x) - at.x,
        dy: num(body.values.y) - at.y,
        moved: false,
      }
      if (body.type === 'Joystick') this.steer(body, point)
    }
    if (body.type !== 'Joystick') this.host.fire(body, body.componentId, 'tap', {})
  }

  /** A finger that went far enough in one direction swipes once. */
  private swipe(event: PointerEvent): void {
    const start = this.swipes.get(event.pointerId)
    if (!start || start.done || !this.active) return
    const point = this.point(event)
    const dx = point.x - start.x
    const dy = point.y - start.y
    if (Math.hypot(dx, dy) < SWIPE_DISTANCE) return
    start.done = true
    const direction =
      Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
    this.host.fire(null, this.sceneId, 'swipe', { direction }, direction)
  }

  private onPointerMove = (event: PointerEvent): void => {
    this.swipe(event)
    const body = this.bodies.find((b) => b.dragging?.pointer === event.pointerId)
    if (!body?.dragging) return
    const point = this.inLayer(this.point(event), scrollOf(body.type, body.values))
    if (body.type === 'Joystick') {
      this.steer(body, point)
      return
    }
    body.dragging.moved = true
    body.glide?.resolve()
    body.glide = undefined
    this.move(body, point.x + body.dragging.dx, point.y + body.dragging.dy)
    this.set(body, 'vx', 0)
    this.set(body, 'vy', 0)
    this.pendingDrags.set(body.key, point)
  }

  private onPointerUp = (event: PointerEvent): void => {
    if (event.type === 'pointerup') this.swipe(event)
    this.swipes.delete(event.pointerId)
    const body = this.bodies.find((b) => b.dragging?.pointer === event.pointerId)
    if (!body?.dragging) return
    const moved = body.dragging.moved
    body.dragging = undefined
    if (body.type === 'Joystick') {
      this.set(body, 'dx', 0)
      this.set(body, 'dy', 0)
      this.pendingMoves.delete(body.key)
      this.host.fire(body, body.componentId, 'release', {})
    } else if (moved) {
      this.host.fire(body, body.componentId, 'drop', {})
    }
  }

  private steer(body: Body, point: { x: number; y: number }): void {
    const { dx, dy } = this.joystickDirection(body, point)
    this.set(body, 'dx', dx)
    this.set(body, 'dy', dy)
    this.pendingMoves.set(body.key, { body, dx, dy })
  }
}

/** Does a component type live in a game scene's world? */
export function isWorldType(type: string | undefined): boolean {
  return type === 'GameScene' || (type !== undefined && SCENE_CHILDREN.has(type))
}

/** The game scene that contains a component, if any. */
export function sceneOf(screen: Screen, componentId: ComponentId): ComponentId | undefined {
  if (screen.components[componentId]?.type === 'GameScene') return componentId
  for (const [id, node] of Object.entries(screen.components)) {
    if (node.type === 'GameScene' && node.children?.includes(componentId)) return id
  }
  return undefined
}
