import type { CanvasHandle, LottieHandle, VideoHandle } from '../components/media-handles.ts'
import { failedMessage, noSourceMessage } from './device.ts'
import type { Behavior, BehaviorContext } from './types.ts'

const num = (value: unknown, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

// Timer

type TimerState = { handle?: ReturnType<typeof setTimeout>; repeat: boolean }
const timers = new WeakMap<BehaviorContext, TimerState>()

function stopTimer(ctx: BehaviorContext) {
  const state = timers.get(ctx)
  if (state?.handle !== undefined) {
    if (state.repeat) clearInterval(state.handle)
    else clearTimeout(state.handle)
  }
  timers.delete(ctx)
  if (ctx.alive()) ctx.set('running', false)
}

function startTimer(ctx: BehaviorContext) {
  stopTimer(ctx)
  const ms = Math.max(50, num(ctx.get('interval'), 1) * 1000)
  const repeat = ctx.get('repeat') !== false
  const tick = () => {
    if (!ctx.alive()) return stopTimer(ctx)
    const count = num(ctx.get('ticks')) + 1
    ctx.set('ticks', count)
    ctx.emit('tick', { count })
    if (!repeat) stopTimer(ctx)
  }
  timers.set(ctx, { handle: repeat ? setInterval(tick, ms) : setTimeout(tick, ms), repeat })
  ctx.set('running', true)
}

export const timerBehavior: Behavior = {
  mount: (ctx) => {
    ctx.onDispose(() => stopTimer(ctx))
    if (ctx.get('autostart') !== false) startTimer(ctx)
  },
  methods: {
    start: (ctx) => startTimer(ctx),
    stop: (ctx) => stopTimer(ctx),
  },
}

// Sound

const sounds = new WeakMap<BehaviorContext, { audio: HTMLAudioElement; src: string }>()

function audioOf(ctx: BehaviorContext): HTMLAudioElement | null {
  const src = String(ctx.get('src') ?? '')
  const url = src ? ctx.assetUrl(src) : undefined
  if (!url) {
    ctx.fail(noSourceMessage(ctx))
    return null
  }
  let entry = sounds.get(ctx)
  if (!entry || entry.src !== url) {
    entry?.audio.pause()
    const audio = new Audio(url)
    audio.addEventListener('ended', () => {
      if (!ctx.alive()) return
      ctx.set('playing', false)
      ctx.emit('ended')
    })
    audio.addEventListener('pause', () => ctx.alive() && ctx.set('playing', false))
    audio.addEventListener('play', () => ctx.alive() && ctx.set('playing', true))
    entry = { audio, src: url }
    sounds.set(ctx, entry)
    ctx.onDispose(() => audio.pause())
  }
  entry.audio.volume = Math.min(1, Math.max(0, num(ctx.get('volume'), 100) / 100))
  entry.audio.loop = ctx.get('loop') === true
  return entry.audio
}

async function playSound(ctx: BehaviorContext, untilDone: boolean) {
  const audio = audioOf(ctx)
  if (!audio) return
  audio.currentTime = 0
  try {
    await audio.play()
  } catch (error) {
    ctx.fail(failedMessage(ctx, error))
    return
  }
  if (untilDone && !audio.loop) {
    await new Promise<void>((resolve) => {
      audio.addEventListener('ended', () => resolve(), { once: true })
      audio.addEventListener('pause', () => resolve(), { once: true })
      ctx.onDispose(resolve)
    })
  }
}

export const soundBehavior: Behavior = {
  methods: {
    play: (ctx) => {
      void playSound(ctx, false)
    },
    playUntilDone: (ctx) => playSound(ctx, true),
    pause: (ctx) => sounds.get(ctx)?.audio.pause(),
    stop: (ctx) => {
      const audio = sounds.get(ctx)?.audio
      if (!audio) return
      audio.pause()
      audio.currentTime = 0
    },
  },
}

// Video, Lottie, web page: through what their renderer exposes

export const videoBehavior: Behavior = {
  methods: {
    play: async (ctx) => {
      const video = ctx.handle<VideoHandle>()?.element()
      if (!video) return ctx.fail(noSourceMessage(ctx))
      try {
        await video.play()
      } catch (error) {
        ctx.fail(failedMessage(ctx, error))
      }
    },
    pause: (ctx) => ctx.handle<VideoHandle>()?.element()?.pause(),
    stop: (ctx) => {
      const video = ctx.handle<VideoHandle>()?.element()
      if (!video) return
      video.pause()
      video.currentTime = 0
    },
  },
}

export const lottieBehavior: Behavior = {
  methods: {
    play: (ctx) => ctx.handle<LottieHandle>()?.animation()?.play(),
    pause: (ctx) => ctx.handle<LottieHandle>()?.animation()?.pause(),
    stop: (ctx) => ctx.handle<LottieHandle>()?.animation()?.stop(),
  },
}

export const webViewBehavior: Behavior = {
  methods: {
    reload: (ctx) => ctx.handle<{ reload(): void }>()?.reload(),
  },
}

export const canvasBehavior: Behavior = {
  methods: {
    clear: (ctx) => ctx.handle<CanvasHandle>()?.clear(),
    drawLine: (ctx, x1, y1, x2, y2) =>
      ctx.handle<CanvasHandle>()?.line(num(x1), num(y1), num(x2), num(y2)),
    drawCircle: (ctx, x, y, r) => ctx.handle<CanvasHandle>()?.circle(num(x), num(y), num(r, 10)),
    drawRect: (ctx, x, y, w, h) =>
      ctx.handle<CanvasHandle>()?.rect(num(x), num(y), num(w, 10), num(h, 10)),
    drawText: (ctx, text, x, y) =>
      ctx.handle<CanvasHandle>()?.text(text == null ? '' : String(text), num(x), num(y)),
    getImage: (ctx) => ctx.handle<CanvasHandle>()?.image() ?? '',
  },
}

// Lists: methods change the `items` property

function listOf(ctx: BehaviorContext): unknown[] {
  const items = ctx.get('items')
  return Array.isArray(items) ? [...items] : []
}

function removeAt(ctx: BehaviorContext, index: unknown) {
  const items = listOf(ctx)
  const at = Math.round(num(index)) - 1
  if (at >= 0 && at < items.length) items.splice(at, 1)
  ctx.set('items', items)
}

export const listViewBehavior: Behavior = {
  methods: {
    addItem: (ctx, item) => ctx.set('items', [...listOf(ctx), item == null ? '' : String(item)]),
    removeItem: removeAt,
    clear: (ctx) => ctx.set('items', []),
  },
}

const text = (value: unknown) => (value == null ? '' : String(value))

export const dataListBehavior: Behavior = {
  methods: {
    addItem: (ctx, title, subtitle, image) =>
      ctx.set('items', [
        ...listOf(ctx),
        { title: text(title), subtitle: text(subtitle), image: text(image) },
      ]),
    removeItem: removeAt,
    clear: (ctx) => ctx.set('items', []),
  },
}

export const dataGridBehavior: Behavior = {
  methods: {
    addItem: (ctx, title, image) =>
      ctx.set('items', [...listOf(ctx), { title: text(title), subtitle: '', image: text(image) }]),
    removeItem: removeAt,
    clear: (ctx) => ctx.set('items', []),
  },
}
