import type { ComponentId, Locale } from '@rublox/schema'

/**
 * What a component's behavior can do while the app runs: read and write its properties,
 * fire its events, reach what its renderer exposes, and clean up when its screen closes.
 */
export type BehaviorContext = {
  readonly id: ComponentId
  /** The component's name (`Minuteur1`), for messages. */
  readonly name: string
  /** Language of the messages the engine writes (the interface language). */
  readonly locale: Locale
  /** Identifies the app: stored values are kept under it (SPEC § 6.6). */
  readonly appId: string
  get(prop: string): unknown
  /** Writes a property (state ones included), validated like a block would. */
  set(prop: string, value: unknown): void
  emit(event: string, args?: Record<string, unknown>): void
  /**
   * Something went wrong (permission refused, feature missing): a warning in the console and
   * the component's `error` event, with this message.
   */
  fail(message: string): void
  /** What the renderer exposed with `useExpose` (a video element, a drawing API…). */
  handle<T>(): T | undefined
  /** URL of an asset property value (project asset, https:, blob: or data:). */
  assetUrl(value: string): string | undefined
  /** Called when the screen closes or the app stops. */
  onDispose(cleanup: () => void): void
  /** False once the screen closed or the app stopped. */
  alive(): boolean
  /** Shows a full-screen panel over the app (QR scanner…) until it answers. */
  overlay<T>(kind: string, data?: unknown): Promise<T>
}

export type Method = (ctx: BehaviorContext, ...args: unknown[]) => unknown

/**
 * How a component type behaves while the app runs, next to its React rendering. Only types
 * that do something beyond showing their properties need one.
 */
export type Behavior = {
  /** Whether the browser can do what the component needs: sets its `available` property. */
  available?: () => boolean
  /** Starts the component when its screen opens (a timer, a sensor…). */
  mount?: (ctx: BehaviorContext) => void
  /** The component's methods (`rx_<Type>_call_<method>` blocks). */
  methods?: Record<string, Method>
}
