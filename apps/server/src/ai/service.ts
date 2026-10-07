import type { Locale, ProjectDoc, UiMode } from '@rublox/schema'
import { buildProject } from '@rublox/templates'
import { and, count, eq, gte } from 'drizzle-orm'
import type { Database } from '../db/index.ts'
import { aiUsage, member, spaceSettings } from '../db/schema.ts'
import { fail } from '../http.ts'
import { uuidv7 } from '../ids.ts'
import type { SettingsStore } from '../settings.ts'
import {
  type AiClient,
  type AiInput,
  AiRefusedError,
  type AiRequest,
  AiUnreadableError,
} from './client.ts'
import {
  appSystemPrompt,
  type CreateAnswer,
  createAnswerSchema,
  createSystemPrompt,
  createUserPrompt,
  type DebugAnswer,
  debugAnswerSchema,
  debugUserPrompt,
  type ExplainTarget,
  explainUserPrompt,
  helpSystemPrompt,
  repairPrompt,
} from './prompts.ts'
import { answerToSpec } from './recipe.ts'

export type AiKind = 'create' | 'explain' | 'debug' | 'app-text' | 'app-image'

/** What the studio shows: whether this account may use the assistant, and today's count. */
export type AiStatus = {
  allowed: boolean
  /** Why not: switched off by the administrator, or by a space the account belongs to. */
  reason: 'disabled' | 'space' | null
  quota: number
  used: number
}

/** The model declined: the route answers `{ refused: true }`, the studio says so kindly. */
export class AiDeclined extends Error {
  override name = 'AiDeclined'
}

/** Start of the current day (UTC): daily quotas reset at midnight UTC. */
export function startOfDay(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

/**
 * The AI assistant (SPEC § 4.12): rights, daily quotas per account, usage journal, and the
 * questions to the model. Exists only when `ANTHROPIC_API_KEY` is set.
 */
export class AiService {
  /**
   * Questions asked and not answered yet, per account: they count in the quota from the start
   * (the journal only gets a row once the model answers), so parallel requests cannot all
   * pass a quota that has one question left (SPEC § 0.10).
   */
  private readonly pending = new Map<string, number>()

  constructor(private readonly deps: { db: Database; settings: SettingsStore; client: AiClient }) {}

  /** Takes one question of today's quota, or refuses (403, 429); `release` gives it back. */
  private async reserve(userId: string): Promise<() => void> {
    const status = await this.status(userId)
    if (!status.allowed) fail(403, 'ai_forbidden')
    // Counted again after the last `await`: no other request runs between the check and the
    // reservation.
    const used = await this.usedToday(userId)
    const pending = this.pending.get(userId) ?? 0
    if (used + pending >= status.quota) fail(429, 'ai_quota')
    this.pending.set(userId, pending + 1)
    return () => {
      const left = (this.pending.get(userId) ?? 1) - 1
      if (left > 0) this.pending.set(userId, left)
      else this.pending.delete(userId)
    }
  }

  /** Whether `userId` may use the assistant: instance switch, then their spaces. */
  async status(userId: string): Promise<AiStatus> {
    const settings = await this.deps.settings.get()
    const used = (await this.usedToday(userId)) + (this.pending.get(userId) ?? 0)
    const base = { quota: settings.aiDailyQuota, used }
    if (!settings.aiEnabled) return { ...base, allowed: false, reason: 'disabled' }
    if (!(await this.spacesAllow(userId))) return { ...base, allowed: false, reason: 'space' }
    return { ...base, allowed: true, reason: null }
  }

  /**
   * Refused when one of the spaces where the account is a plain member did not switch the
   * assistant on (`membersCanUseAi`, off by default): the strictest rule wins.
   */
  private async spacesAllow(userId: string): Promise<boolean> {
    const [blocked] = await this.deps.db
      .select({ spaceId: member.organizationId })
      .from(member)
      .innerJoin(spaceSettings, eq(spaceSettings.spaceId, member.organizationId))
      .where(
        and(
          eq(member.userId, userId),
          eq(member.role, 'member'),
          eq(spaceSettings.membersCanUseAi, false),
        ),
      )
      .limit(1)
    return !blocked
  }

  private async usedToday(userId: string): Promise<number> {
    const [row] = await this.deps.db
      .select({ total: count() })
      .from(aiUsage)
      .where(and(eq(aiUsage.userId, userId), gte(aiUsage.createdAt, startOfDay())))
    return row?.total ?? 0
  }

  /** 403 or 429 unless `userId` may ask one more question today. */
  async require(userId: string) {
    const status = await this.status(userId)
    if (!status.allowed) fail(403, 'ai_forbidden')
    if (status.used >= status.quota) fail(429, 'ai_quota')
    return status
  }

  /**
   * One question, billed to `userId` and written in the journal whatever happens. A refusal
   * becomes `AiDeclined`; a broken answer or an unreachable API, a 502 `ai_failed`.
   */
  private async ask<T>(
    userId: string,
    projectId: string | null,
    kind: AiKind,
    request: AiRequest<T>,
  ): Promise<T> {
    const log = (
      model: string,
      usage: { inputTokens: number; outputTokens: number },
      outcome: string,
    ) =>
      this.deps.db.insert(aiUsage).values({
        id: uuidv7(),
        userId,
        projectId,
        kind,
        model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        outcome,
      })
    const release = await this.reserve(userId)
    try {
      const result = await this.deps.client.complete(request)
      await log(result.model, result.usage, 'ok')
      return result.value
    } catch (error) {
      if (error instanceof AiRefusedError) {
        await log(error.model, error.usage, 'refused')
        throw new AiDeclined()
      }
      if (error instanceof AiUnreadableError) {
        await log(error.model, error.usage, 'error')
        fail(502, 'ai_failed')
      }
      await log(request.tier, { inputTokens: 0, outputTokens: 0 }, 'error')
      fail(502, 'ai_failed')
    } finally {
      // After the journal row: the question is never counted zero times in between.
      release()
    }
  }

  /**
   * "Create with AI": an app from a request, built and validated. When the first answer
   * cannot be built, the model sees the problems once and answers again.
   */
  async create(
    userId: string,
    input: { request: string; locale: Locale; mode: UiMode },
  ): Promise<{ doc: ProjectDoc; summary: string }> {
    await this.require(userId)
    const system = createSystemPrompt()
    let text = createUserPrompt(input)
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await this.require(userId)
      const answer: CreateAnswer = await this.ask(userId, null, 'create', {
        tier: 'main',
        system,
        input: { text },
        schema: createAnswerSchema,
        maxTokens: 16_000,
      })
      const { spec, issues } = answerToSpec(answer)
      const built = spec
        ? buildProject(spec, { locale: input.locale, mode: input.mode })
        : { doc: null, issues: issues.map((message) => ({ path: '', message })) }
      if (built.doc) return { doc: built.doc, summary: answer.summary.slice(0, 600) }
      text = `${createUserPrompt(input)}\n\n${repairPrompt(
        JSON.stringify(answer),
        built.issues.slice(0, 30).map((issue) => `${issue.path} ${issue.message}`.trim()),
      )}`
    }
    fail(502, 'ai_failed')
  }

  async explain(
    userId: string,
    input: {
      projectId: string | null
      target: ExplainTarget
      locale: Locale
      mode: UiMode
      context: string
    },
  ): Promise<string> {
    await this.require(userId)
    return this.ask(userId, input.projectId, 'explain', {
      tier: 'fast',
      system: helpSystemPrompt(),
      input: { text: explainUserPrompt(input) },
      maxTokens: 2000,
    })
  }

  async debug(
    userId: string,
    input: {
      projectId: string | null
      locale: Locale
      mode: UiMode
      question: string
      context: string
      console: string
    },
  ): Promise<DebugAnswer> {
    await this.require(userId)
    return this.ask(userId, input.projectId, 'debug', {
      tier: 'fast',
      system: helpSystemPrompt(),
      input: { text: debugUserPrompt(input) },
      schema: debugAnswerSchema,
      maxTokens: 3000,
    })
  }

  /**
   * The AI component of an app: billed to `billTo` (the owner of the app, or the person
   * testing it in the editor).
   */
  async app(
    billTo: string,
    projectId: string,
    input: { prompt: string; image?: AiInput['image'] },
  ): Promise<string> {
    await this.require(billTo)
    return this.ask(billTo, projectId, input.image ? 'app-image' : 'app-text', {
      tier: 'fast',
      system: appSystemPrompt(),
      input: { text: input.prompt, image: input.image },
      maxTokens: 1500,
    })
  }
}
