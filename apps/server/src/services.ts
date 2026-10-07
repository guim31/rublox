import type { Logger } from 'pino'
import { type Auth, createAuth } from './auth.ts'
import { Collab } from './collab.ts'
import type { Config } from './config.ts'
import type { Database } from './db/index.ts'
import { FileStore } from './files.ts'
import { FailureGuard } from './guard.ts'
import { LiveHub } from './live.ts'
import { MB, SettingsStore } from './settings.ts'

export type ServiceConfig = Pick<
  Config,
  'studioUrl' | 'appsUrl' | 'secret' | 'trustProxy' | 'maxUploadBytes' | 'dataDir'
>

/** What the routes share: database, Better Auth, files, settings, brute-force guard. */
export interface Services {
  db: Database
  auth: Auth
  config: ServiceConfig
  files: FileStore
  settings: SettingsStore
  guard: FailureGuard
  /** "Test on my phone": the relay between editors and phones (J4). */
  live: LiveHub
  /** The live project documents (Hocuspocus, `/ws/collab`). */
  collab: Collab
  logger?: Pick<Logger, 'debug' | 'info' | 'warn' | 'error'>
}

export function createServices(
  db: Database,
  config: ServiceConfig,
  logger?: Services['logger'],
): Services {
  const auth = createAuth(db, config, logger)
  return {
    db,
    auth,
    config,
    files: new FileStore(config.dataDir),
    settings: new SettingsStore(db, {
      instanceName: 'Rublox',
      galleryEnabled: true,
      aiEnabled: false,
      aiDailyQuota: 50,
      maxUploadMb: config.maxUploadBytes / MB,
      storageQuotaMb: 500,
    }),
    guard: new FailureGuard(),
    live: new LiveHub({ db, auth, config, logger }),
    collab: new Collab({ db, auth, config, logger }),
    logger,
  }
}
