import type {
  LiveEndReason,
  LiveFromStudio,
  LiveLogEntry,
  LivePhone,
  LiveToStudio,
} from '@rublox/schema'
import { LIVE_STUDIO_PATH } from '@rublox/schema'
import { create } from 'zustand'
import { api, call } from '../../lib/api.ts'
import type { ProjectSession } from '../session.ts'
import { useEditor } from '../store.ts'
import { buildBundle } from './bundle.ts'

export type LiveLink = { id: string; token: string; url: string; expiresAt: string }
export type LiveStatus = 'idle' | 'creating' | 'connecting' | 'live' | 'offline' | 'ended' | 'error'
export type PhoneLog = LiveLogEntry & { id: number; device: string }

type LiveState = {
  projectId: string | null
  link: LiveLink | null
  status: LiveStatus
  ended: LiveEndReason | null
  phones: LivePhone[]
  logs: PhoneLog[]
}

/** The live test of the open project (SPEC § 4.3), shown by the dialog and the top bar. */
export const useLive = create<LiveState>()(() => ({
  projectId: null,
  link: null,
  status: 'idle',
  ended: null,
  phones: [],
  logs: [],
}))

/** Close codes of a link that will not come back (`apps/server/src/live.ts`). */
const FINAL_CODES: Record<number, LiveEndReason> = {
  4003: 'revoked',
  4004: 'not-found',
  4010: 'expired',
}
const PUSH_DELAY_MS = 60
const MAX_LOGS = 200
let nextLog = 1

const storageKey = (projectId: string) => `rublox:live:${projectId}`

function rememberedLink(projectId: string): LiveLink | null {
  try {
    const link = JSON.parse(sessionStorage.getItem(storageKey(projectId)) ?? 'null') as LiveLink
    return link && Date.parse(link.expiresAt) > Date.now() + 60_000 ? link : null
  } catch {
    return null
  }
}

function remember(projectId: string, link: LiveLink | null) {
  try {
    if (link) sessionStorage.setItem(storageKey(projectId), JSON.stringify(link))
    else sessionStorage.removeItem(storageKey(projectId))
  } catch {
    // The link lasts as long as this page.
  }
}

/**
 * Feeds the phones of a live link: the editor's socket (`/ws/live`, session cookie) sends the
 * project and its generated code after each change, and receives the phones and their console.
 * The link is kept for this tab (sessionStorage), so a reload does not make the phone rescan.
 */
class LiveController {
  private ws: WebSocket | null = null
  private attempt = 0
  private retry?: ReturnType<typeof setTimeout>
  private pushTimer?: ReturnType<typeof setTimeout>
  private pushing = false
  private pushAgain = false
  private unsubscribe: (() => void) | null = null
  private disposed = false

  constructor(private readonly session: ProjectSession) {}

  private set(patch: Partial<LiveState>) {
    useLive.setState(patch)
  }

  /** Starts testing: the link of this tab if it still works, else a new one. */
  async start(fresh = false) {
    const projectId = this.session.id
    this.set({ projectId, status: 'creating', ended: null })
    let link = fresh ? null : rememberedLink(projectId)
    if (!link) {
      try {
        link = await call(api.projects[':projectId'].live.$post({ param: { projectId } }))
      } catch {
        this.set({ status: 'error' })
        return
      }
    }
    if (this.disposed) return
    remember(projectId, link)
    this.set({ link, phones: [], status: 'connecting' })
    this.unsubscribe ??= this.session.subscribe(() => this.schedulePush())
    this.connect(link)
  }

  private connect(link: LiveLink) {
    this.ws?.close()
    const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(
      `${scheme}//${location.host}${LIVE_STUDIO_PATH}?token=${encodeURIComponent(link.token)}`,
    )
    this.ws = ws
    ws.onopen = () => {
      this.attempt = 0
      this.set({ status: 'live' })
      void this.push()
    }
    ws.onmessage = (event) => {
      let message: LiveToStudio
      try {
        message = JSON.parse(String(event.data)) as LiveToStudio
      } catch {
        return
      }
      if (message.type === 'phones') {
        const before = useLive.getState().phones.length
        this.set({ phones: message.phones })
        // A phone that arrives gets the current project from the server; nothing to do.
        if (message.phones.length > before) void this.push()
      } else if (message.type === 'log') {
        const entry: PhoneLog = { ...message.entry, id: nextLog++, device: message.device }
        this.set({ logs: [...useLive.getState().logs.slice(-(MAX_LOGS - 1)), entry] })
        useEditor.getState().log({ ...message.entry, source: message.device })
      } else if (message.type === 'ended') {
        this.end(message.reason)
      }
    }
    ws.onclose = (event) => {
      if (this.ws !== ws || this.disposed) return
      const final = FINAL_CODES[event.code]
      if (final) {
        this.end(final)
        return
      }
      this.set({ status: 'offline' })
      this.attempt += 1
      this.retry = setTimeout(() => this.connect(link), Math.min(10_000, 500 * 2 ** this.attempt))
    }
  }

  private end(reason: LiveEndReason) {
    this.ws = null
    clearTimeout(this.retry)
    remember(this.session.id, null)
    this.set({ status: 'ended', ended: reason, phones: [] })
  }

  private schedulePush() {
    clearTimeout(this.pushTimer)
    this.pushTimer = setTimeout(() => void this.push(), PUSH_DELAY_MS)
  }

  /** Sends the current project; changes made meanwhile leave right after. */
  private async push() {
    if (this.pushing) {
      this.pushAgain = true
      return
    }
    if (this.ws?.readyState !== WebSocket.OPEN) return
    this.pushing = true
    try {
      const bundle = await buildBundle(this.session.getDoc())
      this.send({ type: 'load', bundle })
    } finally {
      this.pushing = false
      if (this.pushAgain) {
        this.pushAgain = false
        void this.push()
      }
    }
  }

  send(message: LiveFromStudio) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(message))
  }

  /** Revokes the link: the phones are disconnected. */
  async stop() {
    const link = useLive.getState().link
    this.dispose()
    remember(this.session.id, null)
    useLive.setState({ link: null, status: 'idle', phones: [], ended: null })
    if (link) {
      await call(
        api.projects[':projectId'].live[':linkId'].$delete({
          param: { projectId: this.session.id, linkId: link.id },
        }),
      ).catch(() => {})
    }
  }

  /** Leaves the editor: the link stays valid for this tab, the phones wait. */
  dispose() {
    this.disposed = true
    clearTimeout(this.retry)
    clearTimeout(this.pushTimer)
    this.unsubscribe?.()
    this.unsubscribe = null
    const ws = this.ws
    this.ws = null
    ws?.close()
  }
}

let controller: LiveController | null = null

export const live = {
  /** Opens (or reuses) the live link of the project and starts feeding it. */
  async start(session: ProjectSession, fresh = false) {
    if (controller && !fresh && useLive.getState().projectId === session.id) {
      const { status } = useLive.getState()
      if (status !== 'ended' && status !== 'error' && status !== 'idle') return
    }
    controller?.dispose()
    controller = new LiveController(session)
    await controller.start(fresh)
  },
  restart(screenId?: string) {
    controller?.send({ type: 'restart', screenId })
  },
  async stop() {
    await controller?.stop()
    controller = null
  },
  /** The editor closes. */
  dispose() {
    controller?.dispose()
    controller = null
    useLive.setState({
      projectId: null,
      link: null,
      status: 'idle',
      ended: null,
      phones: [],
      logs: [],
    })
  },
}
