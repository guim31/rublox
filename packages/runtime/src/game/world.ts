import { resolveProps, SCENE_CHILD_TYPES } from '@rublox/catalog'
import type { ComponentId, Locale, Screen } from '@rublox/schema'
import type { FrameClock } from './clock.ts'
import {
  costumeOf,
  joystickStyle,
  knobTransform,
  num,
  sceneTextStyle,
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
  edgesTouched: Set<string>
  glide?: Glide
  dragging?: { pointer: number; dx: number; dy: number; moved: boolean }
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
    args: unknown[],
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
type Edge = (typeof EDGES)[number]

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
])

const SCENE_CHILDREN = new Set<string>(SCENE_CHILD_TYPES)

function same(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b)
}

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
  private readonly contacts = new Set<string>()
  private nextKey = 1
  private started = false
  private active = false
  private disposed = false
  private unsubscribe: (() => void) | null = null
  private stage: HTMLElement | null = null
  private assetUrl: (value: string) => string | undefined = () => undefined
  private pendingDrags = new Map<number, { x: number; y: number }>()
  private pendingMove: { dx: number; dy: number; body: Body } | null = null

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
      edgesTouched: new Set(),
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
        if (this.stage) this.createElement(body)
      }
    }
    // Back to front as in the project; clones just behind their original.
    const order = new Map(children.map((id, index) => [id, index]))
    const sorted = [...this.bodies].sort((a, b) => {
      const byComponent = (order.get(a.componentId) ?? 0) - (order.get(b.componentId) ?? 0)
      if (byComponent) return byComponent
      return Number(b.clone) - Number(a.clone) || a.key - b.key
    })
    if (sorted.some((body, index) => body !== this.bodies[index])) {
      this.bodies = sorted
      if (this.stage) for (const body of sorted) if (body.el) this.stage.append(body.el)
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
    body.values[key] = value
    if (VISUAL.has(key)) {
      body.dirty = true
      this.host.redraw()
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
    const at = this.bodies.indexOf(body)
    this.bodies.splice(at < 0 ? this.bodies.length : at, 0, copy)
    if (this.stage) this.createElement(copy, body.el)
    this.host.redraw()
    this.host.fire(copy, copy.componentId, 'clone', [])
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
      const [a, b] = key.split(':').map(Number)
      if (a === body.key || b === body.key) this.contacts.delete(key)
    }
    this.pendingDrags.delete(body.key)
    this.host.redraw()
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
      this.host.fire(null, this.sceneId, 'start', [])
    }
    this.wake()
  }

  /** Another screen covers this one: the game waits. */
  deactivate(): void {
    this.active = false
    this.unsubscribe?.()
    this.unsubscribe = null
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
      for (const body of [...this.bodies]) {
        if (body.deleted) continue
        if (body.type === 'Sprite') this.integrate(body, dt)
      }
      this.collide()
      for (const [key, point] of this.pendingDrags) {
        const body = this.bodies.find((b) => b.key === key)
        if (body) this.host.fire(body, body.componentId, 'drag', [point.x, point.y])
      }
      this.pendingDrags.clear()
      if (this.pendingMove) {
        const { body, dx, dy } = this.pendingMove
        this.pendingMove = null
        this.host.fire(body, body.componentId, 'move', [dx, dy])
      }
      this.host.fire(null, this.sceneId, 'frame', [dt])
    } else {
      this.pendingDrags.clear()
    }
    this.render()
  }

  private integrate(body: Body, dt: number): void {
    const v = body.values
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

  /** Stops, bounces or lets through at the scene's edges, and reports the edges touched. */
  private edges(body: Body): void {
    const v = body.values
    const mode = v.edges === 'scene' || v.edges === undefined ? this.scene.values.edges : v.edges
    const width = num(this.scene.values.sceneWidth, 360)
    const height = num(this.scene.values.sceneHeight, 640)
    const { hw, hh } = extent(this.shape(body))
    let x = num(v.x)
    let y = num(v.y)
    const restitution = Math.max(0, Math.min(100, num(v.bounce, 100))) / 100
    const touched = new Set<Edge>()
    const limits: [Edge, boolean][] = [
      ['left', x - hw <= 0],
      ['right', x + hw >= width],
      ['top', y - hh <= 0],
      ['bottom', y + hh >= height],
    ]
    for (const [edge, out] of limits) if (out) touched.add(edge)
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
      }
      if (x !== num(v.x) || y !== num(v.y)) this.move(body, x, y)
    }
    if (v.visible !== false) {
      for (const edge of touched) {
        if (!body.edgesTouched.has(edge)) {
          this.host.fire(body, body.componentId, 'edge', [edge], edge)
          if (body.deleted) return
        }
      }
    }
    body.edgesTouched = v.visible === false ? new Set() : touched
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

  /** Contacts between sprites: events when they start, pushes between solid ones. */
  private collide(): void {
    const sprites = this.bodies.filter((body) => this.collides(body))
    const listening = new Set(
      sprites.filter((b) => this.host.listens(b.componentId, 'hit')).map((b) => b.componentId),
    )
    const anySolid = sprites.some((b) => b.values.solid === true)
    if (!listening.size && !anySolid) {
      this.contacts.clear()
      return
    }
    const now = new Set<string>()
    const begun: [Body, Body][] = []
    for (let i = 0; i < sprites.length; i++) {
      const a = sprites[i] as Body
      for (let j = i + 1; j < sprites.length; j++) {
        const b = sprites[j] as Body
        const wanted =
          listening.has(a.componentId) ||
          listening.has(b.componentId) ||
          (a.values.solid === true && b.values.solid === true)
        if (!wanted) continue
        const hit = overlap(this.shape(a), this.shape(b))
        if (!hit) continue
        const key = `${a.key}:${b.key}`
        now.add(key)
        if (!this.contacts.has(key)) begun.push([a, b])
        if (a.values.solid === true && b.values.solid === true) this.separate(a, b, hit)
      }
    }
    this.contacts.clear()
    for (const key of now) this.contacts.add(key)
    for (const [a, b] of begun) {
      if (!a.deleted && !b.deleted) this.host.fire(a, a.componentId, 'hit', [b], b.componentId)
      if (!a.deleted && !b.deleted) this.host.fire(b, b.componentId, 'hit', [a], a.componentId)
    }
  }

  /** Pushes two solid sprites apart; only those that move are pushed, and they bounce. */
  private separate(a: Body, b: Body, hit: { nx: number; ny: number; depth: number }): void {
    const moves = (body: Body) =>
      !body.dragging &&
      (num(body.values.vx) !== 0 || num(body.values.vy) !== 0 || num(body.values.gravity) !== 0)
    const ma = moves(a)
    const mb = moves(b)
    if (!ma && !mb) return
    const share = ma && mb ? 0.5 : 1
    for (const [body, sign, moving] of [
      [a, -1, ma],
      [b, 1, mb],
    ] as const) {
      if (!moving) continue
      const v = body.values
      this.move(
        body,
        num(v.x) + sign * hit.nx * hit.depth * share,
        num(v.y) + sign * hit.ny * hit.depth * share,
      )
      // Reflect the speed along the contact, if it goes into the other body.
      const vx = num(v.vx)
      const vy = num(v.vy)
      const into = (vx * hit.nx + vy * hit.ny) * sign
      if (into < 0) {
        const restitution = Math.max(0, Math.min(100, num(v.bounce, 100))) / 100
        const k = (1 + restitution) * into * sign
        this.set(body, 'vx', vx - k * hit.nx)
        this.set(body, 'vy', vy - k * hit.ny)
      }
    }
  }

  // Drawing

  /** Draws the world into a stage element (the running scene); returns `unmount`. */
  mount(stage: HTMLElement, assetUrl: (value: string) => string | undefined): () => void {
    this.unmount()
    this.stage = stage
    this.assetUrl = assetUrl
    stage.addEventListener('pointerdown', this.onPointerDown)
    stage.addEventListener('pointermove', this.onPointerMove)
    stage.addEventListener('pointerup', this.onPointerUp)
    stage.addEventListener('pointercancel', this.onPointerUp)
    for (const body of this.bodies) this.createElement(body)
    this.render(true)
    return () => {
      if (this.stage === stage) this.unmount()
    }
  }

  private unmount(): void {
    const stage = this.stage
    if (!stage) return
    stage.removeEventListener('pointerdown', this.onPointerDown)
    stage.removeEventListener('pointermove', this.onPointerMove)
    stage.removeEventListener('pointerup', this.onPointerUp)
    stage.removeEventListener('pointercancel', this.onPointerUp)
    for (const body of this.bodies) {
      body.el?.remove()
      body.el = undefined
      body.drawn = undefined
    }
    this.stage = null
  }

  private createElement(body: Body, before?: HTMLElement): void {
    const stage = this.stage
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

  /** Writes what changed to the DOM: transforms, costumes, texts. */
  render(all = false): void {
    if (!this.stage) return
    for (const body of this.bodies) {
      const el = body.el
      if (!el || (!body.dirty && !all)) continue
      body.dirty = false
      const v = body.values
      const style = el.style
      style.display = v.visible === false ? 'none' : ''
      style.opacity = num(v.opacity, 100) < 100 ? String(num(v.opacity, 100) / 100) : ''
      style.pointerEvents = this.interactive(body) ? 'auto' : 'none'
      if (body.type === 'Sprite') {
        const box = spriteStyle(v)
        style.width = box.width
        style.height = box.height
        style.transform = box.transform
        style.fontSize = box.fontSize
        const costume = costumeOf(v, this.assetUrl)
        const key = costume
          ? `${costume.kind}:${costume.kind === 'image' ? costume.src : costume.text}`
          : ''
        if (key !== body.drawn) {
          body.drawn = key
          el.replaceChildren()
          if (costume?.kind === 'image') {
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
        Object.assign(style, sceneTextStyle(v))
        const text = String(v.text ?? '')
        if (el.textContent !== text) el.textContent = text
      } else if (body.type === 'Joystick') {
        Object.assign(style, joystickStyle(v))
        const knob = el.firstElementChild as HTMLElement | null
        if (knob) knob.style.transform = knobTransform(v)
      }
    }
  }

  // Touch and drag

  /** A pointer position in scene units. */
  private point(event: PointerEvent): { x: number; y: number } {
    const stage = this.stage
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

  private onPointerDown = (event: PointerEvent): void => {
    if (!this.active) return
    const point = this.point(event)
    const body = this.bodyAt(event.target)
    if (!body) {
      this.host.fire(null, this.sceneId, 'tap', [point.x, point.y])
      return
    }
    event.preventDefault()
    if (body.type === 'Joystick' || (body.type === 'Sprite' && body.values.draggable === true)) {
      ;(event.target as Element).setPointerCapture?.(event.pointerId)
      body.dragging = {
        pointer: event.pointerId,
        dx: num(body.values.x) - point.x,
        dy: num(body.values.y) - point.y,
        moved: false,
      }
      if (body.type === 'Joystick') this.steer(body, point)
    }
    if (body.type !== 'Joystick') this.host.fire(body, body.componentId, 'tap', [])
  }

  private onPointerMove = (event: PointerEvent): void => {
    const body = this.bodies.find((b) => b.dragging?.pointer === event.pointerId)
    if (!body?.dragging) return
    const point = this.point(event)
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
    const body = this.bodies.find((b) => b.dragging?.pointer === event.pointerId)
    if (!body?.dragging) return
    const moved = body.dragging.moved
    body.dragging = undefined
    if (body.type === 'Joystick') {
      this.set(body, 'dx', 0)
      this.set(body, 'dy', 0)
      this.pendingMove = null
      this.host.fire(body, body.componentId, 'release', [])
    } else if (moved) {
      this.host.fire(body, body.componentId, 'drop', [])
    }
  }

  private steer(body: Body, point: { x: number; y: number }): void {
    const { dx, dy } = this.joystickDirection(body, point)
    this.set(body, 'dx', dx)
    this.set(body, 'dy', dy)
    this.pendingMove = { body, dx, dy }
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
