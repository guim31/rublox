import { type Locale, messages } from '@rublox/i18n'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { isStandalone } from './page.ts'

type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> }

/** The browser's install prompt (Chromium), kept from the start of the page. */
let deferred: InstallPrompt | null = null
let installed = false
const listeners = new Set<() => void>()
const changed = () => {
  for (const listener of listeners) listener()
}

export function listenForInstall() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferred = event as InstallPrompt
    changed()
  })
  window.addEventListener('appinstalled', () => {
    installed = true
    deferred = null
    changed()
  })
}

function useInstallState() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => (installed ? 'installed' : deferred ? 'prompt' : 'manual'),
  )
}

type Platform = 'ios' | 'android' | 'desktop'

function platform(): Platform {
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) {
    return 'ios'
  }
  return /Android/.test(ua) ? 'android' : 'desktop'
}

/**
 * "Install on the home screen" (SPEC § 4.6): the browser's own prompt when there is one, and
 * the steps for iOS, Android and computers, this device's first.
 */
export function InstallHelp({
  name,
  icon,
  locale,
  onClose,
  openHref,
}: {
  name: string
  icon: string
  locale: Locale
  onClose?: () => void
  openHref?: string
}) {
  const strings = messages[locale].player.install
  const state = useInstallState()
  const here = platform()
  const steps: Record<Platform, { title: string; steps: string[] }> = {
    ios: { title: strings.ios, steps: [strings.iosStep1, strings.iosStep2, strings.iosStep3] },
    android: {
      title: strings.android,
      steps: [strings.androidStep1, strings.androidStep2, strings.androidStep3],
    },
    desktop: { title: strings.desktop, steps: [strings.desktopStep1] },
  }
  const order: Platform[] = [
    here,
    ...(['ios', 'android', 'desktop'] as const).filter((p) => p !== here),
  ]
  return (
    <div className="install" data-testid="install-help">
      <header className="install-head">
        <img src={icon} alt="" width={72} height={72} className="install-icon" />
        <h1>{strings.title.replace('{{name}}', name)}</h1>
        <p>{state === 'installed' || isStandalone() ? strings.installed : strings.intro}</p>
      </header>
      {state === 'prompt' ? (
        <button
          type="button"
          className="install-primary"
          onClick={async () => {
            await deferred?.prompt()
            const choice = await deferred?.userChoice
            if (choice?.outcome === 'accepted') installed = true
            deferred = null
            changed()
          }}
        >
          {strings.now}
        </button>
      ) : null}
      {order.map((key) => (
        <section key={key} className="install-section" data-current={key === here}>
          <h2>{steps[key].title}</h2>
          <ol>
            {steps[key].steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      ))}
      <div className="install-actions">
        {openHref ? (
          <a className="install-primary" href={openHref}>
            {strings.open}
          </a>
        ) : null}
        {onClose ? (
          <button type="button" className="install-secondary" onClick={onClose}>
            {strings.close}
          </button>
        ) : null}
      </div>
      <p className="install-footer">{strings.madeWith}</p>
    </div>
  )
}

/**
 * A small "Install" button over a published app opened in a browser tab (never once installed,
 * nor inside a frame). Dismissed for good per app.
 */
export function InstallButton({
  appId,
  locale,
  onOpen,
}: {
  appId: string
  locale: Locale
  onOpen: () => void
}) {
  const strings = messages[locale].player.install
  const key = `rublox:${appId}:install-dismissed`
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(key) === '1'
    } catch {
      return false
    }
  })
  const state = useInstallState()
  useEffect(() => {
    if (state === 'installed') setHidden(true)
  }, [state])
  if (hidden || isStandalone() || window.parent !== window) return null
  return (
    <div className="install-pill">
      <button
        type="button"
        className="install-pill-open"
        onClick={onOpen}
        data-testid="install-button"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path
            d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {strings.button}
      </button>
      <button
        type="button"
        className="install-pill-close"
        aria-label={strings.dismiss}
        title={strings.dismiss}
        onClick={() => {
          setHidden(true)
          try {
            localStorage.setItem(key, '1')
          } catch {
            // Hidden for this visit only.
          }
        }}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path
            d="M6 6l12 12M18 6 6 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  )
}
