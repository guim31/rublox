import {
  type ApiCall,
  type DataServices,
  ServiceError,
  type SharedConnection,
  type SharedWrite,
} from '@rublox/runtime'
import {
  buildApiUrl,
  connectionSecrets,
  credentialToQuery,
  type DataCredential,
  type ProjectDoc,
  RELAY_PATH,
  type RelayResponse,
  SHARED_CLOSE,
  SHARED_PATH,
  type SharedToApp,
} from '@rublox/schema'

/**
 * The services of the apps origin for a running app (SPEC § 6.7, § 6.9): the API relay and
 * the shared data, both shown `credential` (a ticket of the editor, a live link, a published
 * app). `credential` is read at each call: the editor renews its ticket.
 */
export function serverServices(credential: () => DataCredential | null): DataServices {
  const relay = async (body: Record<string, unknown>): Promise<RelayResponse> => {
    const current = credential()
    if (!current) throw new ServiceError('forbidden')
    let response: Response
    try {
      response = await fetch(RELAY_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...body, credential: current }),
      })
    } catch {
      throw new ServiceError('unreachable')
    }
    const json = (await response.json().catch(() => ({}))) as RelayResponse & { error?: string }
    if (!response.ok) throw new ServiceError(json.error ?? 'unreachable')
    return json
  }
  return {
    request: (call: ApiCall) => relay({ ...call }),
    sheet: async (url) => {
      const response = await relay({ sheet: url })
      return typeof response.body === 'string' ? response.body : JSON.stringify(response.body)
    },
    shared: (handlers) => connectShared(credential, handlers),
  }
}

/**
 * An exported website has no server: it calls the APIs itself, when their address allows it
 * (CORS) and they need no secret. Shared data is not available there.
 */
export function directServices(doc: () => ProjectDoc): DataServices {
  return {
    request: async (call) => {
      const connection = doc().data.apis[call.api]
      if (!connection) throw new ServiceError('unknown_api')
      if (connectionSecrets(connection).length) throw new ServiceError('forbidden')
      let url: URL
      try {
        url = buildApiUrl(connection, call.path, call.query)
      } catch {
        throw new ServiceError('bad_url')
      }
      const headers = new Headers()
      for (const pair of connection.headers) if (pair.key.trim()) headers.set(pair.key, pair.value)
      let body: string | undefined
      if (call.method !== 'GET' && call.body !== undefined) {
        body = typeof call.body === 'string' ? call.body : JSON.stringify(call.body)
        if (typeof call.body !== 'string') headers.set('content-type', 'application/json')
      }
      let response: Response
      try {
        response = await fetch(url, { method: call.method, headers, body })
      } catch {
        throw new ServiceError('unreachable')
      }
      const contentType = response.headers.get('content-type') ?? ''
      const text = await response.text()
      let parsed: unknown = text
      if (/json/i.test(contentType)) {
        try {
          parsed = JSON.parse(text)
        } catch {
          parsed = text
        }
      }
      return { status: response.status, contentType, body: parsed }
    },
  }
}

type Pending = {
  message: SharedWrite & { ref: number }
  resolve: (ack: { error?: never; row?: string } | { error: string }) => void
}

/**
 * `/_rx/shared`: one WebSocket, opened again after a cut (unless the server refused the
 * credential). Writes not yet acknowledged are sent again on reconnection.
 */
function connectShared(
  credential: () => DataCredential | null,
  handlers: { message(message: SharedToApp): void; status(online: boolean): void },
): SharedConnection {
  let ws: WebSocket | null = null
  let closed = false
  let attempt = 0
  let retry: ReturnType<typeof setTimeout> | undefined
  let nextRef = 1
  const pending = new Map<number, Pending>()

  const open = () => {
    const current = credential()
    if (closed || !current) return
    const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:'
    ws = new WebSocket(`${scheme}//${location.host}${SHARED_PATH}?${credentialToQuery(current)}`)
    ws.onopen = () => {
      attempt = 0
      handlers.status(true)
      for (const entry of pending.values()) ws?.send(JSON.stringify(entry.message))
    }
    ws.onmessage = (event) => {
      let message: SharedToApp
      try {
        message = JSON.parse(String(event.data)) as SharedToApp
      } catch {
        return
      }
      if (message.type === 'ack') {
        const entry = pending.get(message.ref)
        pending.delete(message.ref)
        entry?.resolve(message.error ? { error: message.error } : { row: message.row })
        return
      }
      handlers.message(message)
    }
    ws.onclose = (event) => {
      handlers.status(false)
      if (closed) return
      if (event.code === SHARED_CLOSE.forbidden) {
        for (const entry of pending.values()) entry.resolve({ error: 'forbidden' })
        pending.clear()
        return
      }
      attempt += 1
      retry = setTimeout(open, Math.min(15_000, 500 * 2 ** attempt))
    }
  }
  open()

  return {
    send: (message) =>
      new Promise((resolve) => {
        const ref = nextRef++
        const entry = { message: { ...message, ref }, resolve } as Pending
        pending.set(ref, entry)
        if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(entry.message))
      }) as ReturnType<SharedConnection['send']>,
    close: () => {
      closed = true
      clearTimeout(retry)
      ws?.close()
      for (const entry of pending.values()) entry.resolve({ error: 'forbidden' })
      pending.clear()
    },
  }
}
