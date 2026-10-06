import { passkey } from '@better-auth/passkey'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, organization, username } from 'better-auth/plugins'
import type { Config } from './config.ts'
import type { Database } from './db/index.ts'
import * as schema from './db/schema.ts'
import { uuidv7 } from './ids.ts'

/**
 * Header carrying the client address resolved by Rublox (`X-Real-IP` behind a trusted proxy,
 * the socket address otherwise). Any copy sent by the client is removed before Better Auth
 * reads it, so Better Auth never looks at `X-Forwarded-For` (SPEC § 6.9).
 */
export const CLIENT_IP_HEADER = 'x-rublox-client-ip'

const DAY = 24 * 3600

export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 128
export const USERNAME_MIN = 3
export const USERNAME_MAX = 32
/** Lowercase letters, digits, `.`, `_` and `-`, starting with a letter or a digit. */
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/

/** Domain of the addresses given to accounts without e-mail (`.invalid` is reserved, RFC 2606). */
export const NO_EMAIL_DOMAIN = 'rublox.invalid'

export function placeholderEmail(): string {
  return `${uuidv7()}@${NO_EMAIL_DOMAIN}`
}

export function realEmail(email: string): string | null {
  return email.endsWith(`@${NO_EMAIL_DOMAIN}`) ? null : email
}

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase()
}

/**
 * Better Auth endpoints the studio may call (SPEC § 4.7). Everything else answers 404: account
 * creation, profile, spaces and administration go through `/api/*`, where Rublox checks who
 * may do what.
 */
export const AUTH_ROUTES = new Set([
  'POST /sign-in/username',
  'POST /sign-in/email',
  'POST /sign-out',
  'GET /get-session',
  'GET /list-sessions',
  'POST /revoke-session',
  'POST /revoke-other-sessions',
  'POST /change-password',
  'GET /passkey/generate-register-options',
  'POST /passkey/verify-registration',
  'GET /passkey/generate-authenticate-options',
  'POST /passkey/verify-authentication',
  'GET /passkey/list-user-passkeys',
  'POST /passkey/delete-passkey',
  'POST /passkey/update-passkey',
])

/** Sign-in endpoints whose failures count towards the brute-force limit. */
export const SIGN_IN_ROUTES = new Set([
  'POST /sign-in/username',
  'POST /sign-in/email',
  'POST /passkey/verify-authentication',
])

export function createAuth(db: Database, config: Pick<Config, 'studioUrl' | 'secret'>) {
  const studio = new URL(config.studioUrl)
  return betterAuth({
    appName: 'Rublox',
    baseURL: config.studioUrl,
    basePath: '/api/auth',
    secret: config.secret,
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    emailAndPassword: {
      enabled: true,
      // No open registration (SPEC § 2): accounts come from invitations, admins and managers.
      disableSignUp: true,
      minPasswordLength: PASSWORD_MIN,
      maxPasswordLength: PASSWORD_MAX,
    },
    session: { expiresIn: 365 * DAY, updateAge: DAY },
    user: {
      additionalFields: {
        avatar: { type: 'string', required: false, input: false },
        locale: { type: 'string', required: false, input: false },
        uiMode: { type: 'string', required: false, input: false },
        theme: { type: 'string', required: false, input: false },
        managedBySpaceId: { type: 'string', required: false, input: false },
      },
    },
    trustedOrigins: [config.studioUrl],
    // Rublox counts failed sign-ins itself (5 per address in 15 minutes, `guard.ts`).
    rateLimit: { enabled: false },
    telemetry: { enabled: false },
    advanced: {
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
      database: { generateId: () => uuidv7() },
    },
    plugins: [
      username({
        minUsernameLength: USERNAME_MIN,
        maxUsernameLength: USERNAME_MAX,
        usernameValidator: (value) => USERNAME_PATTERN.test(value),
        usernameNormalization: normalizeUsername,
      }),
      admin({ defaultRole: 'user', adminRoles: ['admin'] }),
      organization({ allowUserToCreateOrganization: false }),
      passkey({ rpID: studio.hostname, rpName: 'Rublox', origin: config.studioUrl }),
    ],
  })
}

export type Auth = ReturnType<typeof createAuth>
export type AuthSession = NonNullable<Awaited<ReturnType<Auth['api']['getSession']>>>
