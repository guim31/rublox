import { Hono } from 'hono'
import pkg from '../package.json' with { type: 'json' }
import type { Config } from './config.ts'

export const version: string = pkg.version

/** Routes mounted under `/api` on the studio origin. */
export function createApi(config: Pick<Config, 'studioUrl' | 'appsUrl'>) {
  return new Hono()
    .get('/config', (c) =>
      c.json({ studioUrl: config.studioUrl, appsUrl: config.appsUrl, version }),
    )
    .all('*', (c) => c.json({ error: 'not_found' }, 404))
}

/** Type of the API, for the typed `hc` client of the studio. */
export type Api = ReturnType<typeof createApi>
