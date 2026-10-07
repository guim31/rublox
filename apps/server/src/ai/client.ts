import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import type { z } from 'zod'
import type { AiConfig } from '../config.ts'

/** `main` builds apps; `fast` explains, debugs and answers the AI component of apps. */
export type AiTier = 'main' | 'fast'

/** What the assistant is shown: text, and an image for "describe this picture". */
export type AiInput = {
  text: string
  image?: { mediaType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'; data: string }
}

export type AiRequest<T> = {
  tier: AiTier
  /** The stable part of the prompt (rules, catalog reference): cached. */
  system: string
  input: AiInput
  /** A Zod schema for a structured answer; plain text when absent. */
  schema?: z.ZodType<T>
  maxTokens: number
}

export type AiUsage = { inputTokens: number; outputTokens: number }

export type AiResult<T> = { value: T; model: string; usage: AiUsage }

/** The model declined (safety): nothing to show but a kind sentence. */
export class AiRefusedError extends Error {
  override name = 'AiRefusedError'
  constructor(
    readonly model: string,
    readonly usage: AiUsage,
  ) {
    super('the model declined the request')
  }
}

/** The answer could not be read (cut off, or not in the expected shape). */
export class AiUnreadableError extends Error {
  override name = 'AiUnreadableError'
  constructor(
    readonly model: string,
    readonly usage: AiUsage,
    reason: string,
  ) {
    super(reason)
  }
}

/** One question to the model. A fake one answers in the tests (no key in the CI). */
export interface AiClient {
  complete<T = string>(request: AiRequest<T>): Promise<AiResult<T>>
}

/** Models that accept the server-side refusal fallback (`fallbacks: "default"`). */
const FALLBACK_MODELS = /^claude-(opus-5|fable-5|sonnet-5-5)/
/** Models that take an effort level (Haiku 4.5 does not). */
const EFFORT_MODELS = /^claude-(opus|fable|sonnet-5|mythos)/

/** The Claude API, through the official SDK (SPEC § 6.1). */
export class AnthropicAiClient implements AiClient {
  private readonly client: Anthropic

  constructor(private readonly config: AiConfig) {
    // `ANTHROPIC_BASE_URL`, when set, is read by the SDK (the end-to-end tests point it at
    // a fake server).
    this.client = new Anthropic({ apiKey: config.apiKey, maxRetries: 2, timeout: 120_000 })
  }

  async complete<T = string>(request: AiRequest<T>): Promise<AiResult<T>> {
    const model = request.tier === 'main' ? this.config.model : this.config.fastModel
    const content: Anthropic.Beta.BetaContentBlockParam[] = []
    if (request.input.image) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: request.input.image.mediaType,
          data: request.input.image.data,
        },
      })
    }
    content.push({ type: 'text', text: request.input.text })
    const fallback = FALLBACK_MODELS.test(model)
    const params = {
      model,
      max_tokens: request.maxTokens,
      // The rules and the catalog reference come first and never change: cached.
      system: [
        {
          type: 'text' as const,
          text: request.system,
          cache_control: { type: 'ephemeral' as const },
        },
      ],
      messages: [{ role: 'user' as const, content }],
      ...(fallback
        ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
        : {}),
    }
    const effort = EFFORT_MODELS.test(model)
      ? { effort: request.tier === 'main' ? ('medium' as const) : ('low' as const) }
      : {}
    const response = request.schema
      ? await this.client.beta.messages.parse({
          ...params,
          output_config: { ...effort, format: betaZodOutputFormat(request.schema) },
        })
      : await this.client.beta.messages.create({
          ...params,
          ...(Object.keys(effort).length ? { output_config: effort } : {}),
        })
    const usage = {
      inputTokens:
        response.usage.input_tokens +
        (response.usage.cache_read_input_tokens ?? 0) +
        (response.usage.cache_creation_input_tokens ?? 0),
      outputTokens: response.usage.output_tokens,
    }
    if (response.stop_reason === 'refusal') throw new AiRefusedError(response.model, usage)
    if (response.stop_reason === 'max_tokens') {
      throw new AiUnreadableError(response.model, usage, 'the answer was cut off')
    }
    if (request.schema) {
      const parsed = (response as { parsed_output?: T | null }).parsed_output
      if (parsed === null || parsed === undefined) {
        throw new AiUnreadableError(response.model, usage, 'the answer has not the expected shape')
      }
      return { value: parsed, model: response.model, usage }
    }
    const text = response.content
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('')
      .trim()
    return { value: text as T, model: response.model, usage }
  }
}
