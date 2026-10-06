import { readFile, stat } from 'node:fs/promises'
import { extname, join, sep } from 'node:path'

/** Directory where both Vite builds put their hashed files (`build.assetsDir`). */
export const HASHED_PREFIX = '/_app/'

const IMMUTABLE = 'public, max-age=31536000, immutable'
const NO_CACHE = 'no-cache'

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.lottie': 'application/zip',
}

export function contentTypeFor(path: string): string {
  return CONTENT_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream'
}

/** Values injected into `<script id="rublox-config">` of every served `index.html`. */
export interface RuntimeConfig {
  studioUrl: string
  appsUrl: string
}

const CONFIG_TAG = /(<script\b[^>]*\bid=["']rublox-config["'][^>]*>)[\s\S]*?(<\/script>)/i

/** JSON safe to embed in an HTML `<script>` element. */
export function serializeForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

/** Replaces the JSON of the `rublox-config` tag. Returns null when the tag is missing. */
export function injectRuntimeConfig(html: string, config: RuntimeConfig): string | null {
  if (!CONFIG_TAG.test(html)) return null
  const json = serializeForScript({ studioUrl: config.studioUrl, appsUrl: config.appsUrl })
  return html.replace(CONFIG_TAG, (_match, open: string, close: string) => open + json + close)
}

export interface StaticSiteOptions {
  /** Absolute path of a Vite `dist` folder. */
  root: string
  runtimeConfig: RuntimeConfig
  /** Shown when the dist folder is missing (development: Vite serves the UI). */
  missingMessage: string
  onWarning?: (message: string) => void
}

/** Serves a built single-page application: static files, SPA fallback, config injection. */
export class StaticSite {
  readonly root: string
  private readonly runtimeConfig: RuntimeConfig
  private readonly missingMessage: string
  private readonly onWarning: (message: string) => void
  private readonly htmlCache = new Map<string, { mtimeMs: number; body: string }>()

  constructor(options: StaticSiteOptions) {
    this.root = options.root
    this.runtimeConfig = options.runtimeConfig
    this.missingMessage = options.missingMessage
    this.onWarning = options.onWarning ?? (() => {})
  }

  /** Answers a GET/HEAD request for `pathname` (still URL-encoded). */
  async serve(pathname: string): Promise<Response> {
    const relative = safeRelativePath(pathname)
    if (relative === null) return notFound()

    if (relative !== '') {
      const filePath = join(this.root, relative)
      const info = await statFile(filePath)
      if (info) return this.fileResponse(filePath, info.mtimeMs, pathname)
    }

    // Missing hashed files and other file-like paths are real 404s, not SPA routes.
    if (pathname.startsWith(HASHED_PREFIX) || extname(relative) !== '') return notFound()
    return this.index()
  }

  /** The SPA entry point, with the runtime config injected. */
  async index(): Promise<Response> {
    const filePath = join(this.root, 'index.html')
    const info = await statFile(filePath)
    if (!info) return this.missingPage()
    return this.fileResponse(filePath, info.mtimeMs, '/index.html')
  }

  private async fileResponse(filePath: string, mtimeMs: number, pathname: string) {
    const headers = new Headers({ 'Content-Type': contentTypeFor(filePath) })
    if (filePath.endsWith('.html')) {
      headers.set('Cache-Control', NO_CACHE)
      return new Response(await this.html(filePath, mtimeMs), { headers })
    }
    headers.set('Cache-Control', pathname.startsWith(HASHED_PREFIX) ? IMMUTABLE : NO_CACHE)
    return new Response(new Uint8Array(await readFile(filePath)), { headers })
  }

  private async html(filePath: string, mtimeMs: number): Promise<string> {
    const cached = this.htmlCache.get(filePath)
    if (cached && cached.mtimeMs === mtimeMs) return cached.body
    const raw = await readFile(filePath, 'utf8')
    let body = injectRuntimeConfig(raw, this.runtimeConfig)
    if (body === null) {
      this.onWarning(`${filePath} has no <script id="rublox-config"> tag`)
      body = raw
    }
    this.htmlCache.set(filePath, { mtimeMs, body })
    return body
  }

  private missingPage(): Response {
    const body = `<!doctype html><meta charset="utf-8"><title>Rublox</title><p>${escapeHtml(this.missingMessage)}</p>`
    return new Response(body, {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }
}

/**
 * Decodes a URL path into a relative file path inside the dist folder, or null when it could
 * escape it (`..`, encoded separators, NUL bytes) or targets a hidden file.
 */
export function safeRelativePath(pathname: string): string | null {
  let decoded: string
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }
  if (decoded.includes('\0') || decoded.includes('\\')) return null
  const segments = decoded.split('/').filter((segment) => segment !== '')
  for (const segment of segments) {
    if (segment.startsWith('.')) return null
  }
  return segments.join(sep)
}

async function statFile(filePath: string) {
  try {
    const info = await stat(filePath)
    return info.isFile() ? info : null
  } catch {
    return null
  }
}

function notFound(): Response {
  return Response.json({ error: 'not_found' }, { status: 404 })
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)
}
