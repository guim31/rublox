import { resolve } from 'node:path'
import { z } from 'zod'
import { defaultPlayerDist, defaultStudioDist, migrationsFolder } from './paths.ts'

/** Special `DATABASE_URL` value selecting an in-memory PGlite database (tests). */
export const MEMORY_DATABASE_URL = 'memory://'

const MIN_SECRET_BYTES = 32

/** Used when `RUBLOX_SECRET` is not set, outside production only. Public: never deploy it. */
export const DEVELOPMENT_SECRET = 'rublox-development-secret-not-for-production-use'

const optionalString = z
  .string()
  .trim()
  .transform((value) => (value === '' ? undefined : value))
  .optional()

const httpOrigin = z
  .url({ protocol: /^https?$/ })
  .transform((value) => new URL(value).origin)
  .optional()

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),
  HOST: z.string().trim().min(1).default('0.0.0.0'),
  STUDIO_URL: httpOrigin,
  APPS_URL: httpOrigin,
  DATABASE_URL: optionalString.pipe(
    z
      .string()
      .refine(
        (value) => value === MEMORY_DATABASE_URL || /^postgres(ql)?:\/\//.test(value),
        `must be a postgres:// URL or ${MEMORY_DATABASE_URL}`,
      )
      .optional(),
  ),
  DATA_DIR: z.string().trim().min(1).default('./data'),
  TRUST_PROXY: z.stringbool().default(false),
  MAX_UPLOAD_MB: z.coerce.number().positive().max(10_240).default(20),
  RUBLOX_SECRET: optionalString.pipe(
    z
      .string()
      .refine(
        (value) => Buffer.byteLength(value, 'utf8') >= MIN_SECRET_BYTES,
        `must be at least ${MIN_SECRET_BYTES} bytes long`,
      )
      .optional(),
  ),
  RUBLOX_ADMIN_USERNAME: optionalString,
  RUBLOX_ADMIN_PASSWORD: optionalString,
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
  STUDIO_DIST: optionalString,
  PLAYER_DIST: optionalString,
})

export type NodeEnv = 'development' | 'production' | 'test'
export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent'

export interface Config {
  nodeEnv: NodeEnv
  isProduction: boolean
  port: number
  host: string
  /** Origin of the studio (`scheme://host[:port]`, no trailing slash). */
  studioUrl: string
  /** Origin of the apps (player, published apps). Must differ from the studio origin. */
  appsUrl: string
  /** `host[:port]` of the apps origin, compared with the request `Host` header. */
  appsHost: string
  /** PostgreSQL URL, `memory://`, or undefined for a PGlite database stored in `dataDir`. */
  databaseUrl: string | undefined
  /** Absolute path of the data directory (PGlite database, uploaded assets). */
  dataDir: string
  trustProxy: boolean
  maxUploadBytes: number
  /** Signs sessions and keys the invitation hashes. A fixed value outside production. */
  secret: string
  /** First start only: the administrator account created when the database has no account. */
  admin: { username: string; password: string } | undefined
  logLevel: LogLevel
  studioDist: string
  playerDist: string
  migrationsFolder: string
}

export class ConfigError extends Error {
  override name = 'ConfigError'
}

/**
 * Host as sent in the `Host` header: lowercase, default port removed (so `example.com:443`
 * and `example.com` compare equal for an https origin).
 */
export function normalizeHost(host: string, protocol: 'http:' | 'https:' = 'http:'): string {
  const lower = host.trim().toLowerCase()
  const defaultPort = protocol === 'https:' ? ':443' : ':80'
  return lower.endsWith(defaultPort) ? lower.slice(0, -defaultPort.length) : lower
}

/** Reads and validates the configuration from environment variables. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env)
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ')
    throw new ConfigError(`Invalid configuration: ${details}`)
  }
  const e = parsed.data
  const isDevelopment = e.NODE_ENV === 'development'
  const studioUrl =
    e.STUDIO_URL ?? (isDevelopment ? 'http://localhost:5173' : 'http://localhost:3000')
  const appsUrl = e.APPS_URL ?? (isDevelopment ? 'http://127.0.0.1:5174' : 'http://127.0.0.1:3000')
  if (studioUrl === appsUrl) {
    throw new ConfigError(
      'Invalid configuration: STUDIO_URL and APPS_URL must be different origins',
    )
  }
  const apps = new URL(appsUrl)
  if (e.NODE_ENV === 'production' && !e.RUBLOX_SECRET) {
    throw new ConfigError(
      `Invalid configuration: RUBLOX_SECRET is required in production (${MIN_SECRET_BYTES} bytes or more)`,
    )
  }
  if (Boolean(e.RUBLOX_ADMIN_USERNAME) !== Boolean(e.RUBLOX_ADMIN_PASSWORD)) {
    throw new ConfigError(
      'Invalid configuration: set both RUBLOX_ADMIN_USERNAME and RUBLOX_ADMIN_PASSWORD, or neither',
    )
  }

  return {
    nodeEnv: e.NODE_ENV,
    isProduction: e.NODE_ENV === 'production',
    port: e.PORT,
    host: e.HOST,
    studioUrl,
    appsUrl,
    appsHost: normalizeHost(apps.host, apps.protocol as 'http:' | 'https:'),
    databaseUrl: e.DATABASE_URL,
    dataDir: resolve(e.DATA_DIR),
    trustProxy: e.TRUST_PROXY,
    maxUploadBytes: Math.round(e.MAX_UPLOAD_MB * 1024 * 1024),
    secret: e.RUBLOX_SECRET ?? DEVELOPMENT_SECRET,
    admin:
      e.RUBLOX_ADMIN_USERNAME && e.RUBLOX_ADMIN_PASSWORD
        ? { username: e.RUBLOX_ADMIN_USERNAME, password: e.RUBLOX_ADMIN_PASSWORD }
        : undefined,
    logLevel: e.LOG_LEVEL ?? (e.NODE_ENV === 'test' ? 'silent' : 'info'),
    studioDist: e.STUDIO_DIST ? resolve(e.STUDIO_DIST) : defaultStudioDist,
    playerDist: e.PLAYER_DIST ? resolve(e.PLAYER_DIST) : defaultPlayerDist,
    migrationsFolder,
  }
}
