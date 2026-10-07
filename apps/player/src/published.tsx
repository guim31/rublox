import { detectLocale, messages } from '@rublox/i18n'
import { Engine } from '@rublox/runtime'
import type { PublishedApp } from '@rublox/schema'
import { useCallback, useEffect, useState } from 'react'
import { serverAi } from './ai.ts'
import { InstallButton, InstallHelp } from './install.tsx'
import { assetResolver, Message, RunningApp } from './run.tsx'

type Loaded = { app: PublishedApp; engine: Engine }
type Failure = 'offline' | 'error'

/**
 * A published app (`/a/<slug>/`, SPEC § 4.6) or an exported website (`./`): it loads its
 * frozen version, runs it with its own storage, and offers to install it. Its service worker
 * keeps everything for offline use.
 */
export function PublishedView({
  base,
  slug,
  install,
  serviceWorker,
}: {
  /** The published app's address (`/a/<slug>/`); absent for an exported website. */
  slug?: string
  /** Path of the app, ending with `/`: `/a/<slug>/`, or the folder of an exported site. */
  base: string
  install: boolean
  serviceWorker: boolean
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [helping, setHelping] = useState(false)

  const load = useCallback(async () => {
    setFailure(null)
    try {
      const response = await fetch(`${base}app.json`, { cache: 'no-cache' })
      if (!response.ok) throw new Error(String(response.status))
      const app = (await response.json()) as PublishedApp
      const engine = new Engine({
        doc: app.doc,
        code: app.code,
        locale: app.doc.meta.locale,
        mode: app.doc.meta.mode,
        appId: `app:${app.appId}`,
        // The AI component works if the owner allowed it (J6); an exported site has none.
        ai: slug ? serverAi({ slug }) : undefined,
        host: { log: () => {} },
      })
      document.title = app.settings.name
      setLoaded({ app, engine })
      if (!install) await engine.start()
    } catch {
      setFailure(navigator.onLine ? 'error' : 'offline')
    }
  }, [base, install, slug])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!loaded) return
    return () => loaded.engine.dispose()
  }, [loaded])

  // Offline use: one service worker per app, scoped to its address.
  useEffect(() => {
    if (!serviceWorker || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {})
  }, [base, serviceWorker])

  // The manifest link, when the page did not come with it (development server).
  useEffect(() => {
    if (!loaded || document.querySelector('link[rel="manifest"]')) return
    const link = document.createElement('link')
    link.rel = 'manifest'
    link.href = `${base}manifest.webmanifest`
    document.head.append(link)
  }, [base, loaded])

  if (failure) {
    const strings = messages[detectLocale()].player.app
    return (
      <Message
        title={failure === 'offline' ? strings.offline : strings.error}
        action={{ label: strings.retry, onClick: () => void load() }}
      />
    )
  }
  if (!loaded) return <Message busy />
  const { app, engine } = loaded
  const locale = app.doc.meta.locale
  if (install) {
    return (
      <InstallHelp
        name={app.settings.name}
        icon={`${base}icon-192.png`}
        locale={locale}
        openHref={base}
      />
    )
  }
  return (
    <>
      <RunningApp
        engine={engine}
        locale={locale}
        assetUrl={assetResolver(() => app.doc, base === './' ? './' : '/')}
      />
      <InstallButton appId={app.appId} locale={locale} onOpen={() => setHelping(true)} />
      {helping ? (
        <div
          className="install-sheet"
          role="dialog"
          aria-modal="true"
          aria-label={app.settings.name}
        >
          <InstallHelp
            name={app.settings.name}
            icon={`${base}icon-192.png`}
            locale={locale}
            onClose={() => setHelping(false)}
          />
        </div>
      ) : null}
    </>
  )
}
