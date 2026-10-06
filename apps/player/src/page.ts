/** What this page of the apps origin shows. */
export type Page =
  | { kind: 'preview' }
  | { kind: 'live'; token: string }
  | { kind: 'app'; slug: string; install: boolean }
  | { kind: 'site' }

type ConfigPage = { kind?: string; slug?: string; token?: string }

/**
 * The page kind: written by the server next to the origins (`rublox-config`), or read from
 * the address (the Vite dev server serves the same `index.html` everywhere).
 */
export function readPage(doc: Document = document, location: Location = window.location): Page {
  let page: ConfigPage = {}
  try {
    const text = doc.getElementById('rublox-config')?.textContent
    page = ((text ? JSON.parse(text) : {}) as { page?: ConfigPage }).page ?? {}
  } catch {
    // The address decides.
  }
  if (page.kind === 'site') return { kind: 'site' }
  const app = /^\/a\/([a-z0-9-]{3,40})\/(install)?$/.exec(location.pathname)
  if (app?.[1]) return { kind: 'app', slug: app[1], install: app[2] === 'install' }
  const live = /^\/live\/([A-Za-z0-9_-]{16,64})\/?$/.exec(location.pathname)
  if (live?.[1]) return { kind: 'live', token: live[1] }
  return { kind: 'preview' }
}

/** A short name for this device, shown in the editor: `iPhone · Safari`. */
export function deviceLabel(userAgent: string = navigator.userAgent): string {
  const ua = userAgent
  const device = /iPad/.test(ua)
    ? 'iPad'
    : /iPhone|iPod/.test(ua)
      ? 'iPhone'
      : /Android/.test(ua)
        ? 'Android'
        : /Macintosh|Mac OS X/.test(ua)
          ? navigator.maxTouchPoints > 1
            ? 'iPad'
            : 'Mac'
          : /Windows/.test(ua)
            ? 'Windows'
            : /CrOS/.test(ua)
              ? 'Chromebook'
              : /Linux/.test(ua)
                ? 'Linux'
                : '?'
  const browser = /SamsungBrowser/.test(ua)
    ? 'Samsung Internet'
    : /Edg\//.test(ua)
      ? 'Edge'
      : /Firefox|FxiOS/.test(ua)
        ? 'Firefox'
        : /Chrome|CriOS|Chromium/.test(ua)
          ? 'Chrome'
          : /Safari/.test(ua)
            ? 'Safari'
            : ''
  return browser ? `${device} · ${browser}` : device
}

/** Opened from the home screen, as an installed app. */
export function isStandalone(): boolean {
  return (
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}
