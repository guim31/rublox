import { detectLocale, messages } from '@rublox/i18n'
import {
  Engine,
  isStudioMessage,
  originOf,
  PlayerApp,
  type PlayerToStudio,
  readConfig,
  type Scheme,
  type StudioToPlayer,
} from '@rublox/runtime'
import type { Locale } from '@rublox/schema'
import { useEffect, useRef, useState } from 'react'

const config = readConfig()
const studioOrigin = originOf(config.studioUrl)

function send(message: PlayerToStudio): void {
  if (window.parent !== window) window.parent.postMessage(message, studioOrigin)
}

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
        case 'rx:load': {
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
            host: {
              log: (entry) => send({ type: 'rx:log', entry }),
              state: (s) => send({ type: 'rx:state', running: s.running, screenId: s.screenId }),
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

function Stopped({ engine, locale }: { engine: Engine; locale: Locale }) {
  const [running, setRunning] = useState(engine.getSnapshot().running)
  useEffect(() => engine.subscribe(() => setRunning(engine.getSnapshot().running)), [engine])
  if (running) return null
  const strings = messages[locale].runtime
  return (
    <div className="stopped" role="status">
      <p>{strings.stopped}</p>
      <button type="button" onClick={() => void engine.restart()}>
        {strings.restart}
      </button>
    </div>
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
