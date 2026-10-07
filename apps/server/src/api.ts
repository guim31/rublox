import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import pkg from '../package.json' with { type: 'json' }
import { getClientIp } from './client-ip.ts'
import { type ApiEnv, fail } from './http.ts'
import { adminRoutes } from './routes/admin.ts'
import { aiRoutes } from './routes/ai.ts'
import { galleryRoutes } from './routes/gallery.ts'
import { invitesRoutes } from './routes/invites.ts'
import { meRoutes } from './routes/me.ts'
import { projectsRoutes } from './routes/projects.ts'
import { publishRoutes } from './routes/publish.ts'
import { spacesRoutes } from './routes/spaces.ts'
import type { Services } from './services.ts'
import { MB } from './settings.ts'

export const version: string = pkg.version

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/** Routes mounted under `/api` on the studio origin. */
export function createApi(services: Services) {
  const { config, auth, guard } = services
  return (
    new Hono<ApiEnv>()
      // Any request that changes something must come from the studio itself (SPEC § 6.9).
      .use(async (c, next) => {
        if (!SAFE_METHODS.has(c.req.method) && c.req.header('origin') !== config.studioUrl) {
          fail(403, 'bad_origin')
        }
        c.set('clientIp', getClientIp(c, config.trustProxy) ?? 'unknown')
        await next()
      })
      .use(bodyLimit({ maxSize: 64 * MB, onError: () => fail(413, 'too_large') }))
      .use('/invites/check', async (c, next) => {
        const wait = guard.retryAfter(c.get('clientIp'))
        if (wait > 0) {
          c.header('Retry-After', String(wait))
          fail(429, 'too_many_attempts')
        }
        await next()
      })
      .use('/invites/accept', async (c, next) => {
        const wait = guard.retryAfter(c.get('clientIp'))
        if (wait > 0) {
          c.header('Retry-After', String(wait))
          fail(429, 'too_many_attempts')
        }
        await next()
      })
      .use(async (c, next) => {
        // No session cookie, no session: spare the database.
        const signedIn = c.req.header('cookie')?.includes('session_token=') ?? false
        c.set(
          'session',
          signedIn ? await auth.api.getSession({ headers: c.req.raw.headers }) : null,
        )
        await next()
      })
      .get('/config', (c) =>
        c.json({ studioUrl: config.studioUrl, appsUrl: config.appsUrl, version }),
      )
      .route('/me', meRoutes(services))
      .route('/spaces', spacesRoutes(services))
      .route('/invites', invitesRoutes(services))
      .route('/admin', adminRoutes(services))
      .route('/projects', projectsRoutes(services))
      .route('/projects', publishRoutes(services))
      .route('/gallery', galleryRoutes(services))
      .route('/ai', aiRoutes(services))
      .all('*', (c) => c.json({ error: 'not_found' }, 404))
  )
}

/** Type of the API, for the typed `hc` client of the studio. */
export type Api = ReturnType<typeof createApi>
