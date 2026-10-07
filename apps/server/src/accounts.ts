import { and, count, eq, or } from 'drizzle-orm'
import { z } from 'zod'
import {
  normalizeUsername,
  PASSWORD_MAX,
  PASSWORD_MIN,
  placeholderEmail,
  USERNAME_MAX,
  USERNAME_MIN,
  USERNAME_PATTERN,
} from './auth.ts'
import type { Database } from './db/index.ts'
import { account, session, user } from './db/schema.ts'
import { fail } from './http.ts'
import { uuidv7 } from './ids.ts'
import type { Services } from './services.ts'

export const usernameSchema = z
  .string()
  .trim()
  .transform(normalizeUsername)
  .pipe(z.string().min(USERNAME_MIN).max(USERNAME_MAX).regex(USERNAME_PATTERN))
export const passwordSchema = z.string().min(PASSWORD_MIN).max(PASSWORD_MAX)
export const displayNameSchema = z.string().trim().min(1).max(60)
export const emailSchema = z.email().trim().toLowerCase().max(254)

export interface NewAccount {
  username: string
  displayName: string
  password: string
  email?: string | null
  role?: 'user' | 'admin'
  managedBySpaceId?: string | null
  uiMode?: 'junior' | 'studio'
  locale?: 'fr' | 'en'
}

export async function hashPassword(services: Services, password: string): Promise<string> {
  const context = await services.auth.$context
  return context.password.hash(password)
}

/**
 * Creates an account with a password (invitation, admin, space manager). `db` may be a
 * transaction. Fails with 409 when the username or the e-mail is taken.
 */
export async function createAccount(
  services: Services,
  db: Database,
  input: NewAccount,
): Promise<string> {
  const username = normalizeUsername(input.username)
  const email = input.email?.toLowerCase() || null
  const taken = await db
    .select({ username: user.username, email: user.email })
    .from(user)
    .where(
      email ? or(eq(user.username, username), eq(user.email, email)) : eq(user.username, username),
    )
  if (taken.some((row) => row.username === username)) fail(409, 'username_taken')
  if (taken.length > 0) fail(409, 'email_taken')

  const id = uuidv7()
  const hash = await hashPassword(services, input.password)
  await db.insert(user).values({
    id,
    name: input.displayName,
    email: email ?? placeholderEmail(),
    username,
    displayUsername: username,
    role: input.role ?? 'user',
    managedBySpaceId: input.managedBySpaceId ?? null,
    uiMode: input.uiMode ?? null,
    locale: input.locale ?? null,
  })
  await db.insert(account).values({
    id: uuidv7(),
    accountId: id,
    providerId: 'credential',
    userId: id,
    password: hash,
  })
  return id
}

/** Sets a new password and signs the account out everywhere. */
export async function setPassword(services: Services, userId: string, password: string) {
  const hash = await hashPassword(services, password)
  const { db } = services
  const updated = await db
    .update(account)
    .set({ password: hash, updatedAt: new Date() })
    .where(and(eq(account.userId, userId), eq(account.providerId, 'credential')))
    .returning({ id: account.id })
  if (updated.length === 0) {
    await db
      .insert(account)
      .values({ id: uuidv7(), accountId: userId, providerId: 'credential', userId, password: hash })
  }
  await db.delete(session).where(eq(session.userId, userId))
  services.collab.disconnectUser(userId)
}

/**
 * First start (SPEC § 4.7): creates the administrator from `RUBLOX_ADMIN_USERNAME` and
 * `RUBLOX_ADMIN_PASSWORD`, only when the database has no account at all.
 */
export async function bootstrapAdmin(
  services: Services,
  admin: { username: string; password: string } | undefined,
): Promise<'created' | 'exists' | 'missing'> {
  const [row] = await services.db.select({ total: count() }).from(user)
  if ((row?.total ?? 0) > 0) return 'exists'
  if (!admin) {
    services.logger?.warn(
      'the database has no account: set RUBLOX_ADMIN_USERNAME and RUBLOX_ADMIN_PASSWORD to create the administrator',
    )
    return 'missing'
  }
  const username = usernameSchema.safeParse(admin.username)
  const password = passwordSchema.safeParse(admin.password)
  if (!username.success || !password.success) {
    throw new Error(
      `RUBLOX_ADMIN_USERNAME must be ${USERNAME_MIN} to ${USERNAME_MAX} lowercase letters, digits, ".", "_" or "-", and RUBLOX_ADMIN_PASSWORD ${PASSWORD_MIN} to ${PASSWORD_MAX} characters`,
    )
  }
  await createAccount(services, services.db, {
    username: username.data,
    displayName: admin.username,
    password: password.data,
    role: 'admin',
    uiMode: 'studio',
  })
  services.logger?.info({ username: username.data }, 'administrator account created')
  return 'created'
}
