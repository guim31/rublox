import type { Api } from '@rublox/server/src/api.ts'
import { hc, type InferResponseType } from 'hono/client'

/** Typed client of the studio API (`apps/server/src/api.ts`). */
export const api = hc<Api>('/api')

/** An answer of the API other than 2xx: `code` is translated by `errors.<code>`. */
export class ApiError extends Error {
  override name = 'ApiError'
  constructor(
    readonly status: number,
    readonly code: string,
    readonly retryAfter?: number,
  ) {
    super(`${status} ${code}`)
  }
}

let onSignedOut: () => void = () => {}

/** What to do when the session is gone (expired, revoked elsewhere): set once by the app. */
export function setSignedOutHandler(handler: () => void) {
  onSignedOut = handler
}

/** The server no longer knows this session (an API answer, a refused document). */
export function reportSignedOut() {
  onSignedOut()
}

type JsonResponse = { ok: boolean; status: number; headers: Headers; json(): Promise<unknown> }

/** Awaits an `hc` call: the JSON body when it succeeds, an `ApiError` otherwise. */
export async function call<R extends JsonResponse>(
  request: Promise<R>,
): Promise<Awaited<ReturnType<R['json']>>> {
  let response: R
  try {
    response = await request
  } catch {
    throw new ApiError(0, 'network')
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string }
    const retry = Number(response.headers.get('retry-after'))
    // The server answers a lost session with 403 `signed_out`, never 401 (SPEC § 6.9).
    if (body.error === 'signed_out') onSignedOut()
    throw new ApiError(
      response.status,
      body.error ?? 'unknown',
      Number.isFinite(retry) && retry > 0 ? retry : undefined,
    )
  }
  return (await response.json()) as Awaited<ReturnType<R['json']>>
}

export type Me = InferResponseType<typeof api.me.$get>
export type Profile = NonNullable<Me['user']>
export type ProjectSummaryDto = InferResponseType<typeof api.projects.$get>['projects'][number]
