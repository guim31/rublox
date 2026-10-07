import { detectLocale, messages } from '@rublox/i18n'
import { Engine } from '@rublox/runtime'
import {
  LIVE_PHONE_PATH,
  type LiveEndReason,
  type LiveFromPhone,
  type LiveToPhone,
  type ProjectDoc,
} from '@rublox/schema'
import { useEffect, useRef, useState } from 'react'
import { deviceLabel } from './page.ts'
import { assetResolver, Message, RunningApp } from './run.tsx'

type Status = 'connecting' | 'live' | 'offline'

/** Close codes of a link that will not come back (`apps/server/src/live.ts`). */
const FINAL_CODES = new Set([4003, 4004, 4010])
const MAX_LOG = 2000

/**
 * "Test on my phone" (SPEC § 4.3): `/live/<token>` follows the editor through the server.
 * Each project the editor sends is applied at once (design kept, changed screens restarted);
 * the console of the phone goes back to the editor.
 */
export function LiveView({ token }: { token: string }) {
  const locale = detectLocale()
  const strings = messages[locale].player.live
  const [status, setStatus] = useState<Status>('connecting')
  const [editor, setEditor] = useState(true)
  const [ended, setEnded] = useState<LiveEndReason | null>(null)
  const [engine, setEngine] = useState<Engine | null>(null)
  const doc = useRef<ProjectDoc | null>(null)

  useEffect(() => {
    let ws: WebSocket | null = null
    let attempt = 0
    let retry: ReturnType<typeof setTimeout> | undefined
    let stopped = false
    let current: Engine | null = null

    const send = (message: LiveFromPhone) => {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message))
    }

    const handle = async (message: LiveToPhone) => {
      switch (message.type) {
        case 'load': {
          const { doc: next, code } = message.bundle
          doc.current = next
          if (current) {
            await current.update(next, code)
            return
          }
          current = new Engine({
            doc: next,
            code,
            locale: next.meta.locale,
            mode: next.meta.mode,
            appId: `live:${next.meta.id}`,
            host: {
              log: (entry) =>
                send({
                  type: 'log',
                  entry: { ...entry, message: entry.message.slice(0, MAX_LOG) },
                }),
              state: (state) =>
                send({ type: 'state', running: state.running, screenId: state.screenId }),
            },
          })
          setEngine(current)
          await current.start()
          return
        }
        case 'restart':
          await current?.restart(message.screenId)
          return
        case 'editor':
          setEditor(message.connected)
          return
        case 'ended':
          stopped = true
          setEnded(message.reason)
          current?.stop()
          return
      }
    }

    const connect = () => {
      const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:'
      ws = new WebSocket(
        `${scheme}//${location.host}${LIVE_PHONE_PATH}?token=${encodeURIComponent(token)}`,
      )
      ws.onopen = () => {
        attempt = 0
        setStatus('live')
        send({ type: 'hello', device: deviceLabel() })
      }
      ws.onmessage = (event) => {
        try {
          void handle(JSON.parse(String(event.data)) as LiveToPhone)
        } catch {
          // Not for us.
        }
      }
      ws.onclose = (event) => {
        if (stopped) return
        if (FINAL_CODES.has(event.code)) {
          setEnded(event.code === 4003 ? 'revoked' : event.code === 4010 ? 'expired' : 'not-found')
          return
        }
        setStatus('offline')
        attempt += 1
        retry = setTimeout(connect, Math.min(10_000, 500 * 2 ** attempt))
      }
    }
    connect()

    // Keep the screen on while testing, where the browser allows it.
    let lock: { release(): Promise<void> } | null = null
    const wake = async () => {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> }
        }
        if (document.visibilityState === 'visible')
          lock = (await nav.wakeLock?.request('screen')) ?? null
      } catch {
        lock = null
      }
    }
    void wake()
    document.addEventListener('visibilitychange', wake)

    return () => {
      stopped = true
      clearTimeout(retry)
      ws?.close()
      current?.dispose()
      void lock?.release().catch(() => {})
      document.removeEventListener('visibilitychange', wake)
    }
  }, [token])

  if (ended) return <Message title={strings.ended[ended]} text={strings.endedHint} />
  if (!engine) {
    return (
      <Message
        busy
        title={status === 'offline' ? strings.offline : strings.connecting}
        text={status === 'live' ? strings.waiting : undefined}
      />
    )
  }
  const warning = status === 'offline' ? strings.offline : editor ? null : strings.editorGone
  return (
    <>
      <RunningApp
        engine={engine}
        locale={locale}
        assetUrl={assetResolver(() => doc.current ?? engine.getSnapshot().doc)}
      />
      <div
        className="live-badge"
        data-state={warning ? 'warning' : 'live'}
        role="status"
        aria-live="polite"
        data-testid="live-badge"
      >
        <span className="live-dot" aria-hidden="true" />
        {warning ?? strings.badge}
      </div>
    </>
  )
}
