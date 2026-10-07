import type { Context, MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { validator } from 'hono/validator'
import type { z } from 'zod'
import type { AuthSession } from './auth.ts'

export type SessionUser = AuthSession['user']

/** Hono environment of the `/api` routes: the session read once per request. */
export type ApiEnv = { Variables: { session: AuthSession | null; clientIp: string } }

/** Error codes the studio translates (`errors.<code>` in `@rublox/i18n`). */
export type ErrorCode =
  | 'invalid'
  | 'signed_out'
  | 'forbidden'
  | 'not_found'
  | 'bad_origin'
  | 'too_many_attempts'
  | 'invalid_invite'
  | 'username_taken'
  | 'email_taken'
  | 'last_manager'
  | 'space_has_accounts'
  | 'managed_account'
  | 'self'
  | 'too_large'
  | 'unsupported_type'
  | 'quota_exceeded'
  | 'invalid_project'
  | 'slug_taken'
  | 'missing_asset'
  | 'publish_forbidden'
  | 'in_trash'
  | 'wrong_password'
  | 'last_admin'
  // J6: gallery and AI assistant
  | 'gallery_disabled'
  | 'gallery_forbidden'
  | 'gallery_removed'
  | 'ai_forbidden'
  | 'ai_quota'
  | 'ai_failed'

/** Stops the request with a JSON error: `{ error: code }`. Never 401 (SPEC § 6.9). */
export function fail(
  status: 400 | 403 | 404 | 409 | 410 | 413 | 415 | 429 | 502,
  code: ErrorCode,
): never {
  throw new HTTPException(status, { res: Response.json({ error: code }, { status }) })
}

/**
 * The signed-in user, or a **403** `signed_out`, never a 401: the reverse proxy bans addresses
 * that pile up 401s, and a session that expired or was revoked elsewhere is ordinary use
 * (SPEC § 6.9). The only 401 left is a wrong password at sign-in.
 */
export function requireUser(c: Context<ApiEnv>): SessionUser {
  const session = c.get('session')
  if (!session) fail(403, 'signed_out')
  return session.user
}

export function isAdmin(user: Pick<SessionUser, 'role' | 'banned'>): boolean {
  return user.role === 'admin' && !user.banned
}

export function requireAdmin(c: Context<ApiEnv>): SessionUser {
  const user = requireUser(c)
  if (!isAdmin(user)) fail(403, 'forbidden')
  return user
}

/**
 * JSON body validated by a Zod schema. The `hc` client sees the schema's input type (fields
 * with a default are optional), the route its output type.
 */
export function jsonBody<T extends z.ZodType>(schema: T) {
  return validator('json', (value): z.output<T> => {
    const result = schema.safeParse(value)
    if (!result.success) fail(400, 'invalid')
    return result.data
  }) as unknown as MiddlewareHandler<
    // biome-ignore lint/suspicious/noExplicitAny: the environment comes from the route
    any,
    string,
    { in: { json: z.input<T> }; out: { json: z.output<T> } }
  >
}

/** Query string validated by a Zod schema. */
export function queryParams<T extends z.ZodType>(schema: T) {
  return validator('query', (value): z.output<T> => {
    const result = schema.safeParse(value)
    if (!result.success) fail(400, 'invalid')
    return result.data
  }) as unknown as MiddlewareHandler<
    // biome-ignore lint/suspicious/noExplicitAny: the environment comes from the route
    any,
    string,
    { in: { query: z.input<T> }; out: { query: z.output<T> } }
  >
}

export function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64')
}

export function fromBase64(text: string): Uint8Array {
  return new Uint8Array(Buffer.from(text, 'base64'))
}

export const iso = (date: Date | null | undefined): string | null =>
  date ? date.toISOString() : null
