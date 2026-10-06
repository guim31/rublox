import { APP_WORKSPACE } from '@rublox/schema'
import { Link } from '@tanstack/react-router'
import QRCode from 'qrcode'
import { lazy, Suspense, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Mascot } from '../components/brand.tsx'
import { Button } from '../components/ui/button.tsx'
import { usePrefs } from '../lib/prefs.ts'
import type { EditorTab } from '../routes/p.$projectId.tsx'
import { ConsolePanel } from './console.tsx'
import { SessionProvider, useDoc } from './context.tsx'
import { DesignView } from './design/design-view.tsx'
import { EditorCommands } from './editor-commands.tsx'
import { resolveScreen, resolveWorkspace } from './nav.ts'
import { ProjectSession } from './session.ts'
import { resetEditor, useEditor } from './store.ts'
import { TopBar } from './top-bar.tsx'

// Blockly is heavy: loaded only when the Blocks tab opens (SPEC § 7, performance).
const BlocksView = lazy(() => import('./blocks/blocks-view.tsx'))

type Props = { projectId: string; tab: EditorTab; screen?: string }

export function EditorPage(props: Props) {
  const { t } = useTranslation()
  const [session, setSession] = useState<ProjectSession | null | 'missing'>(null)

  useEffect(() => {
    let cancelled = false
    let opened: ProjectSession | null = null
    resetEditor()
    void ProjectSession.open(props.projectId).then((result) => {
      if (cancelled) {
        void result?.dispose()
        return
      }
      opened = result
      setSession(result ?? 'missing')
    })
    return () => {
      cancelled = true
      void opened?.dispose()
      setSession(null)
    }
  }, [props.projectId])

  if (session === 'missing') {
    return (
      <main className="grid h-full place-items-center p-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <Mascot size={110} />
          <h1 className="text-ui-xl font-strong">{t('editor.loadError')}</h1>
          <Link to="/">
            <Button variant="primary">{t('editor.loadErrorAction')}</Button>
          </Link>
        </div>
      </main>
    )
  }
  if (!session) return <Loading />
  return (
    <SessionProvider session={session}>
      <SmallScreenGuard>
        <Editor {...props} />
      </SmallScreenGuard>
    </SessionProvider>
  )
}

function Editor({ projectId, tab, screen }: Props) {
  const doc = useDoc()
  const screenId = resolveScreen(doc, screen)
  const workspace = tab === 'blocks' ? resolveWorkspace(doc, screen) : screenId
  const consoleOpen = usePrefs((s) => s.consoleOpen)
  const announcement = useEditor((s) => s.announcement)

  useEffect(() => {
    document.title = `${doc.meta.name} · Rublox`
    return () => {
      document.title = 'Rublox'
    }
  }, [doc.meta.name])

  return (
    <div className="flex h-full flex-col bg-bg">
      <TopBar projectId={projectId} tab={tab} screenId={workspace} />
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          {tab === 'design' ? (
            <DesignView screenId={screenId} />
          ) : (
            <Suspense fallback={<Loading />}>
              <BlocksView
                projectId={projectId}
                workspace={workspace}
                previewScreen={workspace === APP_WORKSPACE ? screenId : workspace}
              />
            </Suspense>
          )}
        </div>
        <ConsolePanel open={consoleOpen} projectId={projectId} />
      </div>
      <EditorCommands projectId={projectId} tab={tab} screenId={screenId} />
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  )
}

function Loading() {
  const { t } = useTranslation()
  return (
    <div className="grid h-full place-items-center" role="status">
      <div className="flex flex-col items-center gap-3 text-muted">
        <div className="size-8 animate-spin rounded-full border-3 border-border border-t-primary" />
        <span>{t('common.loading')}</span>
      </div>
    </div>
  )
}

/** Below 1024 px, the editor offers to continue on a bigger screen (SPEC § 5.3). */
function SmallScreenGuard({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const [small, setSmall] = useState(() => window.innerWidth < 1024)
  const [qr, setQr] = useState('')
  useEffect(() => {
    const query = matchMedia('(max-width: 1023px)')
    const update = () => setSmall(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    if (small) void QRCode.toString(location.href, { type: 'svg', margin: 1 }).then(setQr)
  }, [small])
  if (!small) return children
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <Mascot size={96} />
      <h1 className="text-ui-xl font-strong">{t('editor.smallScreenTitle')}</h1>
      <p className="max-w-sm text-muted">{t('editor.smallScreenText')}</p>
      <div
        className="size-44 rounded-ui-lg bg-white p-2"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG generated locally by `qrcode`
        dangerouslySetInnerHTML={{ __html: qr }}
      />
      <Link to="/">
        <Button>{t('editor.loadErrorAction')}</Button>
      </Link>
    </main>
  )
}
