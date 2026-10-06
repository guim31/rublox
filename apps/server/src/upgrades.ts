import type { IncomingMessage, Server } from 'node:http'
import type { Duplex } from 'node:stream'
import { normalizeHost } from './config.ts'

/** A WebSocket endpoint: a path on one of the two origins (SPEC § 6.7). */
export interface UpgradeRoute {
  /** Origin (`scheme://host[:port]`) the endpoint belongs to; the `Host` header must match. */
  origin: string
  path: string
  /** Value the `Origin` header must have: a page of another origin may not open the socket. */
  allowedOrigin: string
  handle(request: IncomingMessage, socket: Duplex, head: Buffer, url: URL): void
}

/**
 * Routes the HTTP upgrades of the server to the WebSocket endpoints. Anything else (unknown
 * path, wrong origin) is answered and closed before any WebSocket exists.
 */
export class Upgrades {
  private readonly routes: UpgradeRoute[] = []

  add(route: UpgradeRoute): this {
    this.routes.push(route)
    return this
  }

  attach(server: Server): void {
    server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) =>
      this.dispatch(request, socket, head),
    )
  }

  dispatch(request: IncomingMessage, socket: Duplex, head: Buffer): void {
    socket.on('error', () => socket.destroy())
    for (const route of this.routes) {
      const origin = new URL(route.origin)
      const protocol = origin.protocol as 'http:' | 'https:'
      const host = normalizeHost(request.headers.host ?? '', protocol)
      if (host !== normalizeHost(origin.host, protocol)) continue
      const url = new URL(request.url ?? '/', route.origin)
      if (url.pathname !== route.path) continue
      if (request.headers.origin !== route.allowedOrigin) {
        socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
        return
      }
      route.handle(request, socket, head, url)
      return
    }
    socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n')
  }
}

/** The request headers as a `Headers` object (to read a session cookie). */
export function headersOf(request: IncomingMessage): Headers {
  const headers = new Headers()
  for (const [name, value] of Object.entries(request.headers)) {
    if (typeof value === 'string') headers.set(name, value)
    else if (Array.isArray(value)) headers.set(name, value.join(', '))
  }
  return headers
}
