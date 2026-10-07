import type { ComponentId, Locale, Screen } from '@rublox/schema'
import type { FrameClock } from './clock.ts'
import { type Body, World, type WorldHost } from './world.ts'

/** The game scenes of one open screen, each with its world. */
export class GameInstance {
  readonly worlds = new Map<ComponentId, World>()

  constructor(
    screen: Screen,
    private readonly locale: Locale,
    private readonly host: WorldHost,
    private readonly clock: FrameClock,
  ) {
    this.sync(screen)
  }

  static needed(screen: Screen | undefined): boolean {
    return Boolean(
      screen && Object.values(screen.components).some((node) => node.type === 'GameScene'),
    )
  }

  /** Follows the project: scenes added or removed, their children edited. */
  sync(screen: Screen): void {
    for (const [id, world] of this.worlds) {
      if (screen.components[id]?.type !== 'GameScene') {
        world.dispose()
        this.worlds.delete(id)
      }
    }
    for (const [id, node] of Object.entries(screen.components)) {
      if (node.type !== 'GameScene') continue
      const world = this.worlds.get(id)
      if (world) world.sync(screen)
      else {
        const created = new World(id, screen, this.locale, this.host, this.clock)
        this.worlds.set(id, created)
        if (this.active) created.activate()
      }
    }
  }

  /** The world holding a component (a scene, or a child of one). */
  worldOf(componentId: ComponentId): World | undefined {
    for (const world of this.worlds.values()) if (world.has(componentId)) return world
    return undefined
  }

  /** The body of a component as the project has it (not a clone). */
  bodyOf(componentId: ComponentId): { world: World; body: Body } | undefined {
    const world = this.worldOf(componentId)
    const body = world?.original(componentId)
    return world && body ? { world, body } : undefined
  }

  private active = false

  activate(): void {
    this.active = true
    for (const world of this.worlds.values()) world.activate()
  }

  deactivate(): void {
    this.active = false
    for (const world of this.worlds.values()) world.deactivate()
  }

  dispose(): void {
    this.active = false
    for (const world of this.worlds.values()) world.dispose()
    this.worlds.clear()
  }
}
