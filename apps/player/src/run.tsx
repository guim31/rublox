import { messages } from '@rublox/i18n'
import { type Engine, PlayerApp } from '@rublox/runtime'
import type { Locale, ProjectDoc } from '@rublox/schema'
import { useEffect, useState } from 'react'

/** Where a project file lives on this origin: `/assets/<sha256>`, or next to an exported site. */
export function assetResolver(getDoc: () => ProjectDoc, base = '/') {
  return (value: string): string | undefined => {
    const asset = getDoc().assets[value]
    if (asset) return `${base}assets/${asset.sha256}`
    return /^https:\/\//i.test(value) ? value : undefined
  }
}

/** A running app, full screen, with the "stopped" bar. */
export function RunningApp({
  engine,
  locale,
  assetUrl,
}: {
  engine: Engine
  locale: Locale
  assetUrl: (value: string) => string | undefined
}) {
  return (
    <>
      <PlayerApp engine={engine} locale={locale} assetUrl={assetUrl} />
      <Stopped engine={engine} locale={locale} />
    </>
  )
}

export function Stopped({ engine, locale }: { engine: Engine; locale: Locale }) {
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

/** A centred message (loading, waiting, error), with an optional action. */
export function Message({
  title,
  text,
  busy,
  action,
}: {
  title?: string
  text?: string
  busy?: boolean
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="waiting">
      <div className="message">
        {busy ? <div className="spinner" role="status" aria-label={title ?? text ?? '…'} /> : null}
        {title ? <h1>{title}</h1> : null}
        {text ? <p>{text}</p> : null}
        {action ? (
          <button type="button" className="message-action" onClick={action.onClick}>
            {action.label}
          </button>
        ) : null}
      </div>
    </div>
  )
}
