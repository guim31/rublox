/**
 * MapLibre GL (BSD-3-Clause, ~300 kB gzip) is loaded only when an app shows a map. Its worker
 * is a file of the build (`?url`): MapLibre would otherwise look for it next to its own
 * module, which a bundle moves.
 */
type MapLibre = typeof import('maplibre-gl')

let loading: Promise<MapLibre> | null = null

export function loadMapLibre(): Promise<MapLibre> {
  loading ??= (async () => {
    const [lib, worker] = await Promise.all([
      import('maplibre-gl'),
      import('maplibre-gl/dist/maplibre-gl-worker.mjs?url'),
      import('maplibre-gl/dist/maplibre-gl.css'),
    ])
    lib.setWorkerUrl(new URL(worker.default, location.href).href)
    return lib
  })().catch((error: unknown) => {
    loading = null
    throw error
  })
  return loading
}

/** Vector styles of OpenFreeMap: free, without a key or an account (checked for J5). */
export const MAP_STYLES: Record<string, string> = {
  liberty: 'https://tiles.openfreemap.org/styles/liberty',
  bright: 'https://tiles.openfreemap.org/styles/bright',
  positron: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
}

/** Whether the browser can draw a map (WebGL). */
export function canDrawMaps(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}
