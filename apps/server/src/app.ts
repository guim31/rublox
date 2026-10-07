import { RELAY_LIMITS, RELAY_PATH, relayRequestSchema } from '@rublox/schema'
import { eq } from 'drizzle-orm'
import { type Context, Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import type { Logger } from 'pino'
import { APP_AI_MAX_BYTES, APP_AI_PATH, AppAiRelay } from './ai/app-relay.ts'
import { createApi } from './api.ts'
import { AUTH_ROUTES, CLIENT_IP_HEADER, SIGN_IN_ROUTES } from './auth.ts'
import { getClientIp } from './client-ip.ts'
import { type Config, normalizeHost } from './config.ts'
import { RELAY_STATUS, RelayFailure } from './data/relay.ts'
import { assets } from './db/schema.ts'
import { isSha256 } from './files.ts'
import { PublishedApps } from './published.ts'
import { appsSecurityHeaders, studioSecurityHeaders } from './security.ts'
import type { Services } from './services.ts'
import { HASHED_PREFIX, StaticSite } from './static.ts'

/** Path prefixes of the apps origin that later milestones will serve (SPEC § 6.7). */
export const RESERVED_APPS_PREFIXES = ['/a/', '/live/', '/assets/', '/_rx/'] as const

export interface AppDeps {
  config: Pick<Config, 'studioUrl' | 'appsUrl' | 'appsHost' | 'studioDist' | 'playerDist'>
  services: Services
  /** Checks that the database answers (`select 1`). */
  ping: () => Promise<void>
  logger?: Pick<Logger, 'warn' | 'error'>
}

/** `/a/<slug>` and `/a/<slug>/<file>`: one level only (`install`, `app.json`, icons…). */
const APP_PATH = /^\/a\/([a-z0-9-]{3,40})(?:\/([a-z0-9.-]*))?$/
const LIVE_PATH = /^\/live\/([A-Za-z0-9_-]+)\/?$/
export const PLAYER_KIT_PATH = '/_rx/kit.json'

/** Lets the studio read a file of the apps origin (`fetch` with CORS); never with cookies. */
function withStudioCors(response: Response, studioUrl: string): Response {
  const copy = new Response(response.body, response)
  copy.headers.set('Access-Control-Allow-Origin', studioUrl)
  copy.headers.append('Vary', 'Origin')
  return copy
}

const notFound = () => Response.json({ error: 'not_found' }, { status: 404 })

/** Raw (still percent-encoded) path of the request, so it is decoded exactly once. */
const rawPath = (url: string) => new URL(url).pathname

export function createApp({ config, services, ping, logger }: AppDeps) {
  const runtimeConfig = { studioUrl: config.studioUrl, appsUrl: config.appsUrl }
  const onWarning = (message: string) => logger?.warn(message)

  const studioSite = new StaticSite({
    root: config.studioDist,
    runtimeConfig,
    missingMessage:
      'The studio is not built. In development, open it through `pnpm dev`; otherwise run `pnpm build`.',
    onWarning,
  })
  const playerSite = new StaticSite({
    root: config.playerDist,
    runtimeConfig,
    missingMessage:
      'The player is not built. In development, open it through `pnpm dev`; otherwise run `pnpm build`.',
    onWarning,
  })

  // Studio origin: UI, API, session cookies.
  const studio = new Hono()
    .use(studioSecurityHeaders(config.appsUrl))
    .on(['GET', 'POST'], '/api/auth/*', (c) => handleAuth(services, c.req.raw, c))
    .route('/api', createApi(services))
    .get('*', (c) => studioSite.serve(rawPath(c.req.url)))
    .all('*', () => notFound())

  const published = new PublishedApps(services, config.playerDist, runtimeConfig)
  const appAi = new AppAiRelay(services)

  // Apps origin: player, then published apps, assets and the API relay. Never any studio cookie.
  const apps = new Hono()
    .use(appsSecurityHeaders(config.studioUrl))
    .get('/assets/:hash', (c) => serveAsset(services, c.req.param('hash')))
    // Bodies are counted as they arrive (a chunked body has no length to check first).
    .post(
      RELAY_PATH,
      bodyLimit({ maxSize: RELAY_LIMITS.maxRequestBytes + 4096, onError: tooLarge }),
      (c) => relay(services, c.req.raw, config.appsUrl),
    )
    // The AI component of published apps and live tests (J6).
    .post(APP_AI_PATH, bodyLimit({ maxSize: APP_AI_MAX_BYTES, onError: tooLarge }), (c) =>
      appAi.handle(c.req.raw, getClientIp(c, services.config.trustProxy) ?? 'unknown'),
    )
    .get('*', async (c) => {
      const path = rawPath(c.req.url)
      // Published apps (SPEC § 4.6) and live test links (§ 4.3).
      const app = APP_PATH.exec(path)
      if (app?.[1]) {
        if (app[2] === undefined) return c.redirect(`/a/${app[1]}/`, 301)
        return published.serveApp(app[1], app[2])
      }
      const live = LIVE_PATH.exec(path)
      if (live?.[1]) return published.serveLive(live[1])
      // The built player, read by the studio to export an app as a website.
      if (path === PLAYER_KIT_PATH) return withStudioCors(await published.kit(), config.studioUrl)
      if (path.startsWith(HASHED_PREFIX) || path === '/favicon.svg') {
        return withStudioCors(await playerSite.serve(path), config.studioUrl)
      }
      if (RESERVED_APPS_PREFIXES.some((prefix) => path.startsWith(prefix))) return notFound()
      return playerSite.serve(path)
    })
    .all('*', () => notFound())

  const app = new Hono()
  app.onError((error, c) => {
    // A test link carries its token in the path: never in the logs (SPEC § 0.10).
    logger?.error(
      { err: error, path: c.req.path.replace(/^\/live\/[^/]+/, '/live/…') },
      'unhandled error',
    )
    return c.json({ error: 'internal_error' }, 500)
  })

  app.get('/healthz', async (c) => {
    try {
      await ping()
      return c.json({ status: 'ok' })
    } catch (error) {
      logger?.error({ err: error }, 'health check failed')
      return c.json({ status: 'error' }, 503)
    }
  })

  app.all('*', (c) => {
    const host = c.req.header('host') ?? new URL(c.req.url).host
    const target = normalizeHost(host, new URL(config.appsUrl).protocol as 'http:' | 'https:')
    return target === config.appsHost
      ? apps.fetch(c.req.raw, c.env)
      : studio.fetch(c.req.raw, c.env)
  })

  return app
}

export type App = ReturnType<typeof createApp>

/**
 * Better Auth, behind an allowlist of endpoints (`AUTH_ROUTES`). Failed sign-ins count towards
 * the brute-force limit, and Better Auth reads the client address Rublox resolved, never
 * `X-Forwarded-For`. A route that needs a session answers 403 without one, not 401.
 */
/**
 * Better Auth routes that end sessions: `/ws/collab` checks a session only when a document is
 * opened, so the account's connections are closed and must authenticate again (SPEC § 0.10).
 */
const SESSION_ENDING_ROUTES = new Set([
  'POST /sign-out',
  'POST /revoke-session',
  'POST /revoke-other-sessions',
  'POST /change-password',
])

async function handleAuth(services: Services, raw: Request, c: Context): Promise<Response> {
  const path = new URL(raw.url).pathname.replace(/^\/api\/auth/, '')
  const key = `${raw.method} ${path}`
  if (!AUTH_ROUTES.has(key)) return notFound()
  const ip = getClientIp(c, services.config.trustProxy) ?? 'unknown'
  const signIn = SIGN_IN_ROUTES.has(key)
  if (signIn) {
    const wait = services.guard.retryAfter(ip)
    if (wait > 0) {
      return Response.json(
        { error: 'too_many_attempts' },
        { status: 429, headers: { 'Retry-After': String(wait) } },
      )
    }
  }
  const headers = new Headers(raw.headers)
  headers.delete('x-forwarded-for')
  headers.delete('x-real-ip')
  headers.set(CLIENT_IP_HEADER, ip)
  // Sessions about to end: the account's open documents authenticate again afterwards.
  const ending = SESSION_ENDING_ROUTES.has(key)
    ? await services.auth.api.getSession({ headers })
    : null
  const response = await services.auth.handler(new Request(raw, { headers }))
  if (signIn && response.status >= 400 && response.status < 500) services.guard.fail(ip)
  if (ending && response.ok) services.collab.disconnectUser(ending.user.id)
  // Only a failed sign-in may answer 401 (SPEC § 6.9): a missing session is a 403, as on /api.
  if (response.status === 401 && !signIn) {
    return Response.json({ error: 'signed_out' }, { status: 403 })
  }
  return response
}

const IMMUTABLE = 'public, max-age=31536000, immutable'

/**
 * `/assets/<sha256>` on the apps origin: uploaded files, immutable. Readable from the studio
 * (CORS) for the editor. SVG files never run scripts (SPEC § 6.9).
 */
async function serveAsset(services: Services, hash: string): Promise<Response> {
  if (!isSha256(hash)) return notFound()
  const [row] = await services.db
    .select({ mime: assets.mime })
    .from(assets)
    .where(eq(assets.sha256, hash))
    .limit(1)
  if (!row) return notFound()
  const bytes = await services.files.read(hash)
  if (!bytes) return notFound()
  const headers = new Headers({
    'Content-Type': row.mime,
    'Cache-Control': IMMUTABLE,
    'Access-Control-Allow-Origin': '*',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  })
  return new Response(bytes, { headers })
}

/**
 * `POST /_rx/proxy` on the apps origin (SPEC § 6.9): an app calls one of its API connections
 * (or reads a published Google sheet) through the server. Only from a page of the apps
 * origin, and only with a credential that names a project open in the editor, a live link or
 * a published app.
 */
const tooLarge = () => Response.json({ error: 'too_large' }, { status: 413 })

async function relay(services: Services, raw: Request, appsUrl: string): Promise<Response> {
  const refuse = (error: string, status: number) => Response.json({ error }, { status })
  if (raw.headers.get('origin') !== appsUrl) return refuse('forbidden', 403)
  const length = Number(raw.headers.get('content-length') ?? 0)
  if (length > RELAY_LIMITS.maxRequestBytes + 4096) return refuse('too_large', 413)
  let input: unknown
  try {
    const text = await raw.text()
    if (text.length > RELAY_LIMITS.maxRequestBytes + 4096) return refuse('too_large', 413)
    input = JSON.parse(text)
  } catch {
    return refuse('invalid', 400)
  }
  const parsed = relayRequestSchema.safeParse(input)
  if (!parsed.success) return refuse('invalid', 400)
  const request = parsed.data
  const source = await services.resolveData(request.credential)
  if (!source) return refuse('forbidden', 403)
  try {
    const response =
      'sheet' in request
        ? await services.relay.sheet(source, request.sheet)
        : await services.relay.call(source, request)
    return Response.json(response, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof RelayFailure) return refuse(error.code, RELAY_STATUS[error.code])
    throw error
  }
}
