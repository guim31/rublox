/**
 * Brute-force protection (SPEC § 4.7): after 5 failed attempts from one address within
 * 15 minutes, sign-in and invitation endpoints answer 429 until the oldest failure expires.
 * Successes do not reset the count, so an attacker cannot interleave a valid account.
 *
 * Kept in memory: one server process, and a restart only forgets a few minutes of history.
 */
export class FailureGuard {
  private readonly failures = new Map<string, number[]>()

  constructor(
    readonly max = 5,
    readonly windowMs = 15 * 60 * 1000,
    private readonly now: () => number = Date.now,
  ) {}

  private recent(key: string): number[] {
    const since = this.now() - this.windowMs
    const list = (this.failures.get(key) ?? []).filter((at) => at > since)
    if (list.length === 0) this.failures.delete(key)
    else this.failures.set(key, list)
    return list
  }

  /** Seconds before `key` may try again, or 0 when it is not blocked. */
  retryAfter(key: string): number {
    const list = this.recent(key)
    if (list.length < this.max) return 0
    const oldest = list[list.length - this.max] ?? this.now()
    return Math.max(1, Math.ceil((oldest + this.windowMs - this.now()) / 1000))
  }

  fail(key: string): void {
    const list = this.recent(key)
    list.push(this.now())
    this.failures.set(key, list)
    if (this.failures.size > 50_000) this.prune()
  }

  private prune(): void {
    for (const key of [...this.failures.keys()]) this.recent(key)
  }
}
