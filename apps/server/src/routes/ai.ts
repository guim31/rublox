import { localeSchema, uiModeSchema } from '@rublox/schema'
import { and, count, desc, eq, gte, sum } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireProject } from '../access.ts'
import { AiDeclined, type AiService, startOfDay } from '../ai/service.ts'
import { aiUsage, projects, user } from '../db/schema.ts'
import { type ApiEnv, fail, iso, jsonBody, requireAdmin, requireUser } from '../http.ts'
import type { Services } from '../services.ts'
import { MB } from '../settings.ts'

/** Largest picture the AI component may send ("describe this image"). */
export const MAX_AI_IMAGE_BYTES = 5 * MB

export const aiImageSchema = z.object({
  mediaType: z.enum(['image/png', 'image/jpeg', 'image/gif', 'image/webp']),
  data: z
    .string()
    .max(Math.ceil((MAX_AI_IMAGE_BYTES * 4) / 3) + 4)
    .regex(/^[A-Za-z0-9+/]*={0,2}$/),
})

/** What a project sends to be explained: blocks and components, already summed up. */
const contextSchema = z.string().trim().min(1).max(60_000)

/** Runs a question; a refusal of the model is an ordinary answer (`refused`). */
async function answer<T>(
  run: () => Promise<T>,
): Promise<{ refused: true } | { refused: false; value: T }> {
  try {
    return { refused: false, value: await run() }
  } catch (error) {
    if (error instanceof AiDeclined) return { refused: true }
    throw error
  }
}

/**
 * The AI assistant (SPEC § 4.12), on the studio origin. Without `ANTHROPIC_API_KEY` every
 * route answers 404, as if it did not exist.
 */
export function aiRoutes(services: Services) {
  const { db } = services
  const ai = (): AiService => services.ai ?? fail(404, 'not_found')

  return (
    new Hono<ApiEnv>()
      .post(
        '/create',
        jsonBody(
          z.object({
            request: z.string().trim().min(3).max(1000),
            locale: localeSchema,
            mode: uiModeSchema,
          }),
        ),
        async (c) => {
          const me = requireUser(c)
          const result = await answer(() => ai().create(me.id, c.req.valid('json')))
          return c.json(
            result.refused
              ? { refused: true as const }
              : {
                  refused: false as const,
                  // Typed loosely: the studio reads it as a `ProjectDoc` (a deep type for `hc`).
                  doc: result.value.doc as unknown as Record<string, unknown>,
                  summary: result.value.summary,
                },
          )
        },
      )
      .post(
        '/explain',
        jsonBody(
          z.object({
            projectId: z.string().max(64).nullable(),
            target: z.enum(['block', 'stack', 'screen']),
            locale: localeSchema,
            mode: uiModeSchema,
            context: contextSchema,
          }),
        ),
        async (c) => {
          const me = requireUser(c)
          const input = c.req.valid('json')
          if (input.projectId) await requireProject(db, me.id, input.projectId, 'view')
          const result = await answer(() => ai().explain(me.id, input))
          return c.json(
            result.refused
              ? { refused: true as const }
              : { refused: false as const, answer: result.value },
          )
        },
      )
      .post(
        '/debug',
        jsonBody(
          z.object({
            projectId: z.string().max(64).nullable(),
            locale: localeSchema,
            mode: uiModeSchema,
            question: z.string().trim().max(500).default(''),
            context: contextSchema,
            console: z.string().max(20_000).default(''),
          }),
        ),
        async (c) => {
          const me = requireUser(c)
          const input = c.req.valid('json')
          if (input.projectId) await requireProject(db, me.id, input.projectId, 'view')
          const result = await answer(() => ai().debug(me.id, input))
          return c.json(
            result.refused
              ? { refused: true as const }
              : {
                  refused: false as const,
                  answer: result.value.answer,
                  blockIds: result.value.blockIds.slice(0, 5),
                },
          )
        },
      )
      // The AI component in the preview of the editor: billed to the person testing it.
      .post(
        '/app',
        jsonBody(
          z.object({
            projectId: z.string().max(64),
            prompt: z.string().trim().min(1).max(4000),
            image: aiImageSchema.optional(),
          }),
        ),
        async (c) => {
          const me = requireUser(c)
          const input = c.req.valid('json')
          await requireProject(db, me.id, input.projectId, 'view')
          const result = await answer(() =>
            ai().app(me.id, input.projectId, { prompt: input.prompt, image: input.image }),
          )
          return c.json(
            result.refused
              ? { refused: true as const }
              : { refused: false as const, text: result.value },
          )
        },
      )
      // Whether the published app may use the AI component (the owner pays for it).
      .put('/projects/:projectId', jsonBody(z.object({ allowInApp: z.boolean() })), async (c) => {
        const me = requireUser(c)
        ai()
        const { project } = await requireProject(db, me.id, c.req.param('projectId'), 'owner')
        await db
          .update(projects)
          .set({ appAiAllowed: c.req.valid('json').allowInApp })
          .where(eq(projects.id, project.id))
        return c.json({ ok: true })
      })
      .get('/projects/:projectId', async (c) => {
        const me = requireUser(c)
        ai()
        const { project } = await requireProject(db, me.id, c.req.param('projectId'), 'read')
        return c.json({ allowInApp: project.appAiAllowed })
      })
      // ---- Usage journal (administration) ---------------------------------------------------
      .get('/usage', async (c) => {
        requireAdmin(c)
        ai()
        const rows = await db
          .select({
            id: aiUsage.id,
            kind: aiUsage.kind,
            model: aiUsage.model,
            inputTokens: aiUsage.inputTokens,
            outputTokens: aiUsage.outputTokens,
            outcome: aiUsage.outcome,
            createdAt: aiUsage.createdAt,
            username: user.username,
            displayName: user.name,
          })
          .from(aiUsage)
          .innerJoin(user, eq(user.id, aiUsage.userId))
          .orderBy(desc(aiUsage.createdAt))
          .limit(200)
        const [today] = await db
          .select({
            requests: count(),
            inputTokens: sum(aiUsage.inputTokens).mapWith(Number),
            outputTokens: sum(aiUsage.outputTokens).mapWith(Number),
          })
          .from(aiUsage)
          .where(and(gte(aiUsage.createdAt, startOfDay())))
        return c.json({
          today: {
            requests: today?.requests ?? 0,
            inputTokens: today?.inputTokens ?? 0,
            outputTokens: today?.outputTokens ?? 0,
          },
          entries: rows.map((row) => ({
            ...row,
            username: row.username ?? '',
            kind: row.kind as 'create' | 'explain' | 'debug' | 'app-text' | 'app-image',
            outcome: row.outcome as 'ok' | 'refused' | 'error',
            createdAt: iso(row.createdAt) ?? '',
          })),
        })
      })
  )
}
