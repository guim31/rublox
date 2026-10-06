import type { Logger } from 'pino'
import { type Auth, createAuth } from './auth.ts'
import type { Config } from './config.ts'
import type { Database } from './db/index.ts'
import { FileStore } from './files.ts'
import { FailureGuard } from './guard.ts'
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
  logger?: Pick<Logger, 'info' | 'warn' | 'error'>
}

export function createServices(
  db: Database,
  config: ServiceConfig,
  logger?: Services['logger'],
): Services {
  return {
    db,
    auth: createAuth(db, config),
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
    logger,
  }
}
