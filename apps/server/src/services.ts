import type { DataCredential } from '@rublox/schema'
import type { Logger } from 'pino'
import { type AiClient, AnthropicAiClient } from './ai/client.ts'
import { AiService } from './ai/service.ts'
import { type Auth, createAuth } from './auth.ts'
import { Collab } from './collab.ts'
import type { Config } from './config.ts'
import { type DataSource, resolveCredential } from './data/credentials.ts'
import { Relay, type RelayOptions } from './data/relay.ts'
import { SecretStore, Tickets } from './data/secrets.ts'
import { SharedData, SharedHub } from './data/shared.ts'
import type { Database } from './db/index.ts'
import { FileStore } from './files.ts'
import { FailureGuard } from './guard.ts'
import { LiveHub } from './live.ts'
import { MB, SettingsStore } from './settings.ts'

export type ServiceConfig = Pick<
  Config,
  'studioUrl' | 'appsUrl' | 'secret' | 'trustProxy' | 'maxUploadBytes' | 'dataDir'
> &
  Partial<Pick<Config, 'ai'>>

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
  /** Data and services (J5): secrets, preview tickets, the API relay, shared data. */
  secrets: SecretStore
  tickets: Tickets
  relay: Relay
  shared: SharedData
  sharedHub: SharedHub
  /** What an app shows to use the relay or the shared data (`data/credentials.ts`). */
  resolveData(credential: DataCredential): Promise<DataSource | null>
  /** The AI assistant (J6): null without `ANTHROPIC_API_KEY`, and then invisible. */
  ai: AiService | null
  logger?: Pick<Logger, 'debug' | 'info' | 'warn' | 'error'>
}

export function createServices(
  db: Database,
  config: ServiceConfig,
  logger?: Services['logger'],
  options: { relay?: RelayOptions; aiClient?: AiClient } = {},
): Services {
  const auth = createAuth(db, config, logger)
  const settings = new SettingsStore(db, {
    instanceName: 'Rublox',
    galleryEnabled: true,
    aiEnabled: false,
    aiDailyQuota: 50,
    maxUploadMb: config.maxUploadBytes / MB,
    storageQuotaMb: 500,
  })
  // A client given by the tests wins; otherwise the key turns the real one on.
  const aiClient = options.aiClient ?? (config.ai ? new AnthropicAiClient(config.ai) : null)
  const collab = new Collab({ db, auth, config, logger })
  const secrets = new SecretStore(db, config.secret)
  const tickets = new Tickets(config.secret)
  const resolveData = (credential: DataCredential) =>
    resolveCredential({ db, collab, tickets, secret: config.secret }, credential)
  const shared = new SharedData(db)
  return {
    db,
    auth,
    config,
    files: new FileStore(config.dataDir),
    settings,
    guard: new FailureGuard(),
    live: new LiveHub({ db, auth, config, logger }),
    collab,
    secrets,
    tickets,
    relay: new Relay((projectId, names) => secrets.values(projectId, names), options.relay),
    shared,
    sharedHub: new SharedHub(shared, resolveData, config.appsUrl, logger),
    resolveData,
    ai: aiClient ? new AiService({ db, settings, client: aiClient }) : null,
    logger,
  }
}
