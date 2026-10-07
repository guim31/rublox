import { detectLocale, messages } from '@rublox/i18n'
import {
  Engine,
  isStudioMessage,
  originOf,
  PlayerApp,
  type PlayerToStudio,
  readConfig,
  type Scheme,
  type SlowMotion,
  type StudioToPlayer,
} from '@rublox/runtime'
import type { DataCredential, Locale } from '@rublox/schema'
import { useEffect, useRef, useState } from 'react'
import { studioAi } from './ai.ts'
import { serverServices } from './data.ts'
import { Stopped } from './run.tsx'

const config = readConfig()
const studioOrigin = originOf(config.studioUrl)

function send(message: PlayerToStudio): void {
  if (window.parent !== window) window.parent.postMessage(message, studioOrigin)
}

/** The AI component asks through the studio, which answers with `rx:ai-reply` (J6). */
const ai = studioAi(send)

type State = {
  engine: Engine
  locale: Locale
  scheme?: Scheme
  inspect: boolean
}

/**
 * The editor's live preview. It only listens to the studio origin, runs what it receives in
 * an `Engine`, and reports logs and state back.
 */
export function Preview() {
  const [state, setState] = useState<State | null>(null)
  const engineRef = useRef<Engine | null>(null)
  const assets = useRef(new Map<string, string>())
  const slow = useRef<SlowMotion>({ enabled: false, delay: 500, breakpoints: [] })
  // The editor's ticket for the API relay and the shared data (renewed by the editor).
  const credential = useRef<DataCredential | null>(null)

  useEffect(() => {
    const onMessage = async (event: MessageEvent) => {
      if (event.origin !== studioOrigin || event.source !== window.parent) return
      const message = event.data as unknown
      if (!isStudioMessage(message)) return
      await handle(message)
    }

    const handle = async (message: StudioToPlayer) => {
      const engine = engineRef.current
      switch (message.type) {
        case 'rx:ai-reply':
          ai.answer(message.id, message.reply)
          return
        case 'rx:load': {
          if (message.services !== undefined) credential.current = message.services
          if (message.assets) {
            for (const url of assets.current.values()) URL.revokeObjectURL(url)
            assets.current = new Map(
              Object.entries(message.assets).map(([id, blob]) => [id, URL.createObjectURL(blob)]),
            )
          }
          if (engine) {
            setState(
              (previous) =>
                previous && { ...previous, locale: message.locale, scheme: message.scheme },
            )
            await engine.update(message.doc, message.code)
            return
          }
          const created = new Engine({
            doc: message.doc,
            code: message.code,
            locale: message.locale,
            mode: message.mode,
            initialScreen: message.screenId,
            slow: slow.current,
            assetUrl: (value) => assets.current.get(value),
            // A guest's project has no ticket: no relay, no shared data (the engine says why).
            services: credential.current ? serverServices(() => credential.current) : undefined,
            ai: ai.provider,
            host: {
              log: (entry) => send({ type: 'rx:log', entry }),
              state: (s) => send({ type: 'rx:state', running: s.running, screenId: s.screenId }),
              event: (appEvent) => send({ type: 'rx:event', event: appEvent }),
              step: (step) => send({ type: 'rx:step', step }),
            },
          })
          engineRef.current = created
          setState({
            engine: created,
            locale: message.locale,
            scheme: message.scheme,
            inspect: false,
          })
          await created.start()
          return
        }
        case 'rx:restart':
          await engine?.restart(message.screenId)
          return
        case 'rx:stop':
          engine?.stop()
          return
        case 'rx:scheme':
          setState((previous) => previous && { ...previous, scheme: message.scheme })
          return
        case 'rx:slow':
          slow.current = message.slow
          engine?.setSlowMotion(message.slow)
          return
        case 'rx:resume':
          engine?.resume(message.step)
          return
        case 'rx:inspect':
          setState((previous) => previous && { ...previous, inspect: message.enabled })
          return
      }
    }

    window.addEventListener('message', onMessage)
    send({ type: 'rx:ready' })
    return () => window.removeEventListener('message', onMessage)
  }, [])

  if (!state) return <Waiting />
  const { engine } = state
  return (
    <>
      <PlayerApp
        engine={engine}
        locale={state.locale}
        scheme={state.scheme}
        assetUrl={(value) =>
          assets.current.get(value) ?? (/^https:\/\//i.test(value) ? value : undefined)
        }
        onInspect={
          state.inspect
            ? (componentId) => {
                const screenId = engine.getSnapshot().screen?.screenId
                if (screenId) send({ type: 'rx:select', screenId, componentId })
              }
            : undefined
        }
      />
      <Stopped engine={engine} locale={state.locale} />
    </>
  )
}

function Waiting() {
  const locale = detectLocale()
  const inFrame = window.parent !== window
  return (
    <div className="waiting">
      {inFrame ? (
        <div className="spinner" role="status" aria-label="…" />
      ) : (
        <p>{messages[locale].studio.playerIntro}</p>
      )}
    </div>
  )
}
