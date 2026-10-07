import { type AiClient, AiRefusedError, type AiRequest, type AiResult } from '../src/ai/client.ts'

/** What the fake model answers to one request: a value, or "refused". */
export type FakeReply = unknown | { refuse: true }

/**
 * A fake model for the tests (no key, no network): it answers from a queue, or with
 * `fallback`, and keeps the requests it received.
 */
export class FakeAiClient implements AiClient {
  readonly requests: AiRequest<unknown>[] = []
  readonly queue: FakeReply[] = []

  constructor(private readonly fallback: (request: AiRequest<unknown>) => FakeReply = () => 'OK') {}

  async complete<T>(request: AiRequest<T>): Promise<AiResult<T>> {
    this.requests.push(request as AiRequest<unknown>)
    const reply = this.queue.length
      ? this.queue.shift()
      : this.fallback(request as AiRequest<unknown>)
    const usage = { inputTokens: 100, outputTokens: 20 }
    if (reply && typeof reply === 'object' && 'refuse' in reply) {
      throw new AiRefusedError('fake-model', usage)
    }
    const value = request.schema ? request.schema.parse(reply) : reply
    return { value: value as T, model: request.tier === 'main' ? 'fake-main' : 'fake-fast', usage }
  }
}
