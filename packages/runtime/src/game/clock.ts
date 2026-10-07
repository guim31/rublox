/** Schedules the next frame: `requestAnimationFrame` in a browser. Returns a cancel function. */
export type FrameScheduler = (callback: (now: number) => void) => () => void

function defaultScheduler(): FrameScheduler {
  if (typeof globalThis.requestAnimationFrame === 'function') {
    return (callback) => {
      const handle = requestAnimationFrame(callback)
      return () => cancelAnimationFrame(handle)
    }
  }
  return (callback) => {
    const handle = setTimeout(() => callback(globalThis.performance?.now() ?? Date.now()), 16)
    return () => clearTimeout(handle)
  }
}

/** Longest step the physics takes: after a hiccup the game slows down instead of jumping. */
export const MAX_FRAME_SECONDS = 1 / 20

function hidden(): boolean {
  return globalThis.document?.visibilityState === 'hidden'
}

/**
 * The game's heartbeat: one call per displayed frame (60 per second on most screens) to each
 * subscriber, then the waiters of `nextFrame()` (loops that moved something). It stops while
 * nobody listens and while the page is hidden.
 */
export class FrameClock {
  private readonly subscribers = new Set<(dt: number) => void>()
  private waiters: (() => void)[] = []
  private cancel: (() => void) | null = null
  private last: number | null = null
  /** Frames run so far, for measurements. */
  frames = 0

  constructor(private readonly schedule: FrameScheduler = defaultScheduler()) {
    globalThis.document?.addEventListener?.('visibilitychange', this.onVisibility)
  }

  subscribe(callback: (dt: number) => void): () => void {
    this.subscribers.add(callback)
    this.wake()
    return () => {
      this.subscribers.delete(callback)
    }
  }

  /** Resolves at the next frame (a game loop gives way until the scene is redrawn). */
  nextFrame(): Promise<void> {
    return new Promise((resolve) => {
      this.waiters.push(resolve)
      this.wake()
    })
  }

  /** Lets every waiter go now (the app stops: they will find out and end). */
  release(): void {
    const waiters = this.waiters
    this.waiters = []
    for (const resolve of waiters) resolve()
  }

  /** Runs one frame of `dt` seconds by hand (tests). */
  step(dt: number): void {
    this.frames += 1
    const seconds = Math.min(Math.max(dt, 0), MAX_FRAME_SECONDS)
    for (const callback of [...this.subscribers]) callback(seconds)
    this.release()
  }

  dispose(): void {
    this.cancel?.()
    this.cancel = null
    this.subscribers.clear()
    this.release()
    globalThis.document?.removeEventListener?.('visibilitychange', this.onVisibility)
  }

  private wake(): void {
    if (this.cancel || hidden()) return
    this.cancel = this.schedule(this.loop)
  }

  private loop = (now: number): void => {
    this.cancel = null
    if (hidden()) {
      this.last = null
      return
    }
    const dt = this.last === null ? 1 / 60 : (now - this.last) / 1000
    this.last = now
    this.step(dt)
    if (this.subscribers.size || this.waiters.length) this.wake()
  }

  private onVisibility = (): void => {
    // Back from the background: start again from a fresh frame, without a giant step.
    this.last = null
    if (!hidden() && (this.subscribers.size || this.waiters.length)) this.wake()
  }
}
