import { messages } from '@rublox/i18n'
import type { Locale } from '@rublox/schema'
import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { Engine } from './engine.ts'
import { AppSurface, ScreenView } from './screen-view.tsx'
import { resolveScheme, type Scheme } from './theme.ts'

export type PlayerAppProps = {
  engine: Engine
  /** Language of the player's own texts (dialog buttons). */
  locale: Locale
  /** Forces the app's light or dark theme (the editor's preview switch). */
  scheme?: Scheme
  assetUrl?: (value: string) => string | undefined
  /** Inspect mode: a click selects the component in the editor instead of using it. */
  onInspect?: (componentId: string) => void
}

function usePrefersDark(): boolean {
  const query = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null
  const [dark, setDark] = useState(query?.matches ?? false)
  useEffect(() => {
    if (!query) return
    const listener = () => setDark(query.matches)
    query.addEventListener('change', listener)
    return () => query.removeEventListener('change', listener)
  }, [query])
  return dark
}

/** A running app: the current screen, its back bar, dialogs and short messages. */
export function PlayerApp(props: PlayerAppProps): ReactNode {
  const { engine } = props
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot)
  const prefersDark = usePrefersDark()
  const { doc, screen } = snapshot
  const scheme = resolveScheme(doc.settings.theme, prefersDark, props.scheme)
  const strings = messages[props.locale].runtime
  const current = screen ? doc.screens[screen.screenId] : undefined
  const title = current
    ? String(current.components[current.rootId]?.props.title ?? '') ||
      (snapshot.depth > 1 ? current.name : '')
    : ''
  return (
    <AppSurface theme={doc.settings.theme} scheme={scheme}>
      <div className="rx-player">
        {snapshot.depth > 1 || title ? (
          <header className="rx-bar">
            {snapshot.depth > 1 ? (
              <button
                type="button"
                className="rx-bar-back"
                aria-label={strings.back}
                onClick={() => engine.back()}
              >
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                  <path
                    d="M15 5l-7 7 7 7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            ) : null}
            <span className="rx-bar-title">{title}</span>
          </header>
        ) : null}
        <main className="rx-main">
          {current && screen ? (
            <ScreenView
              key={screen.key}
              screen={current}
              locale={doc.meta.locale}
              mode="run"
              overrides={screen.overrides}
              emit={(id, event) => {
                if (props.onInspect && event === 'click') props.onInspect(id)
                else engine.emit(id, event)
              }}
              setValue={(id, prop, value) => engine.setValue(id, prop, value)}
              assetUrl={props.assetUrl}
            />
          ) : null}
        </main>
        {snapshot.dialogs[0] ? (
          <DialogView key={snapshot.dialogs[0].id} engine={engine} locale={props.locale} />
        ) : null}
        <div className="rx-toasts" aria-live="polite">
          {snapshot.toasts.map((toast) => (
            <div key={toast.id} className="rx-toast">
              {toast.message}
            </div>
          ))}
        </div>
      </div>
    </AppSurface>
  )
}

function DialogView({ engine, locale }: { engine: Engine; locale: Locale }) {
  const dialog = engine.getSnapshot().dialogs[0]
  const strings = messages[locale].runtime
  const [answer, setAnswer] = useState('')
  const first = useRef<HTMLButtonElement & HTMLInputElement>(null)
  useEffect(() => first.current?.focus(), [])
  if (!dialog) return null
  const close = (value: unknown) => dialog.resolve(value)
  return (
    <div className="rx-dialog-backdrop">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`rx-dialog-${dialog.id}`}
        className="rx-dialog"
      >
        <p id={`rx-dialog-${dialog.id}`} className="rx-dialog-message">
          {dialog.message}
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            close(dialog.kind === 'prompt' ? answer : true)
          }}
        >
          {dialog.kind === 'prompt' ? (
            <input
              ref={first}
              className="rx-dialog-input"
              value={answer}
              aria-label={dialog.message}
              onChange={(event) => setAnswer(event.target.value)}
            />
          ) : null}
          <div className="rx-dialog-actions">
            {dialog.kind !== 'alert' ? (
              <button
                type="button"
                className="rx-dialog-button"
                onClick={() => close(dialog.kind === 'confirm' ? false : null)}
              >
                {dialog.kind === 'confirm' ? strings.no : strings.cancel}
              </button>
            ) : null}
            <button
              ref={dialog.kind === 'prompt' ? undefined : first}
              type="submit"
              className="rx-dialog-button rx-dialog-primary"
            >
              {dialog.kind === 'confirm' ? strings.yes : strings.ok}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
