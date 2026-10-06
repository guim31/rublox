import { createHash } from 'node:crypto'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import {
  APP_ICON_FILES,
  type AppBundle,
  type AppIconKey,
  type AppSettings,
  assetHashes,
  type PublishedApp,
} from '@rublox/schema'
import { and, eq } from 'drizzle-orm'
import { projects, publications, publicationVersions } from './db/schema.ts'
import { isSha256 } from './files.ts'
import type { Services } from './services.ts'
import { HASHED_PREFIX, type RuntimeConfig, serializeForScript } from './static.ts'

/** What the player page is for, written next to the origins in `rublox-config`. */
export type PlayerPage = { kind: 'app'; slug: string } | { kind: 'live'; token: string }

const NO_CACHE = 'no-cache'
const ICON_FILES = APP_ICON_FILES as Record<string, { key: AppIconKey; size: number }>

const CONFIG_TAG = /(<script\b[^>]*\bid=["']rublox-config["'][^>]*>)[\s\S]*?(<\/script>)/i

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)
}

/**
 * The player's `index.html` for a live link or a published app: the page kind next to the
 * origins, and for an app its name, language, manifest, colours and icons (SPEC § 4.6).
 */
export function renderPlayerPage(
  html: string,
  config: RuntimeConfig,
  page: PlayerPage,
  app?: { settings: AppSettings; locale: string; base: string },
): string {
  const json = serializeForScript({ studioUrl: config.studioUrl, appsUrl: config.appsUrl, page })
  let out = html.replace(CONFIG_TAG, (_m, open: string, close: string) => open + json + close)
  if (!app) return out
  const { settings, base } = app
  const name = escapeHtml(settings.name)
  const head = [
    `<title>${name}</title>`,
    `<link rel="manifest" href="${base}manifest.webmanifest" />`,
    `<meta name="theme-color" content="${escapeHtml(settings.themeColor)}" />`,
    settings.description
      ? `<meta name="description" content="${escapeHtml(settings.description)}" />`
      : '',
    `<link rel="apple-touch-icon" href="${base}apple-touch-icon.png" />`,
    '<meta name="mobile-web-app-capable" content="yes" />',
    '<meta name="apple-mobile-web-app-capable" content="yes" />',
    `<meta name="apple-mobile-web-app-title" content="${name}" />`,
    '<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
  ]
    .filter(Boolean)
    .join('\n    ')
  out = out
    .replace(/<html\b[^>]*>/i, `<html lang="${escapeHtml(app.locale)}">`)
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(
      /<link\b[^>]*rel=["']icon["'][^>]*>/i,
      `<link rel="icon" href="${base}icon-192.png" type="image/png" />`,
    )
    .replace(/<\/head>/i, `    ${head}\n  </head>`)
  return out
}

/** The web app manifest of a published app. */
export function manifestOf(app: PublishedApp, base: string) {
  const { settings, doc } = app
  const orientation = doc.settings.orientation
  return {
    id: base,
    name: settings.name,
    short_name: settings.name,
    description: settings.description || undefined,
    lang: doc.meta.locale,
    start_url: base,
    scope: base,
    display: 'standalone',
    orientation: orientation === 'any' ? 'any' : orientation,
    theme_color: settings.themeColor,
    background_color: settings.backgroundColor,
    icons: [
      { src: `${base}icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${base}icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${base}icon-maskable.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}

/**
 * The service worker of one published app, scoped to its address (SPEC § 4.6): it keeps the
 * page, the player, the project and its files for offline use. The page and the project come
 * from the network first (a new version shows up at once), the rest from the cache. When the
 * app is unpublished, the worker empties its cache and leaves.
 */
export function serviceWorkerOf(options: { base: string; cacheName: string; files: string[] }) {
  return `// Rublox: service worker of the app published at ${options.base}
const BASE = ${JSON.stringify(options.base)}
const CACHE = ${JSON.stringify(options.cacheName)}
const PREFIX = ${JSON.stringify(`rublox-app:${options.base}:`)}
const FILES = ${JSON.stringify(options.files)}
const FRESH = new Set([BASE, BASE + 'app.json', BASE + 'manifest.webmanifest'])

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

async function leave() {
  const keys = await caches.keys()
  await Promise.all(keys.filter((key) => key.startsWith(PREFIX)).map((key) => caches.delete(key)))
  await self.registration.unregister()
}

async function networkFirst(request, fallback) {
  try {
    const response = await fetch(request)
    if (response.status === 410) {
      await leave()
      return response
    }
    if (response.ok) {
      const cache = await caches.open(CACHE)
      await cache.put(fallback || request, response.clone())
    }
    return response
  } catch (error) {
    const cached = await caches.match(fallback || request)
    if (cached) return cached
    throw error
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  const url = new URL(request.url)
  if (response.ok && (url.pathname.startsWith('/_app/') || url.pathname.startsWith('/assets/'))) {
    const cache = await caches.open(CACHE)
    await cache.put(request, response.clone())
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (request.mode === 'navigate') {
    // Every page of the app is the same document.
    event.respondWith(networkFirst(request, BASE))
  } else if (FRESH.has(url.pathname)) {
    event.respondWith(networkFirst(request))
  } else if (url.pathname.startsWith(BASE) || url.pathname.startsWith('/_app/') || url.pathname.startsWith('/assets/') || url.pathname === '/favicon.svg') {
    event.respondWith(cacheFirst(request))
  }
})
`
}

type Found = {
  publicationId: string
  slug: string
  version: {
    id: string
    number: number
    settings: AppSettings
    bundle: AppBundle
    icons: Record<AppIconKey, string>
  }
}

/** `/a/<slug>/…` and `/live/<token>` on the apps origin. */
export class PublishedApps {
  private playerFiles: { stamp: string; html: string; files: string[]; build: string } | null = null

  constructor(
    private readonly services: Services,
    private readonly playerDist: string,
    private readonly runtimeConfig: RuntimeConfig,
  ) {}

  /** The current version of a published app; `gone` when unpublished, null when unknown. */
  private async find(slug: string): Promise<Found | 'gone' | null> {
    const { db } = this.services
    const [row] = await db
      .select({ publication: publications, deletedAt: projects.deletedAt })
      .from(publications)
      .innerJoin(projects, eq(projects.id, publications.projectId))
      .where(eq(publications.slug, slug))
    if (!row) return null
    const versionId = row.publication.currentVersionId
    if (!versionId || row.deletedAt) return 'gone'
    const [version] = await db
      .select()
      .from(publicationVersions)
      .where(
        and(
          eq(publicationVersions.id, versionId),
          eq(publicationVersions.publicationId, row.publication.id),
        ),
      )
    if (!version) return 'gone'
    return {
      publicationId: row.publication.id,
      slug,
      version: {
        id: version.id,
        number: version.number,
        settings: version.settings as AppSettings,
        bundle: version.bundle as AppBundle,
        icons: version.icons as Record<AppIconKey, string>,
      },
    }
  }

  /** The built player: its `index.html` and the files of `/_app/`, read again when rebuilt. */
  private async player() {
    const indexPath = join(this.playerDist, 'index.html')
    const info = await stat(indexPath).catch(() => null)
    if (!info) return null
    const stamp = `${info.mtimeMs}:${info.size}`
    if (this.playerFiles?.stamp === stamp) return this.playerFiles
    const html = await readFile(indexPath, 'utf8')
    const files: string[] = []
    const walk = async (dir: string) => {
      for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) await walk(full)
        else files.push(`/${relative(this.playerDist, full).split(sep).join('/')}`)
      }
    }
    await walk(join(this.playerDist, HASHED_PREFIX.slice(1, -1)))
    const build = createHash('sha256').update(html).digest('hex').slice(0, 12)
    this.playerFiles = { stamp, html, files: files.sort(), build }
    return this.playerFiles
  }

  /** The player's page and files, to export an app as a website (SPEC § 4.6). */
  async kit(): Promise<Response> {
    const player = await this.player()
    if (!player) return notFound()
    return Response.json(
      { html: player.html, files: ['/favicon.svg', ...player.files], build: player.build },
      { headers: { 'Cache-Control': NO_CACHE } },
    )
  }

  async serveLive(token: string): Promise<Response> {
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return notFound()
    const player = await this.player()
    if (!player) return notBuilt()
    return html(renderPlayerPage(player.html, this.runtimeConfig, { kind: 'live', token }))
  }

  /** `rest` is the path after `/a/<slug>/` (`''`, `install`, `app.json`…). */
  async serveApp(slug: string, rest: string): Promise<Response> {
    const found = await this.find(slug)
    const base = `/a/${slug}/`
    const page = rest === '' || rest === 'install'
    if (found === null) return page ? gonePage(404) : notFound()
    if (found === 'gone')
      return page ? gonePage(410) : Response.json({ error: 'gone' }, { status: 410 })
    const { version } = found
    const app: PublishedApp = {
      appId: found.publicationId,
      slug,
      version: version.number,
      settings: version.settings,
      doc: version.bundle.doc,
      code: version.bundle.code,
    }
    if (page) {
      const player = await this.player()
      if (!player) return notBuilt()
      return html(
        renderPlayerPage(
          player.html,
          this.runtimeConfig,
          { kind: 'app', slug },
          {
            settings: version.settings,
            locale: app.doc.meta.locale,
            base,
          },
        ),
      )
    }
    if (rest === 'app.json') {
      return Response.json(app, { headers: { 'Cache-Control': NO_CACHE } })
    }
    if (rest === 'manifest.webmanifest') {
      return new Response(JSON.stringify(manifestOf(app, base)), {
        headers: {
          'Content-Type': 'application/manifest+json; charset=utf-8',
          'Cache-Control': NO_CACHE,
        },
      })
    }
    if (rest === 'sw.js') {
      const player = await this.player()
      if (!player) return notFound()
      const files = [
        base,
        `${base}app.json`,
        `${base}manifest.webmanifest`,
        ...Object.keys(ICON_FILES).map((name) => `${base}${name}`),
        '/favicon.svg',
        ...player.files,
        ...assetHashes(app.doc).map((hash) => `/assets/${hash}`),
      ]
      const cacheName = `rublox-app:${base}:${version.id}:${player.build}`
      return new Response(serviceWorkerOf({ base, cacheName, files }), {
        headers: {
          'Content-Type': 'text/javascript; charset=utf-8',
          'Cache-Control': NO_CACHE,
        },
      })
    }
    const icon = ICON_FILES[rest]
    if (icon) {
      const hash = version.icons[icon.key]
      const bytes = hash && isSha256(hash) ? await this.services.files.read(hash) : null
      if (!bytes) return notFound()
      return new Response(bytes, {
        headers: { 'Content-Type': 'image/png', 'Cache-Control': NO_CACHE },
      })
    }
    return notFound()
  }
}

function html(body: string): Response {
  return new Response(body, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': NO_CACHE },
  })
}

function notFound(): Response {
  return Response.json({ error: 'not_found' }, { status: 404 })
}

function notBuilt(): Response {
  return new Response('The player is not built: run `pnpm build`.', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

/** A small page in both languages: the app does not exist, or is no longer published. */
function gonePage(status: 404 | 410): Response {
  const [fr, en] =
    status === 410
      ? ['Cette appli n’est plus publiée.', 'This app is no longer published.']
      : ['Cette appli n’existe pas.', 'This app does not exist.']
  const body = `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><title>Rublox</title><style>body{font:16px/1.5 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;box-sizing:border-box;text-align:center}p{margin:4px}p+p{opacity:.7}</style><main><p>${fr}</p><p lang="en">${en}</p></main></html>`
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
