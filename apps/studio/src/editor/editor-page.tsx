import { APP_WORKSPACE } from '@rublox/schema'
import { Link, useNavigate } from '@tanstack/react-router'
import { Copy, Eye, Shuffle } from 'lucide-react'
import QRCode from 'qrcode'
import { lazy, Suspense, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AiPanel } from '../ai/panel.tsx'
import { Mascot } from '../components/brand.tsx'
import { Button } from '../components/ui/button.tsx'
import { HelpPanel } from '../help/help-panel.tsx'
import { BadgeWatcher } from '../learn/badges.tsx'
import { ChallengePanel } from '../learn/challenge-panel.tsx'
import { awardBadge } from '../learn/store.ts'
import { TourRunner } from '../learn/tour.tsx'
import { TutorialRunner } from '../learn/tutorial-runner.tsx'
import { ApiError } from '../lib/api.ts'
import { errorMessage } from '../lib/errors.ts'
import { usePrefs } from '../lib/prefs.ts'
import { useMe } from '../lib/session.ts'
import type { EditorTab } from '../routes/p.$projectId.tsx'
import { serverBackend } from '../storage/backend.ts'
import { ConsolePanel } from './console.tsx'
import { SessionProvider, useDoc, useSaveState, useSession } from './context.tsx'
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
  const me = useMe()
  const kind = me.isPending ? null : me.data?.user ? 'server' : 'guest'
  const [session, setSession] = useState<ProjectSession | null | 'missing' | 'offline'>(null)

  useEffect(() => {
    if (!kind) return
    let cancelled = false
    let opened: ProjectSession | null = null
    resetEditor()
    ProjectSession.open(props.projectId, kind).then(
      (result) => {
        if (cancelled) {
          void result?.dispose()
          return
        }
        opened = result
        setSession(result ?? 'missing')
      },
      // Not cached in this browser and no server to ask: say so, rather than "missing".
      (error) =>
        !cancelled &&
        setSession(error instanceof ApiError && error.status === 0 ? 'offline' : 'missing'),
    )
    return () => {
      cancelled = true
      void opened?.dispose()
      setSession(null)
    }
  }, [props.projectId, kind])

  if (session === 'missing' || session === 'offline') {
    return (
      <main className="grid h-full place-items-center p-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <Mascot size={110} />
          <h1 className="text-ui-xl font-strong">
            {session === 'offline'
              ? t('errors.network')
              : kind === 'server'
                ? t('sync.loadError')
                : t('editor.loadError')}
          </h1>
          <Link to="/">
            <Button variant="primary">{t('editor.loadErrorAction')}</Button>
          </Link>
        </div>
      </main>
    )
  }
  if (!session || !kind) return <Loading />
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
  const consoleOpen = usePrefs((s) => s.consoleOpen[s.mode])
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
      <ReadOnlyBanner />
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
        <ConsolePanel open={consoleOpen} projectId={projectId} workspace={screenId} />
      </div>
      <EditorCommands projectId={projectId} tab={tab} screenId={screenId} />
      <HelpPanel />
      <AiPanel projectId={projectId} />
      <BadgeWatcher />
      <ChallengePanel projectId={projectId} tab={tab} workspace={workspace} />
      <TutorialRunner projectId={projectId} tab={tab} workspace={workspace} />
      <TourRunner tab={tab} />
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  )
}

/** For viewers and space managers: what they see is not saved (SPEC § 4.7, § 4.8). */
function ReadOnlyBanner() {
  const { t } = useTranslation()
  const session = useSession()
  const navigate = useNavigate()
  useSaveState()
  if (!session.readOnly) return null
  const owner = session.source.owner?.displayName ?? ''
  // A gallery project (J6): "Remix" makes a copy that keeps the credit.
  const gallery = session.source.access === 'gallery'
  return (
    <div
      role="note"
      className="flex shrink-0 items-center gap-3 border-b border-border bg-yellow-soft px-4 py-2"
    >
      <Eye size={18} className="shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-ui-sm">
        {gallery
          ? t('gallery.readOnly.banner', { name: owner })
          : t('sync.readOnlyBanner', { name: owner })}
      </p>
      <Button
        size="sm"
        variant={gallery ? 'primary' : undefined}
        icon={gallery ? <Shuffle size={15} /> : <Copy size={15} />}
        onClick={async () => {
          try {
            const current = session.getDoc().meta.name
            const name = gallery
              ? t('gallery.remixName', { name: current })
              : t('dashboard.copyName', { name: current })
            const id = await serverBackend.duplicate(session.id, name)
            toast.success(gallery ? t('gallery.remixed') : t('sync.duplicated'))
            if (gallery) void awardBadge('first-remix')
            await navigate({
              to: '/p/$projectId',
              params: { projectId: id },
              search: { tab: 'design' },
            })
          } catch (error) {
            toast.error(errorMessage(t, error))
          }
        }}
      >
        {gallery ? t('gallery.readOnly.remix') : t('sync.duplicate')}
      </Button>
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
