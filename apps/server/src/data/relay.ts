import http, { type IncomingMessage } from 'node:http'
import https from 'node:https'
import { isIP } from 'node:net'
import type { Readable } from 'node:stream'
import zlib from 'node:zlib'
import {
  type ApiConnection,
  buildApiUrl,
  connectionSecrets,
  fillSecrets,
  type HttpMethod,
  RELAY_LIMITS,
  type RelayError,
  type RelayResponse,
} from '@rublox/schema'
import {
  BlockedAddressError,
  guardedLookup,
  isBlockedHostName,
  isPublicAddress,
  type Resolve,
  systemResolve,
} from './address.ts'
import type { DataSource } from './credentials.ts'

export class RelayFailure extends Error {
  override name = 'RelayFailure'
  constructor(readonly code: RelayError) {
    super(code)
  }
}

export const RELAY_STATUS: Record<RelayError, 400 | 403 | 404 | 429 | 502 | 504> = {
  forbidden: 403,
  unknown_api: 404,
  bad_url: 400,
  blocked_address: 403,
  timeout: 504,
  too_large: 502,
  too_many_requests: 429,
  unreachable: 502,
}

export type RelayOptions = {
  resolve?: Resolve
  /** Which resolved addresses may be called: public ones only, except in tests. */
  allowAddress?: (address: string) => boolean
  timeoutMs?: number
  maxResponseBytes?: number
  perMinute?: number
  now?: () => number
}

type Outgoing = {
  method: HttpMethod
  url: URL
  headers: Record<string, string>
  body?: Buffer
}

type Fetched = { status: number; contentType: string; body: Buffer }

/** Google sheets published as CSV: the only addresses the `sheet` call reaches (P2). */
export function isPublishedSheet(url: URL): boolean {
  return (
    url.protocol === 'https:' &&
    url.hostname === 'docs.google.com' &&
    /^\/spreadsheets\/d\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\/(pub|export|gviz\/tq)$/.test(
      url.pathname,
    )
  )
}

/**
 * The API relay (SPEC § 6.9): calls a connection of the project for the app, with the
 * project's secrets put in on the server. It refuses private, loopback, link-local and
 * metadata addresses after resolving the name and at each redirect, and caps the time, the
 * size of the answer and the number of calls per project.
 */
export class Relay {
  private readonly resolve: Resolve
  private readonly allow: (address: string) => boolean
  private readonly windows = new Map<string, { start: number; count: number }>()

  constructor(
    private readonly secrets: (projectId: string, names: string[]) => Promise<Map<string, string>>,
    private readonly options: RelayOptions = {},
  ) {
    this.resolve = options.resolve ?? systemResolve
    this.allow = options.allowAddress ?? isPublicAddress
  }

  private now() {
    return this.options.now?.() ?? Date.now()
  }

  /** Counts a call of a project; throws past the limit of the minute. */
  private count(projectId: string) {
    const limit = this.options.perMinute ?? RELAY_LIMITS.perMinute
    const now = this.now()
    let window = this.windows.get(projectId)
    if (!window || now - window.start >= 60_000) {
      window = { start: now, count: 0 }
      this.windows.set(projectId, window)
      if (this.windows.size > 10_000) {
        for (const [key, value] of this.windows) {
          if (now - value.start >= 60_000) this.windows.delete(key)
        }
      }
    }
    window.count += 1
    if (window.count > limit) throw new RelayFailure('too_many_requests')
  }

  /** Calls connection `apiId` of the source's project. */
  async call(
    source: DataSource,
    request: {
      api: string
      method: HttpMethod
      path: string
      query?: Record<string, unknown>
      body?: unknown
    },
  ): Promise<RelayResponse> {
    const connection = source.doc.data.apis[request.api] as ApiConnection | undefined
    if (!connection) throw new RelayFailure('unknown_api')
    this.count(source.projectId)
    const values = await this.secrets(source.projectId, connectionSecrets(connection))
    const fill = (text: string) => fillSecrets(text, values)
    let url: URL
    try {
      url = buildApiUrl(connection, request.path, request.query, fill)
    } catch {
      throw new RelayFailure('bad_url')
    }
    const headers: Record<string, string> = {}
    for (const pair of connection.headers) {
      const name = fill(pair.key).trim()
      if (/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)) headers[name.toLowerCase()] = fill(pair.value)
    }
    let body: Buffer | undefined
    if (request.method !== 'GET' && request.body !== undefined && request.body !== null) {
      if (typeof request.body === 'string') {
        body = Buffer.from(request.body)
        headers['content-type'] ??= 'text/plain; charset=utf-8'
      } else {
        body = Buffer.from(JSON.stringify(request.body))
        headers['content-type'] ??= 'application/json'
      }
      if (body.byteLength > RELAY_LIMITS.maxRequestBytes) throw new RelayFailure('too_large')
    }
    const fetched = await this.fetch({ method: request.method, url, headers, body })
    return toResponse(fetched)
  }

  /** Reads a Google sheet published as CSV: the text of the file. */
  async sheet(source: DataSource, address: string): Promise<RelayResponse> {
    let url: URL
    try {
      url = new URL(address)
    } catch {
      throw new RelayFailure('bad_url')
    }
    if (!isPublishedSheet(url)) throw new RelayFailure('bad_url')
    this.count(source.projectId)
    const fetched = await this.fetch({ method: 'GET', url, headers: {} }, isPublishedSheet)
    return {
      status: fetched.status,
      contentType: fetched.contentType,
      body: fetched.body.toString('utf8'),
    }
  }

  /** One call, following at most a few redirects, each one checked again. */
  async fetch(outgoing: Outgoing, redirectAllowed?: (url: URL) => boolean): Promise<Fetched> {
    let current = outgoing
    const deadline = this.now() + (this.options.timeoutMs ?? RELAY_LIMITS.timeoutMs)
    for (let hop = 0; ; hop++) {
      const response = await this.once(current, deadline)
      const location = response.location
      if (location === undefined) return response
      if (hop >= RELAY_LIMITS.maxRedirects) throw new RelayFailure('unreachable')
      let next: URL
      try {
        next = new URL(location, current.url)
      } catch {
        throw new RelayFailure('bad_url')
      }
      if (redirectAllowed && !redirectAllowed(next) && next.hostname !== current.url.hostname) {
        // A published sheet answers with a redirect to Google's file servers.
        if (!/(^|\.)googleusercontent\.com$/.test(next.hostname)) {
          throw new RelayFailure('bad_url')
        }
      }
      const sameOrigin = next.origin === current.url.origin
      const keepMethod = response.status === 307 || response.status === 308
      current = {
        method: keepMethod ? current.method : 'GET',
        url: next,
        // The connection's headers (keys…) never follow a redirect to another site.
        headers: sameOrigin ? current.headers : {},
        body: keepMethod ? current.body : undefined,
      }
    }
  }

  private once(outgoing: Outgoing, deadline: number): Promise<Fetched & { location?: string }> {
    const { url } = outgoing
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return Promise.reject(new RelayFailure('bad_url'))
    }
    if (url.username || url.password) return Promise.reject(new RelayFailure('bad_url'))
    const host = url.hostname.replace(/^\[|\]$/g, '')
    if (isIP(host)) {
      if (!this.allow(host)) return Promise.reject(new RelayFailure('blocked_address'))
    } else if (isBlockedHostName(host) && !this.allow(host)) {
      return Promise.reject(new RelayFailure('blocked_address'))
    }
    const remaining = deadline - this.now()
    if (remaining <= 0) return Promise.reject(new RelayFailure('timeout'))
    const max = this.options.maxResponseBytes ?? RELAY_LIMITS.maxResponseBytes
    const client = url.protocol === 'https:' ? https : http

    return new Promise((resolve, reject) => {
      let settled = false
      const finish = (error: unknown, value?: Fetched & { location?: string }) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (error) reject(error)
        else resolve(value as Fetched & { location?: string })
      }
      const request = client.request(
        url,
        {
          method: outgoing.method,
          headers: {
            'user-agent': 'Rublox relay',
            accept: 'application/json, text/*;q=0.9, */*;q=0.5',
            'accept-encoding': 'gzip, deflate, br',
            ...outgoing.headers,
            ...(outgoing.body ? { 'content-length': String(outgoing.body.byteLength) } : {}),
          },
          lookup: guardedLookup(this.resolve, this.allow) as never,
          // A fresh connection each time: a pooled socket would skip the address check.
          agent: false,
        },
        (response) => {
          const status = response.statusCode ?? 502
          const location = response.headers.location
          if (status >= 300 && status < 400 && location) {
            response.resume()
            finish(null, { status, contentType: '', body: Buffer.alloc(0), location })
            return
          }
          readBody(response, max).then(
            (body) =>
              finish(null, {
                status,
                contentType: String(response.headers['content-type'] ?? ''),
                body,
              }),
            (error) => finish(error),
          )
        },
      )
      const timer = setTimeout(() => {
        request.destroy()
        finish(new RelayFailure('timeout'))
      }, remaining)
      request.on('error', (error) => {
        const blockedError =
          error instanceof BlockedAddressError ||
          (error as { cause?: unknown }).cause instanceof BlockedAddressError
        finish(new RelayFailure(blockedError ? 'blocked_address' : 'unreachable'))
      })
      request.end(outgoing.body)
    })
  }
}

/** The body, decompressed, refused past `max` bytes (a compressed bomb included). */
function readBody(response: IncomingMessage, max: number): Promise<Buffer> {
  const encoding = String(response.headers['content-encoding'] ?? '').toLowerCase()
  let stream: Readable = response
  if (encoding === 'gzip' || encoding === 'x-gzip') stream = response.pipe(zlib.createGunzip())
  else if (encoding === 'deflate') stream = response.pipe(zlib.createInflate())
  else if (encoding === 'br') stream = response.pipe(zlib.createBrotliDecompress())
  const declared = Number(response.headers['content-length'])
  if (!encoding && Number.isFinite(declared) && declared > max) {
    response.destroy()
    return Promise.reject(new RelayFailure('too_large'))
  }
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    stream.on('data', (chunk: Buffer) => {
      size += chunk.byteLength
      if (size > max) {
        response.destroy()
        stream.destroy()
        reject(new RelayFailure('too_large'))
        return
      }
      chunks.push(chunk)
    })
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', () => reject(new RelayFailure('unreachable')))
  })
}

function toResponse(fetched: Fetched): RelayResponse {
  const text = fetched.body.toString('utf8')
  let body: unknown = text
  if (/json/i.test(fetched.contentType) || /^\s*[[{]/.test(text)) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }
  return { status: fetched.status, contentType: fetched.contentType, body }
}
