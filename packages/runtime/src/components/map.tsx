import { messages } from '@rublox/i18n'
import type { RowObject } from '@rublox/schema'
import { useEffect, useRef, useState } from 'react'
import { AppIcon } from '../icons.tsx'
import { boundItems } from './bound.ts'
import { canDrawMaps, loadMapLibre, MAP_STYLES } from './map-loader.ts'
import { type Renderer, type RendererProps, rootAttributes } from './types.ts'

export type MapMarker = {
  latitude: number
  longitude: number
  title: string
  row: RowObject | null
}

function coordinate(value: unknown): number | null {
  const n = Number(String(value ?? '').replace(',', '.'))
  return String(value ?? '').trim() !== '' && Number.isFinite(n) ? n : null
}

/** Markers: the rows of the bound table (J5), or the component's own list. */
export function mapMarkers(p: RendererProps): MapMarker[] {
  const bound = boundItems(p, ['latitude', 'longitude', 'title'])
  const items: (Record<string, unknown> & { row: RowObject | null })[] = bound
    ? bound.map((item) => ({ ...item.fields, row: item.row.object }))
    : Array.isArray(p.props.markers)
      ? (p.props.markers as Record<string, unknown>[]).map((item) => ({ ...item, row: null }))
      : []
  const markers: MapMarker[] = []
  for (const item of items.slice(0, 500)) {
    const latitude = coordinate(item.latitude)
    const longitude = coordinate(item.longitude)
    if (latitude === null || longitude === null) continue
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) continue
    markers.push({
      latitude,
      longitude,
      title: String(item.title ?? ''),
      row: (item.row as RowObject | null) ?? null,
    })
  }
  return markers
}

const num = (value: unknown, fallback: number) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/**
 * The Map component (SPEC § 4.5). In the app, a MapLibre map with OpenFreeMap's tiles; on the
 * editor's canvas, a drawing of it (no tiles fetched while designing, no WebGL context per
 * thumbnail).
 */
export const MapRenderer: Renderer = (p) => {
  if (p.design) return <MapSketch p={p} />
  return <LiveMap p={p} />
}

/** Where markers sit in the sketch (0 to 1), spread over their bounding box. */
function sketchPositions(markers: MapMarker[]): { x: number; y: number }[] {
  if (!markers.length) return []
  const lats = markers.map((m) => m.latitude)
  const lons = markers.map((m) => m.longitude)
  const [minLat, maxLat] = [Math.min(...lats), Math.max(...lats)]
  const [minLon, maxLon] = [Math.min(...lons), Math.max(...lons)]
  const spread = (value: number, min: number, max: number) =>
    max - min < 1e-9 ? 0.5 : 0.15 + ((value - min) / (max - min)) * 0.7
  return markers.map((m) => ({
    x: spread(m.longitude, minLon, maxLon),
    y: 1 - spread(m.latitude, minLat, maxLat),
  }))
}

function MapSketch({ p }: { p: RendererProps }) {
  const markers = mapMarkers(p)
  const dark = p.props.mapStyle === 'dark'
  const center = markers.length
    ? {
        latitude: markers.reduce((sum, m) => sum + m.latitude, 0) / markers.length,
        longitude: markers.reduce((sum, m) => sum + m.longitude, 0) / markers.length,
      }
    : { latitude: num(p.props.latitude, 0), longitude: num(p.props.longitude, 0) }
  return (
    <div
      {...rootAttributes(p, 'Map')}
      className="rx-map rx-map-sketch"
      data-style={dark ? 'dark' : 'light'}
      style={p.style}
    >
      <svg viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <path d="M-10 70 C 40 50, 80 95, 210 60" className="rx-map-road" />
        <path d="M60 -10 C 70 40, 50 80, 90 130" className="rx-map-road" />
        <path d="M120 -10 L 150 130" className="rx-map-road rx-map-minor" />
        <path d="M-10 25 L 210 35" className="rx-map-road rx-map-minor" />
        <path d="M140 75 C 160 70, 180 90, 200 85 L 200 120 L 130 120 Z" className="rx-map-water" />
        <rect x="18" y="80" width="28" height="22" rx="4" className="rx-map-park" />
      </svg>
      {sketchPositions(markers).map((position, index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: markers have no identity of their own
          key={index}
          className="rx-map-sketch-pin"
          style={{ left: `${position.x * 100}%`, top: `${position.y * 100}%` }}
          title={markers[index]?.title}
        />
      ))}
      <div className="rx-map-sketch-label">
        <AppIcon name="map-pin" size={16} />
        <span>
          {center.latitude.toFixed(4)}, {center.longitude.toFixed(4)}
        </span>
        {markers.length ? (
          <span className="rx-map-count">
            {markers.length} {messages[p.locale].runtime.data.markers}
          </span>
        ) : null}
      </div>
    </div>
  )
}

type MapLibre = Awaited<ReturnType<typeof loadMapLibre>>
type MapInstance = InstanceType<MapLibre['Map']>

function LiveMap({ p }: { p: RendererProps }) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<{ lib: MapLibre; map: MapInstance } | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  // Renderer callbacks change at each render: read them through a ref (CLAUDE.md, pièges).
  const latest = useRef(p)
  latest.current = p

  const latitude = num(p.props.latitude, 48.8566)
  const longitude = num(p.props.longitude, 2.3522)
  const zoom = num(p.props.zoom, 12)
  const style = MAP_STYLES[String(p.props.mapStyle)] ?? (MAP_STYLES.liberty as string)
  const interactive = p.props.interactive !== false

  // Created once; later changes go through the effects below.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  useEffect(() => {
    let cancelled = false
    let created: MapInstance | null = null
    if (!canDrawMaps()) {
      setStatus('failed')
      return
    }
    loadMapLibre().then(
      (lib) => {
        if (cancelled || !box.current) return
        try {
          created = new lib.Map({
            container: box.current,
            style,
            center: [longitude, latitude],
            zoom,
            interactive,
            attributionControl: { compact: true },
          })
        } catch {
          setStatus('failed')
          return
        }
        map.current = { lib, map: created }
        let loaded = false
        created.on('load', () => {
          loaded = true
          if (!cancelled) setStatus('ready')
        })
        // The style could not be read (offline, blocked): say so instead of spinning.
        created.on('error', () => {
          if (!loaded && !cancelled) setStatus('failed')
        })
        created.on('click', (event) =>
          latest.current.emit('mapClick', {
            latitude: Math.round(event.lngLat.lat * 1e6) / 1e6,
            longitude: Math.round(event.lngLat.lng * 1e6) / 1e6,
          }),
        )
        // Moved by a finger: the component's centre and zoom follow.
        created.on('moveend', (event) => {
          if (!(event as { originalEvent?: unknown }).originalEvent || !created) return
          const center = created.getCenter()
          latest.current.setValue('latitude', Math.round(center.lat * 1e6) / 1e6)
          latest.current.setValue('longitude', Math.round(center.lng * 1e6) / 1e6)
          latest.current.setValue('zoom', Math.round(created.getZoom() * 10) / 10)
        })
      },
      () => !cancelled && setStatus('failed'),
    )
    return () => {
      cancelled = true
      created?.remove()
      map.current = null
    }
  }, [])

  // Centre and zoom set by blocks.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs again once the map is ready
  useEffect(() => {
    const current = map.current?.map
    if (!current) return
    const center = current.getCenter()
    const moved =
      Math.abs(center.lat - latitude) > 1e-5 ||
      Math.abs(center.lng - longitude) > 1e-5 ||
      Math.abs(current.getZoom() - zoom) > 0.05
    if (moved) current.easeTo({ center: [longitude, latitude], zoom, duration: 600 })
  }, [latitude, longitude, zoom, status])

  useEffect(() => {
    map.current?.map.setStyle(style)
  }, [style])

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs again once the map is ready
  useEffect(() => {
    const current = map.current?.map
    if (!current) return
    if (interactive) {
      current.dragPan.enable()
      current.scrollZoom.enable()
      current.touchZoomRotate.enable()
    } else {
      current.dragPan.disable()
      current.scrollZoom.disable()
      current.touchZoomRotate.disable()
    }
  }, [interactive, status])

  // Markers, drawn again when the list (or the bound table) changes.
  const markers = mapMarkers(p)
  const key = JSON.stringify(markers.map((m) => [m.latitude, m.longitude, m.title, m.row?.id]))
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands for the markers
  useEffect(() => {
    const current = map.current
    if (!current || status !== 'ready') return
    const made = markers.map((marker, index) => {
      const element = document.createElement('button')
      element.type = 'button'
      element.className = 'rx-map-marker'
      element.setAttribute('aria-label', marker.title || `${index + 1}`)
      element.title = marker.title
      element.addEventListener('click', (event) => {
        event.stopPropagation()
        latest.current.emit('markerClick', {
          index: index + 1,
          title: marker.title,
          latitude: marker.latitude,
          longitude: marker.longitude,
          row: marker.row,
        })
      })
      return new current.lib.Marker({ element, anchor: 'bottom' })
        .setLngLat([marker.longitude, marker.latitude])
        .addTo(current.map)
    })
    return () => {
      for (const marker of made) marker.remove()
    }
  }, [key, status])

  // A map with markers opens on all of them (the first time it is ready).
  const fitted = useRef(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, when the map and markers are ready
  useEffect(() => {
    const current = map.current
    if (!current || status !== 'ready' || fitted.current || markers.length === 0) return
    fitted.current = true
    if (markers.length === 1) {
      const [only] = markers
      if (only) current.map.jumpTo({ center: [only.longitude, only.latitude] })
      return
    }
    const bounds = new current.lib.LngLatBounds()
    for (const marker of markers) bounds.extend([marker.longitude, marker.latitude])
    current.map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 0 })
  }, [key, status])

  // "Show my position": a dot that follows the device.
  useEffect(() => {
    const current = map.current
    if (!current || status !== 'ready' || p.props.showLocation !== true) return
    const geo = globalThis.navigator?.geolocation
    if (!geo) return
    const element = document.createElement('span')
    element.className = 'rx-map-me'
    const dot = new current.lib.Marker({ element })
    const watch = geo.watchPosition(
      (position) =>
        dot.setLngLat([position.coords.longitude, position.coords.latitude]).addTo(current.map),
      () => dot.remove(),
      { enableHighAccuracy: true, maximumAge: 10_000 },
    )
    return () => {
      geo.clearWatch(watch)
      dot.remove()
    }
  }, [p.props.showLocation, status])

  return (
    <div {...rootAttributes(p, 'Map')} className="rx-map" style={p.style}>
      <div ref={box} className="rx-map-canvas" />
      {status !== 'ready' ? (
        <div className="rx-map-status" role="status">
          {status === 'failed' ? (
            <>
              <AppIcon name="map" size={28} />
              <span>{messages[p.locale].runtime.data.mapUnavailable}</span>
            </>
          ) : (
            <>
              <span className="rx-map-spinner" aria-hidden="true" />
              <span className="rx-sr-only">{messages[p.locale].runtime.data.mapLoading}</span>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
