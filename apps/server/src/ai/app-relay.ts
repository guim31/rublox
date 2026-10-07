import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { liveLinks, projects, publications } from '../db/schema.ts'
import { fail } from '../http.ts'
import { liveTokenHash } from '../live.ts'
import { aiImageSchema } from '../routes/ai.ts'
import type { Services } from '../services.ts'
import { AiDeclined } from './service.ts'

/** Path of the AI component's requests on the apps origin. */
export const APP_AI_PATH = '/_rx/ai'

/** Largest request: a prompt and one image. */
export const APP_AI_MAX_BYTES = 8 * 1024 * 1024
const WINDOW_MS = 60_000
const PER_WINDOW = 20
/** Addresses followed at once; the oldest are forgotten first. */
const MAX_KEYS = 10_000

/**
 * Who a limit counts: an IPv4 address, or the /64 of an IPv6 one (a single connection often
 * gets a whole /64, where changing address is free).
 */
export function rateKey(ip: string): string {
  if (!ip.includes(':')) return ip
  const [head = '', tail = ''] = ip.toLowerCase().split('::', 2)
  const left = head ? head.split(':') : []
  const right = tail ? tail.split(':') : []
  const groups = ip.includes('::')
    ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right]
    : left
  return `${groups
    .slice(0, 4)
    .map((group) => group.replace(/^0+(?=.)/, ''))
    .join(':')}::/64`
}

const bodySchema = z.object({
  /** A published app (`/a/<slug>/`)… */
  slug: z.string().max(64).optional(),
  /** …or a live test link (`/live/<token>`). */
  token: z.string().max(64).optional(),
  prompt: z.string().trim().min(1).max(4000),
  image: aiImageSchema.optional(),
})

/**
 * The AI component of apps outside the editor (SPEC § 4.12), on the apps origin, where no
 * session exists. A published app may use it only when its owner allowed it, and pays for
 * it (their daily quota); a live test is billed to the person who opened the link.
 */
export class AppAiRelay {
  private readonly hits = new Map<string, number[]>()

  constructor(private readonly services: Services) {}

  private limited(key: string): boolean {
    const now = Date.now()
    const recent = (this.hits.get(key) ?? []).filter((at) => now - at < WINDOW_MS)
    recent.push(now)
    // Last used last: the map's order is the eviction order.
    this.hits.delete(key)
    this.hits.set(key, recent)
    while (this.hits.size > MAX_KEYS) {
      const oldest = this.hits.keys().next().value
      if (oldest === undefined) break
      this.hits.delete(oldest)
    }
    return recent.length > PER_WINDOW
  }

  async handle(request: Request, clientIp: string): Promise<Response> {
    const { ai, db, config } = this.services
    if (!ai) return Response.json({ error: 'not_found' }, { status: 404 })
    // Only the apps themselves, as for the API relay: a page elsewhere cannot spend the
    // owner's quota from its visitors' browsers.
    if (request.headers.get('origin') !== config.appsUrl) fail(403, 'forbidden')
    if (this.limited(rateKey(clientIp))) fail(429, 'too_many_attempts')
    if (Number(request.headers.get('content-length') ?? 0) > APP_AI_MAX_BYTES) {
      return Response.json({ error: 'too_large' }, { status: 413 })
    }
    const parsed = bodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success || Boolean(parsed.data.slug) === Boolean(parsed.data.token)) {
      return Response.json({ error: 'invalid' }, { status: 400 })
    }
    const input = parsed.data
    let billTo: string
    let projectId: string
    if (input.slug) {
      const [row] = await db
        .select({
          projectId: projects.id,
          ownerId: projects.ownerId,
          allowed: projects.appAiAllowed,
        })
        .from(publications)
        .innerJoin(projects, eq(projects.id, publications.projectId))
        .where(
          and(
            eq(publications.slug, input.slug),
            // An unpublished app keeps its address, not its AI.
            isNotNull(publications.currentVersionId),
            isNull(projects.deletedAt),
          ),
        )
      if (!row) fail(404, 'not_found')
      if (!row.allowed) fail(403, 'ai_forbidden')
      billTo = row.ownerId
      projectId = row.projectId
    } else {
      const [link] = await db
        .select()
        .from(liveLinks)
        .where(eq(liveLinks.tokenHash, liveTokenHash(config.secret, input.token ?? '')))
      if (!link || link.revokedAt || link.expiresAt.getTime() <= Date.now()) fail(404, 'not_found')
      billTo = link.createdById
      projectId = link.projectId
    }
    try {
      const text = await ai.app(billTo, projectId, { prompt: input.prompt, image: input.image })
      return Response.json({ refused: false, text })
    } catch (error) {
      if (error instanceof AiDeclined) return Response.json({ refused: true })
      throw error
    }
  }
}
