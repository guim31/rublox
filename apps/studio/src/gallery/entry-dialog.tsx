import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Blocks, GitFork, Heart, Shuffle, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Avatar } from '../components/avatar.tsx'
import { ConfirmDialog } from '../components/dialogs.tsx'
import { PhoneFrame } from '../components/phone.tsx'
import { Button } from '../components/ui/button.tsx'
import { Dialog } from '../components/ui/dialog.tsx'
import { PROJECTS_KEY } from '../dashboard/queries.ts'
import { ProjectThumbnail } from '../dashboard/thumbnail.tsx'
import { awardBadge } from '../learn/store.ts'
import { api, call } from '../lib/api.ts'
import { config } from '../lib/config.ts'
import { errorMessage } from '../lib/errors.ts'
import { isDark, usePrefs } from '../lib/prefs.ts'
import { useUser } from '../lib/session.ts'
import { GALLERY_KEY, galleryEntry, type RemixNode, remix, useLike } from './queries.ts'

const PHONE = { width: 360, height: 740 }

/**
 * One gallery project: "Try it" (its published app in a phone, SPEC § 4.11), "See the
 * blocks" (the editor, read-only), "Remix", likes and the tree of remixes.
 */
export function EntryDialog({
  projectId,
  onClose,
}: {
  projectId: string | null
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const user = useUser()
  const navigate = useNavigate()
  const client = useQueryClient()
  const { theme } = usePrefs()
  const like = useLike()
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState(false)
  const detail = useQuery({
    queryKey: [...GALLERY_KEY, 'entry', projectId],
    queryFn: () => galleryEntry(projectId as string),
    enabled: projectId !== null,
    staleTime: 0,
  })
  const data = detail.data
  const entry = data?.entry

  const doRemix = async () => {
    if (!entry) return
    setBusy(true)
    try {
      const id = await remix(entry.id, t('gallery.remixName', { name: entry.name }))
      await client.invalidateQueries({ queryKey: PROJECTS_KEY })
      void client.invalidateQueries({ queryKey: GALLERY_KEY })
      toast.success(t('gallery.remixed'))
      void awardBadge('first-remix')
      await navigate({ to: '/p/$projectId', params: { projectId: id }, search: { tab: 'design' } })
    } catch (error) {
      toast.error(errorMessage(t, error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={projectId !== null}
      onOpenChange={(value) => !value && onClose()}
      title={entry?.name ?? t('common.loading')}
      className="w-[min(96vw,980px)]"
    >
      {detail.isError ? (
        <p className="text-muted">{errorMessage(t, detail.error)}</p>
      ) : !entry || !data ? (
        <div className="h-[420px] animate-pulse rounded-ui-lg bg-surface-2" />
      ) : (
        <div
          className="grid max-h-[78vh] gap-6 overflow-y-auto md:grid-cols-[auto_1fr]"
          data-testid="gallery-entry"
        >
          <section aria-label={t('gallery.tryTitle')} className="flex flex-col items-center gap-2">
            <PhoneFrame width={PHONE.width} height={PHONE.height} scale={0.6} dark={isDark(theme)}>
              {entry.slug ? (
                <iframe
                  title={t('gallery.tryTitle')}
                  src={`${config.appsUrl.replace(/\/$/, '')}/a/${entry.slug}/`}
                  allow="camera; microphone; geolocation; accelerometer; gyroscope; clipboard-write; web-share; fullscreen; autoplay"
                  // As the preview: never `allow-top-navigation` (SPEC § 6.6).
                  sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads"
                  className="size-full"
                  data-testid="gallery-try"
                />
              ) : (
                <div className="size-full [--thumb-scale:1]">
                  <ProjectThumbnail preview={entry.preview} dark={isDark(theme)} />
                </div>
              )}
            </PhoneFrame>
            <p className="max-w-[240px] text-center text-ui-sm text-muted">
              {entry.slug ? t('gallery.tryHint') : t('gallery.notPublished')}
            </p>
          </section>
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <p className="flex items-center gap-2">
                <Avatar id={entry.owner.avatar} name={entry.owner.displayName} size={28} />
                <span className="font-strong">
                  {t('gallery.by', { name: entry.owner.displayName })}
                </span>
              </p>
              {entry.remixOf ? (
                <p className="flex items-center gap-1.5 text-ui-sm text-muted">
                  <Shuffle size={14} aria-hidden="true" />
                  {t('gallery.remixOf', { name: entry.remixOf.name, owner: entry.remixOf.owner })}
                </p>
              ) : null}
              {entry.description ? <p>{entry.description}</p> : null}
              <p className="text-ui-sm text-muted">
                {t('gallery.shared', {
                  date: new Date(entry.sharedAt).toLocaleDateString(i18n.language, {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  }),
                })}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                icon={<Shuffle size={16} />}
                onClick={doRemix}
                disabled={busy}
              >
                {t('gallery.remix')}
              </Button>
              <Button
                icon={<Blocks size={16} />}
                onClick={() =>
                  void navigate({
                    to: '/p/$projectId',
                    params: { projectId: entry.id },
                    search: { tab: 'blocks' },
                  })
                }
              >
                {t('gallery.seeBlocks')}
              </Button>
              <Button
                icon={
                  <Heart
                    size={16}
                    className={entry.liked ? 'text-coral' : ''}
                    fill={entry.liked ? 'currentColor' : 'none'}
                  />
                }
                aria-pressed={entry.liked}
                onClick={() => like.mutate({ id: entry.id, liked: !entry.liked })}
              >
                {entry.liked ? t('gallery.unlike') : t('gallery.like')} · {entry.likes}
              </Button>
              {user?.isAdmin ? (
                <Button
                  variant="danger"
                  icon={<Trash2 size={16} />}
                  onClick={() => setRemoving(true)}
                >
                  {t('gallery.remove')}
                </Button>
              ) : null}
            </div>
            <section
              aria-labelledby="remix-tree"
              className="rounded-ui-lg border border-border p-4"
            >
              <h3 id="remix-tree" className="mb-2 flex items-center gap-2 font-strong">
                <GitFork size={16} aria-hidden="true" />
                {t('gallery.tree')}
                <span className="font-normal text-muted">
                  · {t('gallery.remixes', { count: entry.remixes })}
                </span>
              </h3>
              {data.ancestors.length ? (
                <div className="mb-3 text-ui-sm">
                  <span className="text-muted">{t('gallery.treeOrigin')} </span>
                  {[...data.ancestors].reverse().map((ancestor, index) => (
                    <span key={ancestor.id}>
                      {index > 0 ? ' → ' : ''}
                      {ancestor.visible ? (
                        <button
                          type="button"
                          className="font-strong text-primary-text underline-offset-2 hover:underline"
                          onClick={() =>
                            void navigate({ to: '/gallery', search: { p: ancestor.id } })
                          }
                        >
                          {ancestor.name}
                        </button>
                      ) : (
                        <span className="font-strong">{ancestor.name}</span>
                      )}{' '}
                      <span className="text-muted">({ancestor.owner})</span>
                    </span>
                  ))}
                </div>
              ) : null}
              {data.remixes.length === 0 ? (
                <p className="text-ui-sm text-muted">{t('gallery.treeEmpty')}</p>
              ) : (
                <Tree nodes={data.remixes} root={entry.name} />
              )}
            </section>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={removing}
        title={t('gallery.removeTitle', { name: entry?.name ?? '' })}
        text={t('gallery.removeText')}
        action={t('gallery.remove')}
        onClose={() => setRemoving(false)}
        onConfirm={async () => {
          if (!entry) return
          await call(api.gallery[':projectId'].$delete({ param: { projectId: entry.id } }))
          toast.success(t('gallery.removed'))
          await client.invalidateQueries({ queryKey: GALLERY_KEY })
          onClose()
        }}
      />
    </Dialog>
  )
}

/** The remixes of a project; private ones are counted, not named. */
function Tree({ nodes, root }: { nodes: RemixNode[]; root: string }) {
  return (
    <div className="text-ui-sm">
      <p className="font-strong">{root}</p>
      <Branch nodes={nodes} />
    </div>
  )
}

function Branch({ nodes }: { nodes: RemixNode[] }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const shown = nodes.filter((node) => node.visible)
  const hidden = nodes.length - shown.length
  return (
    <ul className="ml-2 border-l-2 border-border pl-3">
      {shown.map((node) => (
        <li key={node.id} className="mt-1.5">
          <button
            type="button"
            className="font-strong text-primary-text underline-offset-2 hover:underline"
            onClick={() => void navigate({ to: '/gallery', search: { p: node.id } })}
          >
            {node.name}
          </button>{' '}
          <span className="text-muted">({node.owner})</span>
          {node.children.length ? <Branch nodes={node.children} /> : null}
        </li>
      ))}
      {hidden ? (
        <li className="mt-1.5 text-muted">{t('gallery.privateRemixes', { count: hidden })}</li>
      ) : null}
    </ul>
  )
}
