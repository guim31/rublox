import { z } from 'zod'
import { cellSchema, HTTP_METHODS, type rowSchema } from './data.ts'

/**
 * What an app sends to the services of the apps origin (SPEC § 6.7, § 6.9): the API relay
 * (`/_rx/proxy`) and the shared variables and tables (`/_rx/shared`). Both answer only for a
 * project open in the editor (a ticket the studio asked for), a valid "test on my phone" link,
 * or a published app.
 */

export const RELAY_PATH = '/_rx/proxy'
export const SHARED_PATH = '/_rx/shared'

export const dataCredentialSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('editor'),
    project: z.string().min(1).max(64),
    ticket: z.string().min(1).max(200),
  }),
  z.object({ kind: z.literal('live'), token: z.string().min(1).max(64) }),
  z.object({ kind: z.literal('app'), slug: z.string().min(3).max(40) }),
])
export type DataCredential = z.infer<typeof dataCredentialSchema>

/** The credential as query parameters (WebSocket address). */
export function credentialToQuery(credential: DataCredential): URLSearchParams {
  const params = new URLSearchParams({ kind: credential.kind })
  if (credential.kind === 'editor') {
    params.set('project', credential.project)
    params.set('ticket', credential.ticket)
  } else if (credential.kind === 'live') params.set('token', credential.token)
  else params.set('slug', credential.slug)
  return params
}

export function credentialFromQuery(params: URLSearchParams): DataCredential | null {
  const result = dataCredentialSchema.safeParse({
    kind: params.get('kind'),
    project: params.get('project') ?? undefined,
    ticket: params.get('ticket') ?? undefined,
    token: params.get('token') ?? undefined,
    slug: params.get('slug') ?? undefined,
  })
  return result.success ? result.data : null
}

/** Limits of the relay (SPEC § 6.9). */
export const RELAY_LIMITS = {
  timeoutMs: 10_000,
  maxResponseBytes: 2 * 1024 * 1024,
  maxRequestBytes: 256 * 1024,
  maxRedirects: 4,
  /** Calls per minute and per project. */
  perMinute: 120,
} as const

const query = z.record(z.string().max(200), z.unknown())

export const relayRequestSchema = z.union([
  z.object({
    credential: dataCredentialSchema,
    /** Id of the connection in `ProjectDoc.data.apis`. */
    api: z.string().min(1).max(64),
    method: z.enum(HTTP_METHODS).default('GET'),
    path: z.string().max(2000).default(''),
    query: query.optional(),
    body: z.unknown().optional(),
  }),
  z.object({
    credential: dataCredentialSchema,
    /** A Google sheet published as CSV (P2): read only. */
    sheet: z.string().url().max(2000),
  }),
])
export type RelayRequest = z.input<typeof relayRequestSchema>

/** What the relay answers: the remote status and body (JSON parsed, else text). */
export type RelayResponse = { status: number; contentType: string; body: unknown }

/** Why the relay refused a call, as the app reads it (`{ error }`). */
export const RELAY_ERRORS = [
  'forbidden',
  'unknown_api',
  'bad_url',
  'blocked_address',
  'timeout',
  'too_large',
  'too_many_requests',
  'unreachable',
] as const
export type RelayError = (typeof RELAY_ERRORS)[number]

// Shared variables and tables (WebSocket)

/** Quotas of the shared data of one project. */
export const SHARED_LIMITS = {
  /** Bytes of one value (a variable, or a row as JSON). */
  maxValueBytes: 16 * 1024,
  maxRowsPerTable: 5000,
  /** Writes per socket: a burst, refilled each second. */
  writeBurst: 30,
  writesPerSecond: 10,
  maxSocketsPerProject: 200,
} as const

export const sharedFromAppSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('set'), ref: z.number(), variable: z.string(), value: z.json() }),
  z.object({
    type: z.literal('add'),
    ref: z.number(),
    table: z.string(),
    values: z.record(z.string(), cellSchema),
  }),
  z.object({
    type: z.literal('update'),
    ref: z.number(),
    table: z.string(),
    row: z.string(),
    values: z.record(z.string(), cellSchema),
  }),
  z.object({ type: z.literal('remove'), ref: z.number(), table: z.string(), row: z.string() }),
])
export type SharedFromApp = z.infer<typeof sharedFromAppSchema>

export type SharedErrorCode =
  | 'forbidden'
  | 'read_only'
  | 'unknown'
  | 'too_large'
  | 'too_many_rows'
  | 'too_many_requests'
  | 'invalid'

export type SharedToApp =
  /** Everything at connection: variables by id, rows of each shared table by table id. */
  | {
      type: 'hello'
      variables: Record<string, unknown>
      tables: Record<string, z.infer<typeof rowSchema>[]>
    }
  | { type: 'var'; variable: string; value: unknown }
  | { type: 'row'; table: string; row: z.infer<typeof rowSchema> }
  | { type: 'removed'; table: string; row: string }
  /** The table was emptied or replaced (from the editor's Data tab). */
  | { type: 'rows'; table: string; rows: z.infer<typeof rowSchema>[] }
  | { type: 'ack'; ref: number; error?: SharedErrorCode; row?: string }

/** Close codes of a refused socket: the app does not reconnect. */
export const SHARED_CLOSE = { forbidden: 4003, tooMany: 4029 } as const
