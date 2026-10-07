import type { ComponentId, Locale } from '@rublox/schema'

/**
 * What a component's behavior can do while the app runs: read and write its properties,
 * fire its events, reach what its renderer exposes, and clean up when its screen closes.
 */
export type BehaviorContext = {
  readonly id: ComponentId
  /** The component's name (`Minuteur1`), for messages. */
  readonly name: string
  /** Its catalog type (`Timer`). */
  readonly type: string
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
  /** The text of a Google sheet published as CSV, through the server's relay (J5). */
  sheet(url: string): Promise<string>
  /** The AI assistant, when the player offers it (J6): the AI component asks it. */
  readonly ai: AiProvider | undefined
}

/** A request of the AI component (J6): a text, and an image to describe. */
export type AiRequest = {
  prompt: string
  image?: { mediaType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'; data: string }
}

/** The answer: a text, a refusal of the model, or why there is none. */
export type AiReply =
  | { text: string }
  | { refused: true }
  | { error: 'unavailable' | 'quota' | 'failed' }

/**
 * How the player reaches the assistant: through the studio in the preview, through the apps
 * origin (`/_rx/ai`) for a published app or a live test.
 */
export type AiProvider = (request: AiRequest) => Promise<AiReply>

export type Method = (ctx: BehaviorContext, ...args: unknown[]) => unknown

/**
 * How a component type behaves while the app runs, next to its React rendering. Only types
 * that do something beyond showing their properties need one.
 */
export type Behavior = {
  /** Whether the browser can do what the component needs: sets its `available` property. */
  available?: (ctx: BehaviorContext) => boolean
  /** Starts the component when its screen opens (a timer, a sensor…). */
  mount?: (ctx: BehaviorContext) => void
  /** The component's methods (`rx_<Type>_call_<method>` blocks). */
  methods?: Record<string, Method>
}
