import { messages } from '@rublox/i18n'
import type { AiReply, AiRequest, Behavior, BehaviorContext } from './types.ts'

/** Largest image sent to the assistant (the server accepts 5 MB). */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const

const strings = (ctx: BehaviorContext) => messages[ctx.locale].runtime.ai
const text = (value: unknown) => (value == null ? '' : String(value)).trim()

/** The request with the component's "instructions" in front. */
function prompt(ctx: BehaviorContext, request: string): string {
  const instructions = text(ctx.get('instructions'))
  return instructions ? `${instructions}\n\n${request}` : request
}

/** An image property value (asset, https:, blob:, data:) as base64, or null. */
async function readImage(ctx: BehaviorContext, value: unknown): Promise<AiRequest['image'] | null> {
  const url = typeof value === 'string' && value ? ctx.assetUrl(value) : undefined
  if (!url) return null
  try {
    const blob = await (await fetch(url)).blob()
    const type = IMAGE_TYPES.find((candidate) => candidate === blob.type)
    if (!type || blob.size > MAX_IMAGE_BYTES) return null
    const bytes = new Uint8Array(await blob.arrayBuffer())
    let binary = ''
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
    }
    return { mediaType: type, data: btoa(binary) }
  } catch {
    return null
  }
}

/** Asks the assistant; an empty text and the `error` event when there is no answer. */
async function ask(ctx: BehaviorContext, request: AiRequest): Promise<string> {
  if (!ctx.ai) {
    ctx.fail(strings(ctx).unavailable)
    return ''
  }
  ctx.set('busy', true)
  let reply: AiReply
  try {
    reply = await ctx.ai(request)
  } catch {
    reply = { error: 'failed' }
  } finally {
    if (ctx.alive()) ctx.set('busy', false)
  }
  if ('text' in reply) return reply.text
  if ('refused' in reply) ctx.fail(strings(ctx).refused)
  else ctx.fail(reply.error === 'failed' ? strings(ctx).failed : strings(ctx).unavailable)
  return ''
}

/** The AI component (J6, SPEC § 4.12). */
export const aiBehavior: Behavior = {
  available: (ctx) => Boolean(ctx.ai),
  methods: {
    generate: (ctx, request) => ask(ctx, { prompt: prompt(ctx, text(request)) }),
    describe: async (ctx, image, question) => {
      const read = await readImage(ctx, image)
      if (!read) {
        ctx.fail(strings(ctx).noImage)
        return ''
      }
      const request =
        text(question) || (ctx.locale === 'fr' ? 'Décris cette image.' : 'Describe this image.')
      return ask(ctx, { prompt: prompt(ctx, request), image: read })
    },
  },
}
