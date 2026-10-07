import type { AiProvider, AiReply, AiRequest, PlayerToStudio } from '@rublox/runtime'

/**
 * The AI component outside the editor (J6): `/_rx/ai` on the apps origin, for a published app
 * (`slug`, allowed by its owner) or a live test (`token`).
 */
export function serverAi(target: { slug: string } | { token: string }): AiProvider {
  return async (request: AiRequest): Promise<AiReply> => {
    try {
      const response = await fetch('/_rx/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...target, ...request }),
      })
      if (response.status === 429) {
        const body = (await response.json().catch(() => ({}))) as { error?: string }
        return { error: body.error === 'ai_quota' ? 'quota' : 'failed' }
      }
      if (response.status === 403 || response.status === 404) return { error: 'unavailable' }
      if (!response.ok) return { error: 'failed' }
      const body = (await response.json()) as { refused: boolean; text?: string }
      return body.refused ? { refused: true } : { text: body.text ?? '' }
    } catch {
      return { error: 'failed' }
    }
  }
}

/** The AI component in the preview: the studio asks the server for it. */
export function studioAi(send: (message: PlayerToStudio) => void) {
  let next = 1
  const pending = new Map<number, (reply: AiReply) => void>()
  const provider: AiProvider = (request) =>
    new Promise<AiReply>((resolve) => {
      const id = next++
      pending.set(id, resolve)
      send({ type: 'rx:ai', id, request })
    })
  return {
    provider,
    /** An `rx:ai-reply` from the studio. */
    answer(id: number, reply: AiReply) {
      pending.get(id)?.(reply)
      pending.delete(id)
    },
  }
}
