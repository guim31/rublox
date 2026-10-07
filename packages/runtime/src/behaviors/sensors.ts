import { componentLabel } from '@rublox/catalog'
import { deniedMessage, nav, report } from './device.ts'
import type { Behavior, BehaviorContext } from './types.ts'

const label = (ctx: BehaviorContext) => componentLabel(ctx.type, ctx.locale)

// Location

const watches = new WeakMap<BehaviorContext, number>()

function applyPosition(ctx: BehaviorContext, position: GeolocationPosition) {
  if (!ctx.alive()) return
  const { latitude, longitude, accuracy } = position.coords
  ctx.set('latitude', latitude)
  ctx.set('longitude', longitude)
  ctx.set('accuracy', Math.round(accuracy))
  ctx.emit('change', { latitude, longitude, accuracy: Math.round(accuracy) })
}

function geolocation(ctx: BehaviorContext): Geolocation | null {
  const geo = nav()?.geolocation
  if (!geo) report(ctx, { name: 'NotSupportedError' }, 'location', label(ctx))
  return geo ?? null
}

function stopWatching(ctx: BehaviorContext) {
  const id = watches.get(ctx)
  if (id !== undefined) nav()?.geolocation?.clearWatch(id)
  watches.delete(ctx)
}

function startWatching(ctx: BehaviorContext) {
  const geo = geolocation(ctx)
  if (!geo || watches.has(ctx)) return
  watches.set(
    ctx,
    geo.watchPosition(
      (position) => applyPosition(ctx, position),
      (error) => report(ctx, error, 'location', label(ctx)),
      { enableHighAccuracy: ctx.get('highAccuracy') !== false, maximumAge: 5000 },
    ),
  )
}

export const locationBehavior: Behavior = {
  available: () => Boolean(nav()?.geolocation),
  mount: (ctx) => {
    ctx.onDispose(() => stopWatching(ctx))
    if (ctx.get('watch') === true) startWatching(ctx)
  },
  methods: {
    update: (ctx) =>
      new Promise<void>((resolve) => {
        const geo = geolocation(ctx)
        if (!geo) return resolve()
        geo.getCurrentPosition(
          (position) => {
            applyPosition(ctx, position)
            resolve()
          },
          (error) => {
            report(ctx, error, 'location', label(ctx))
            resolve()
          },
          { enableHighAccuracy: ctx.get('highAccuracy') !== false, timeout: 20000 },
        )
      }),
    start: (ctx) => startWatching(ctx),
    stop: (ctx) => stopWatching(ctx),
  },
}

// Motion: accelerometer and orientation. iOS asks for permission, from a tap.

type PermissionApi = { requestPermission?: () => Promise<'granted' | 'denied'> }
const motions = new WeakMap<BehaviorContext, () => void>()
const SHAKE = 14
const SHAKE_PAUSE_MS = 800
const CHANGE_EVERY_MS = 100

async function startMotion(ctx: BehaviorContext) {
  if (motions.has(ctx)) return
  const win = globalThis as typeof globalThis & {
    DeviceMotionEvent?: PermissionApi
    DeviceOrientationEvent?: PermissionApi
  }
  if (!win.DeviceMotionEvent && !win.DeviceOrientationEvent) {
    report(ctx, { name: 'NotSupportedError' }, 'motion', label(ctx))
    return
  }
  for (const api of [win.DeviceMotionEvent, win.DeviceOrientationEvent]) {
    if (typeof api?.requestPermission !== 'function') continue
    try {
      if ((await api.requestPermission()) !== 'granted') {
        ctx.fail(deniedMessage(ctx, 'motion'))
        return
      }
    } catch (error) {
      report(ctx, error, 'motion', label(ctx))
      return
    }
  }
  let lastShake = 0
  let lastChange = 0
  const changed = () => {
    const now = Date.now()
    if (now - lastChange < CHANGE_EVERY_MS) return
    lastChange = now
    ctx.emit('change')
  }
  const onMotion = (event: DeviceMotionEvent) => {
    const a = event.accelerationIncludingGravity
    if (!a || !ctx.alive()) return
    const x = Math.round((a.x ?? 0) * 100) / 100
    const y = Math.round((a.y ?? 0) * 100) / 100
    const z = Math.round((a.z ?? 0) * 100) / 100
    ctx.set('x', x)
    ctx.set('y', y)
    ctx.set('z', z)
    const strength = Math.abs(Math.hypot(x, y, z) - 9.81)
    const now = Date.now()
    if (strength > SHAKE && now - lastShake > SHAKE_PAUSE_MS) {
      lastShake = now
      ctx.emit('shake')
    }
    changed()
  }
  const onOrientation = (event: DeviceOrientationEvent) => {
    if (!ctx.alive()) return
    ctx.set('alpha', Math.round(event.alpha ?? 0))
    ctx.set('beta', Math.round(event.beta ?? 0))
    ctx.set('gamma', Math.round(event.gamma ?? 0))
    changed()
  }
  globalThis.addEventListener('devicemotion', onMotion)
  globalThis.addEventListener('deviceorientation', onOrientation)
  const stop = () => {
    globalThis.removeEventListener('devicemotion', onMotion)
    globalThis.removeEventListener('deviceorientation', onOrientation)
    motions.delete(ctx)
  }
  motions.set(ctx, stop)
  ctx.onDispose(stop)
}

export const motionBehavior: Behavior = {
  available: () => 'DeviceMotionEvent' in globalThis || 'DeviceOrientationEvent' in globalThis,
  methods: {
    start: (ctx) => startMotion(ctx),
    stop: (ctx) => motions.get(ctx)?.(),
  },
}

// Battery (Chromium only)

type BatteryManager = EventTarget & { level: number; charging: boolean }

export const batteryBehavior: Behavior = {
  available: () =>
    typeof (nav() as { getBattery?: unknown } | undefined)?.getBattery === 'function',
  mount: (ctx) => {
    const getBattery = (nav() as { getBattery?: () => Promise<BatteryManager> } | undefined)
      ?.getBattery
    if (!getBattery) return
    void getBattery.call(nav()).then((battery) => {
      if (!ctx.alive()) return
      const update = () => {
        if (!ctx.alive()) return
        ctx.set('level', Math.round(battery.level * 100))
        ctx.set('charging', battery.charging)
        ctx.emit('change')
      }
      update()
      battery.addEventListener('levelchange', update)
      battery.addEventListener('chargingchange', update)
      ctx.onDispose(() => {
        battery.removeEventListener('levelchange', update)
        battery.removeEventListener('chargingchange', update)
      })
    })
  },
}

// Network

export const networkBehavior: Behavior = {
  mount: (ctx) => {
    ctx.set('online', nav()?.onLine !== false)
    const online = () => {
      ctx.set('online', true)
      ctx.emit('online')
    }
    const offline = () => {
      ctx.set('online', false)
      ctx.emit('offline')
    }
    globalThis.addEventListener?.('online', online)
    globalThis.addEventListener?.('offline', offline)
    ctx.onDispose(() => {
      globalThis.removeEventListener?.('online', online)
      globalThis.removeEventListener?.('offline', offline)
    })
  },
}
