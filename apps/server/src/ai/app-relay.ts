import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { liveLinks, projects, publications } from '../db/schema.ts'
import { fail } from '../http.ts'
import { liveTokenHash } from '../live.ts'
import { aiImageSchema } from '../routes/ai.ts'
import type { Services } from '../services.ts'
import { AiDeclined } from './service.ts'

/** Path of the AI component's requests on the apps origin. */
export const APP_AI_PATH = '/_rx/ai'

const WINDOW_MS = 60_000
const PER_WINDOW = 20

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
    this.hits.set(key, recent)
    if (this.hits.size > 10_000) this.hits.clear()
    return recent.length > PER_WINDOW
  }

  async handle(request: Request, clientIp: string): Promise<Response> {
    const { ai, db, config } = this.services
    if (!ai) return Response.json({ error: 'not_found' }, { status: 404 })
    if (Number(request.headers.get('content-length') ?? 0) > 8 * 1024 * 1024) {
      return Response.json({ error: 'too_large' }, { status: 413 })
    }
    const parsed = bodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success || Boolean(parsed.data.slug) === Boolean(parsed.data.token)) {
      return Response.json({ error: 'invalid' }, { status: 400 })
    }
    const input = parsed.data
    if (this.limited(clientIp)) fail(429, 'too_many_attempts')
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
        .where(and(eq(publications.slug, input.slug), isNull(projects.deletedAt)))
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
