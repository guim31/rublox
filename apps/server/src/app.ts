import { Hono } from 'hono'
import type { Logger } from 'pino'
import { createApi } from './api.ts'
import { type Config, normalizeHost } from './config.ts'
import { appsSecurityHeaders, studioSecurityHeaders } from './security.ts'
import { StaticSite } from './static.ts'

/** Path prefixes of the apps origin that later milestones will serve (SPEC § 6.7). */
export const RESERVED_APPS_PREFIXES = ['/a/', '/live/', '/assets/', '/_rx/'] as const

export interface AppDeps {
  config: Pick<Config, 'studioUrl' | 'appsUrl' | 'appsHost' | 'studioDist' | 'playerDist'>
  /** Checks that the database answers (`select 1`). */
  ping: () => Promise<void>
  logger?: Pick<Logger, 'warn' | 'error'>
}

const notFound = () => Response.json({ error: 'not_found' }, { status: 404 })

/** Raw (still percent-encoded) path of the request, so it is decoded exactly once. */
const rawPath = (url: string) => new URL(url).pathname

export function createApp({ config, ping, logger }: AppDeps) {
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

  // Studio origin: UI, API (and, from J1, session cookies).
  const studio = new Hono()
    .use(studioSecurityHeaders(config.appsUrl))
    .route('/api', createApi(config))
    .get('*', (c) => studioSite.serve(rawPath(c.req.url)))
    .all('*', () => notFound())

  // Apps origin: player, then published apps, assets and the API relay. Never any studio cookie.
  const apps = new Hono()
    .use(appsSecurityHeaders(config.studioUrl))
    .get('*', (c) => {
      const path = rawPath(c.req.url)
      if (RESERVED_APPS_PREFIXES.some((prefix) => path.startsWith(prefix))) return notFound()
      return playerSite.serve(path)
    })
    .all('*', () => notFound())

  const app = new Hono()
  app.onError((error, c) => {
    logger?.error({ err: error, path: c.req.path }, 'unhandled error')
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
