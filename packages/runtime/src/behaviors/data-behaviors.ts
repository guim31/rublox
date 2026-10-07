import { componentLabel } from '@rublox/catalog'
import { parseCsv } from '@rublox/schema'
import { friendlyError, RxError } from '../errors.ts'
import { report } from './device.ts'
import type { Behavior, BehaviorContext } from './types.ts'

const label = (ctx: BehaviorContext) => componentLabel(ctx.type, ctx.locale)
const list = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? (value as Record<string, unknown>[]) : []
const text = (value: unknown) => (value === null || value === undefined ? '' : String(value))

/** The Map component (J5): markers and centre are properties, the renderer follows them. */
export const mapBehavior: Behavior = {
  methods: {
    addMarker: (ctx, latitude, longitude, title) =>
      ctx.set('markers', [
        ...list(ctx.get('markers')),
        { latitude: text(latitude), longitude: text(longitude), title: text(title) },
      ]),
    clearMarkers: (ctx) => ctx.set('markers', []),
    moveTo: (ctx, latitude, longitude, zoom) => {
      ctx.set('latitude', latitude)
      ctx.set('longitude', longitude)
      if (zoom !== undefined && zoom !== null && zoom !== '') ctx.set('zoom', zoom)
    },
    centerOnMe: (ctx) =>
      new Promise<void>((resolve) => {
        const geo = globalThis.navigator?.geolocation
        if (!geo) {
          report(ctx, { name: 'NotSupportedError' }, 'location', label(ctx))
          resolve()
          return
        }
        geo.getCurrentPosition(
          (position) => {
            if (ctx.alive()) {
              ctx.set('latitude', Math.round(position.coords.latitude * 1e6) / 1e6)
              ctx.set('longitude', Math.round(position.coords.longitude * 1e6) / 1e6)
              ctx.set('zoom', 15)
            }
            resolve()
          },
          (error) => {
            report(ctx, error, 'location', label(ctx))
            resolve()
          },
          { enableHighAccuracy: true, timeout: 20_000 },
        )
      }),
  },
}

export const chartBehavior: Behavior = {
  methods: {
    addPoint: (ctx, pointLabel, value) =>
      ctx.set('points', [
        ...list(ctx.get('points')),
        { label: text(pointLabel), value: text(value) },
      ]),
    clear: (ctx) => ctx.set('points', []),
  },
}

/**
 * A published Google sheet (P2): its CSV through the relay, each line as an object keyed by
 * the first line. A failure fires the component's error event and gives an empty list.
 */
export const googleSheetBehavior: Behavior = {
  methods: {
    rows: async (ctx) => {
      const url = text(ctx.get('url')).trim()
      try {
        if (!url) throw new RxError('sheetBadUrl')
        const csv = await ctx.sheet(url)
        const [header = [], ...lines] = parseCsv(csv)
        const rows = lines.map((cells) =>
          Object.fromEntries(header.map((name, index) => [name.trim(), cells[index] ?? ''])),
        )
        if (ctx.alive()) ctx.emit('loaded')
        return rows
      } catch (error) {
        ctx.fail(friendlyError(error, ctx.locale, 'junior'))
        return []
      }
    },
  },
}
