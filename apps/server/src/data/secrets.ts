import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'
import { and, asc, eq } from 'drizzle-orm'
import type { Database } from '../db/index.ts'
import { projectSecrets } from '../db/schema.ts'

/** Size of a secret's value. */
export const MAX_SECRET_BYTES = 4096
/** Secrets of one project. */
export const MAX_SECRETS = 30

/**
 * The secrets of the projects (SPEC § 4.5, § 6.8): AES-256-GCM, under a key derived from
 * `RUBLOX_SECRET` with HKDF. A secret is written once and never read back by the studio: only
 * the relay decrypts it, to put it into a call.
 */
export class SecretStore {
  private readonly key: Buffer

  constructor(
    private readonly db: Database,
    secret: string,
  ) {
    this.key = Buffer.from(hkdfSync('sha256', secret, 'rublox', 'rublox:project-secrets', 32))
  }

  encrypt(projectId: string, name: string, value: string): string {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.key, iv)
    // The project and the name are authenticated: a value cannot be moved to another secret.
    cipher.setAAD(Buffer.from(`${projectId}\u0000${name}`))
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64')
  }

  decrypt(projectId: string, name: string, stored: string): string | null {
    try {
      const bytes = Buffer.from(stored, 'base64')
      const decipher = createDecipheriv('aes-256-gcm', this.key, bytes.subarray(0, 12))
      decipher.setAAD(Buffer.from(`${projectId}\u0000${name}`))
      decipher.setAuthTag(bytes.subarray(12, 28))
      return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8')
    } catch {
      return null
    }
  }

  /** Names and dates, never values. */
  async list(projectId: string) {
    return this.db
      .select({ name: projectSecrets.name, updatedAt: projectSecrets.updatedAt })
      .from(projectSecrets)
      .where(eq(projectSecrets.projectId, projectId))
      .orderBy(asc(projectSecrets.name))
  }

  async set(projectId: string, name: string, value: string) {
    const stored = this.encrypt(projectId, name, value)
    await this.db
      .insert(projectSecrets)
      .values({ projectId, name, value: stored })
      .onConflictDoUpdate({
        target: [projectSecrets.projectId, projectSecrets.name],
        set: { value: stored, updatedAt: new Date() },
      })
  }

  async remove(projectId: string, name: string) {
    await this.db
      .delete(projectSecrets)
      .where(and(eq(projectSecrets.projectId, projectId), eq(projectSecrets.name, name)))
  }

  /** The values of the named secrets of a project, decrypted (for the relay only). */
  async values(projectId: string, names: readonly string[]): Promise<Map<string, string>> {
    const values = new Map<string, string>()
    if (!names.length) return values
    const rows = await this.db
      .select()
      .from(projectSecrets)
      .where(eq(projectSecrets.projectId, projectId))
    for (const row of rows) {
      if (!names.includes(row.name)) continue
      const value = this.decrypt(projectId, row.name, row.value)
      if (value !== null) values.set(row.name, value)
    }
    return values
  }
}

const TICKET_HOURS = 12

/**
 * Tickets of the editor's preview (SPEC § 6.9: "a project open in the editor"). The studio
 * asks for one with its session and hands it to the preview, which has no cookie of its own
 * (apps origin). It names the project and the account, and expires: `exp.user.signature`.
 * The account's access is checked again at each use (`resolveCredential`), so a ticket ends
 * with the sharing that gave it (SPEC § 0.10).
 */
export class Tickets {
  constructor(private readonly secret: string) {}

  private sign(projectId: string, userId: string, expires: number): string {
    return createHmac('sha256', this.secret)
      .update(`rublox:data-ticket:${projectId}:${userId}:${expires}`)
      .digest('base64url')
  }

  issue(
    projectId: string,
    userId: string,
    now = Date.now(),
  ): { ticket: string; expiresAt: string } {
    const expires = now + TICKET_HOURS * 3600_000
    return {
      ticket: `${expires}.${userId}.${this.sign(projectId, userId, expires)}`,
      expiresAt: new Date(expires).toISOString(),
    }
  }

  /** The account the ticket was given to, or null when it is forged or expired. */
  verify(projectId: string, ticket: string, now = Date.now()): string | null {
    const [time, userId, signature, extra] = ticket.split('.')
    const expires = Number(time)
    if (!Number.isSafeInteger(expires) || expires <= now) return null
    if (!userId || !signature || extra !== undefined) return null
    const expected = Buffer.from(this.sign(projectId, userId, expires))
    const given = Buffer.from(signature)
    return expected.length === given.length && timingSafeEqual(expected, given) ? userId : null
  }
}
