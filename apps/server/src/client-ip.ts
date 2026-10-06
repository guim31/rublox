import type { Context } from 'hono'

export interface ClientIpInput {
  /** Value of the `X-Real-IP` header, set by the reverse proxy. */
  realIp: string | undefined
  /** Address of the TCP peer (the reverse proxy itself when there is one). */
  socketAddress: string | undefined
  trustProxy: boolean
}

/**
 * Address of the client. `X-Real-IP` is honoured only behind a trusted reverse proxy
 * (`TRUST_PROXY=true`), which overwrites it. `X-Forwarded-For` is never read: clients can
 * prepend anything to it.
 */
export function resolveClientIp({
  realIp,
  socketAddress,
  trustProxy,
}: ClientIpInput): string | undefined {
  if (trustProxy) {
    const header = realIp?.trim()
    if (header) return header
  }
  return socketAddress
}

interface NodeBindings {
  incoming?: { socket?: { remoteAddress?: string } }
}

/** Client address of a request served by `@hono/node-server`. */
export function getClientIp(c: Context, trustProxy: boolean): string | undefined {
  const env = c.env as NodeBindings | undefined
  return resolveClientIp({
    realIp: c.req.header('x-real-ip'),
    socketAddress: env?.incoming?.socket?.remoteAddress,
    trustProxy,
  })
}
