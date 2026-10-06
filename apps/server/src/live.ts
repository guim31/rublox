import { createHmac } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import {
  LIVE_PHONE_PATH,
  LIVE_STUDIO_PATH,
  type LiveEndReason,
  type LivePhone,
  type LiveToPhone,
  type LiveToStudio,
  liveFromPhoneSchema,
  liveFromStudioSchema,
} from '@rublox/schema'
import { eq } from 'drizzle-orm'
import { type RawData, type WebSocket, WebSocketServer } from 'ws'
import { projectAccess } from './access.ts'
import type { Auth } from './auth.ts'
import type { Database } from './db/index.ts'
import { liveLinks } from './db/schema.ts'
import { randomToken } from './ids.ts'
import { MB } from './settings.ts'
import { headersOf, type UpgradeRoute } from './upgrades.ts'

interface LiveDeps {
  db: Database
  auth: Auth
  config: { secret: string; studioUrl: string; appsUrl: string }
  logger?: { warn(object: unknown, message?: string): void }
}

/** Keyed hash of a live token: a leaked database gives no working link. */
export function liveTokenHash(secret: string, token: string): string {
  return createHmac('sha256', secret).update(`live:${token}`).digest('hex')
}

type Phone = LivePhone & { ws: WebSocket; budget: number }

/** A live link while someone uses it: the editors that feed it and the phones that follow. */
class Channel {
  readonly phones = new Map<string, Phone>()
  readonly editors = new Set<WebSocket>()
  /** The last project sent by an editor, already serialized for the phones. */
  load: string | null = null
  private readonly timer: ReturnType<typeof setTimeout>

  constructor(
    readonly linkId: string,
    expiresAt: Date,
    onExpire: () => void,
  ) {
    const delay = Math.min(Math.max(0, expiresAt.getTime() - Date.now()), 2 ** 31 - 1)
    this.timer = setTimeout(onExpire, delay)
    this.timer.unref?.()
  }

  get empty() {
    return this.phones.size === 0 && this.editors.size === 0
  }

  toPhones(message: LiveToPhone | string) {
    const text = typeof message === 'string' ? message : JSON.stringify(message)
    for (const phone of this.phones.values()) send(phone.ws, text)
  }

  toEditors(message: LiveToStudio) {
    const text = JSON.stringify(message)
    for (const ws of this.editors) send(ws, text)
  }

  phonesChanged() {
    this.toEditors({
      type: 'phones',
      phones: [...this.phones.values()].map(({ id, device, connectedAt, running }) => ({
        id,
        device,
        connectedAt,
        running,
      })),
    })
  }

  dispose() {
    clearTimeout(this.timer)
  }
}

function send(ws: WebSocket, text: string) {
  if (ws.readyState === ws.OPEN) ws.send(text)
}

/** Close codes: 4000 + reason, so that clients know not to reconnect. */
const END_CODES: Record<LiveEndReason, number> = { 'not-found': 4004, revoked: 4003, expired: 4010 }
/** Logs a phone may send per second (a loop printing in the console must not flood). */
const PHONE_LOGS_PER_SECOND = 40
const PING_MS = 25_000

/**
 * "Test on my phone" (SPEC § 4.3): a relay between the editor (studio origin, session cookie)
 * and the phones that opened the link (apps origin, `/live/<token>`). The editor sends the
 * project and its generated code; the server checks it and passes it on, and passes back the
 * phones' console. Nothing is stored: the link itself is in `live_links`.
 */
export class LiveHub {
  private readonly channels = new Map<string, Channel>()
  private readonly phoneSockets = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 })
  private readonly studioSockets = new WebSocketServer({ noServer: true, maxPayload: 32 * MB })
  private readonly pinger: ReturnType<typeof setInterval>

  constructor(private readonly deps: LiveDeps) {
    // Phones on mobile networks vanish without closing: ping them, drop the silent ones.
    this.pinger = setInterval(() => {
      for (const server of [this.phoneSockets, this.studioSockets]) {
        for (const ws of server.clients) {
          const alive = ws as WebSocket & { alive?: boolean }
          if (alive.alive === false) {
            ws.terminate()
            continue
          }
          alive.alive = false
          ws.ping()
        }
      }
    }, PING_MS)
    this.pinger.unref?.()
  }

  /** The two WebSocket endpoints, for `Upgrades`. */
  routes(): UpgradeRoute[] {
    const { studioUrl, appsUrl } = this.deps.config
    return [
      {
        origin: appsUrl,
        path: LIVE_PHONE_PATH,
        allowedOrigin: appsUrl,
        handle: (request, socket, head, url) =>
          this.phoneSockets.handleUpgrade(request, socket, head, (ws) =>
            this.acceptPhone(ws, url.searchParams.get('token') ?? ''),
          ),
      },
      {
        origin: studioUrl,
        path: LIVE_STUDIO_PATH,
        allowedOrigin: studioUrl,
        handle: (request, socket, head, url) =>
          this.studioSockets.handleUpgrade(request, socket, head, (ws) =>
            this.acceptEditor(ws, request, url.searchParams.get('token') ?? ''),
          ),
      },
    ]
  }

  /** The active link of a token, or why there is none. */
  private async resolve(
    token: string,
  ): Promise<{ ended: LiveEndReason } | { link: typeof liveLinks.$inferSelect }> {
    if (!token || token.length > 64) return { ended: 'not-found' }
    const [link] = await this.deps.db
      .select()
      .from(liveLinks)
      .where(eq(liveLinks.tokenHash, liveTokenHash(this.deps.config.secret, token)))
    if (!link) return { ended: 'not-found' }
    if (link.revokedAt) return { ended: 'revoked' }
    if (link.expiresAt.getTime() <= Date.now()) return { ended: 'expired' }
    return { link }
  }

  private channel(linkId: string, expiresAt: Date): Channel {
    let channel = this.channels.get(linkId)
    if (!channel) {
      channel = new Channel(linkId, expiresAt, () => this.end(linkId, 'expired'))
      this.channels.set(linkId, channel)
    }
    return channel
  }

  private release(channel: Channel) {
    if (channel.empty && this.channels.get(channel.linkId) === channel) {
      channel.dispose()
      this.channels.delete(channel.linkId)
    }
  }

  private refuse(ws: WebSocket, reason: LiveEndReason) {
    ws.send(JSON.stringify({ type: 'ended', reason }))
    ws.close(END_CODES[reason], reason)
  }

  private keepAlive(ws: WebSocket) {
    const alive = ws as WebSocket & { alive?: boolean }
    alive.alive = true
    ws.on('pong', () => {
      alive.alive = true
    })
  }

  private async acceptPhone(ws: WebSocket, token: string) {
    this.keepAlive(ws)
    // Messages that arrive while the link is checked are not lost.
    const early: RawData[] = []
    const queue = (data: RawData) => early.push(data)
    ws.on('message', queue)
    const found = await this.resolve(token)
    if ('ended' in found) {
      this.refuse(ws, found.ended)
      return
    }
    if (ws.readyState !== ws.OPEN) return
    const channel = this.channel(found.link.id, found.link.expiresAt)
    const phone: Phone = {
      id: randomToken(6),
      device: '',
      connectedAt: Date.now(),
      running: false,
      ws,
      budget: PHONE_LOGS_PER_SECOND,
    }
    channel.phones.set(phone.id, phone)
    const refill = setInterval(() => {
      phone.budget = PHONE_LOGS_PER_SECOND
    }, 1000)
    send(ws, JSON.stringify({ type: 'editor', connected: channel.editors.size > 0 }))
    if (channel.load) send(ws, channel.load)

    const onMessage = (data: RawData) => {
      const parsed = liveFromPhoneSchema.safeParse(parseJson(data))
      if (!parsed.success) return
      const message = parsed.data
      if (message.type === 'hello') {
        phone.device = message.device
        channel.phonesChanged()
      } else if (message.type === 'state') {
        phone.running = message.running
        channel.phonesChanged()
      } else if (phone.budget > 0) {
        phone.budget -= 1
        channel.toEditors({
          type: 'log',
          phoneId: phone.id,
          device: phone.device,
          entry: message.entry,
        })
      }
    }
    ws.off('message', queue)
    ws.on('message', onMessage)
    for (const data of early) onMessage(data)
    ws.on('close', () => {
      clearInterval(refill)
      channel.phones.delete(phone.id)
      channel.phonesChanged()
      this.release(channel)
    })
  }

  private async acceptEditor(ws: WebSocket, request: IncomingMessage, token: string) {
    this.keepAlive(ws)
    const early: RawData[] = []
    const queue = (data: RawData) => early.push(data)
    ws.on('message', queue)
    const { db, auth } = this.deps
    const session = await auth.api.getSession({ headers: headersOf(request) }).catch(() => null)
    const found = session ? await this.resolve(token) : { ended: 'not-found' as const }
    if ('ended' in found) {
      this.refuse(ws, found.ended)
      return
    }
    // Anyone who may open the project may follow its link (viewers test too).
    const access = session ? await projectAccess(db, session.user.id, found.link.projectId) : null
    if (!access) {
      this.refuse(ws, 'not-found')
      return
    }
    if (ws.readyState !== ws.OPEN) return
    const channel = this.channel(found.link.id, found.link.expiresAt)
    channel.editors.add(ws)
    if (channel.editors.size === 1) channel.toPhones({ type: 'editor', connected: true })
    channel.phonesChanged()

    const onMessage = (data: RawData) => {
      const parsed = liveFromStudioSchema.safeParse(parseJson(data))
      if (!parsed.success) {
        this.deps.logger?.warn({ linkId: channel.linkId }, 'refused an invalid live message')
        return
      }
      if (parsed.data.type === 'load') {
        channel.load = JSON.stringify({ type: 'load', bundle: parsed.data.bundle })
        channel.toPhones(channel.load)
      } else {
        channel.toPhones({ type: 'restart', screenId: parsed.data.screenId })
      }
    }
    ws.off('message', queue)
    ws.on('message', onMessage)
    for (const data of early) onMessage(data)
    ws.on('close', () => {
      channel.editors.delete(ws)
      if (channel.editors.size === 0) channel.toPhones({ type: 'editor', connected: false })
      this.release(channel)
    })
  }

  /** Ends a link now (revoked, expired): phones and editors are told, then disconnected. */
  end(linkId: string, reason: LiveEndReason) {
    const channel = this.channels.get(linkId)
    if (!channel) return
    this.channels.delete(linkId)
    channel.dispose()
    for (const phone of channel.phones.values()) this.refuse(phone.ws, reason)
    for (const ws of channel.editors) this.refuse(ws, reason)
  }

  /** Phones connected to a link (tests, diagnostics). */
  phoneCount(linkId: string): number {
    return this.channels.get(linkId)?.phones.size ?? 0
  }

  close() {
    clearInterval(this.pinger)
    for (const linkId of [...this.channels.keys()]) {
      const channel = this.channels.get(linkId)
      for (const phone of channel?.phones.values() ?? []) phone.ws.close(1001)
      for (const ws of channel?.editors ?? []) ws.close(1001)
      channel?.dispose()
    }
    this.channels.clear()
  }
}

function parseJson(data: RawData): unknown {
  try {
    const text = Array.isArray(data)
      ? Buffer.concat(data).toString('utf8')
      : Buffer.from(data as ArrayBuffer).toString('utf8')
    return JSON.parse(text)
  } catch {
    return null
  }
}
