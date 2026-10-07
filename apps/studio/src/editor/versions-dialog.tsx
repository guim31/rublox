import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bookmark, History, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '../components/ui/button.tsx'
import { Dialog } from '../components/ui/dialog.tsx'
import { Field } from '../components/ui/field.tsx'
import { Input } from '../components/ui/input.tsx'
import { ProjectThumbnail } from '../dashboard/thumbnail.tsx'
import { api, call } from '../lib/api.ts'
import { cn } from '../lib/cn.ts'
import { errorMessage } from '../lib/errors.ts'
import { isDark, usePrefs } from '../lib/prefs.ts'
import type { ProjectSummary } from '../storage/projects.ts'
import { useSession } from './context.tsx'
import type { ServerSource } from './sources.ts'

const project = api.projects[':projectId']

/** Version history of a server project: list, name, preview, restore (SPEC § 4.8). */
export function VersionsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const session = useSession()
  const client = useQueryClient()
  const theme = usePrefs((s) => s.theme)
  const projectId = session.id
  const key = ['versions', projectId]
  const versions = useQuery({
    queryKey: key,
    queryFn: () => call(project.versions.$get({ param: { projectId } })),
    enabled: open,
  })
  const [selected, setSelected] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [restoring, setRestoring] = useState<{ id: string; date: string } | null>(null)
  const preview = useQuery({
    queryKey: ['version', projectId, selected],
    queryFn: () =>
      call(
        project.versions[':versionId'].$get({ param: { projectId, versionId: selected ?? '' } }),
      ),
    enabled: open && selected !== null,
  })
  const date = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    const value = name.trim()
    if (!value) return
    try {
      // Send pending edits first, so that the version holds what is on screen.
      await (session.source as ServerSource).flushed()
      await call(project.versions.$post({ param: { projectId }, json: { name: value } }))
      toast.success(t('versions.saved', { name: value }))
      setName('')
      await client.invalidateQueries({ queryKey: key })
    } catch (caught) {
      toast.error(errorMessage(t, caught))
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(value) => !value && onClose()}
        title={t('versions.title')}
        description={t('versions.hint')}
        className="w-[min(94vw,760px)]"
      >
        {!session.readOnly ? (
          <form onSubmit={save} className="flex items-end gap-2">
            <Field id="version-name" label={t('versions.name')} className="flex-1">
              <Input
                id="version-name"
                value={name}
                maxLength={80}
                placeholder={t('versions.namePlaceholder')}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Button type="submit" icon={<Bookmark size={16} />} disabled={!name.trim()}>
              {t('versions.save')}
            </Button>
          </form>
        ) : null}
        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_200px]">
          <ul className="flex max-h-[50vh] flex-col gap-1 overflow-y-auto pr-1">
            {(versions.data?.versions ?? []).map((version) => (
              <li key={version.id}>
                <div
                  className={cn(
                    'flex items-center gap-2 rounded-ui border border-transparent px-2 py-1.5',
                    selected === version.id && 'border-primary bg-primary-soft',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelected(version.id)}
                    aria-pressed={selected === version.id}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    {version.name ? (
                      <Bookmark
                        size={16}
                        className="shrink-0 text-primary-text"
                        aria-hidden="true"
                      />
                    ) : (
                      <History size={16} className="shrink-0 text-muted" aria-hidden="true" />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate font-strong">
                        {version.name ?? t('versions.auto')}
                      </span>
                      <span className="block truncate text-ui-sm text-muted">
                        {date(version.createdAt)}
                        {version.author ? ` · ${t('versions.by', { name: version.author })}` : ''}
                      </span>
                    </span>
                  </button>
                  {!session.readOnly ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<RotateCcw size={14} />}
                      onClick={() =>
                        setRestoring({ id: version.id, date: date(version.createdAt) })
                      }
                    >
                      {t('versions.restore')}
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
            {versions.data && versions.data.versions.length === 0 ? (
              <li className="py-6 text-center text-muted">{t('versions.empty')}</li>
            ) : null}
          </ul>
          <div
            aria-label={t('versions.preview')}
            role="img"
            className="relative hidden h-[300px] overflow-hidden rounded-ui-lg border border-border bg-canvas [--thumb-scale:0.5] sm:block"
          >
            {selected && preview.data ? (
              <div className="absolute inset-x-3 top-3 bottom-0 overflow-hidden rounded-t-[14px] border-4 border-b-0 border-text/85 bg-surface">
                <ProjectThumbnail
                  preview={preview.data.preview as ProjectSummary['preview']}
                  dark={isDark(theme)}
                />
              </div>
            ) : null}
          </div>
        </div>
      </Dialog>
      <Dialog
        open={restoring !== null}
        onOpenChange={(value) => !value && setRestoring(null)}
        title={t('versions.restoreTitle', { date: restoring?.date ?? '' })}
        description={t('versions.restoreText')}
      >
        <div className="flex justify-end gap-2">
          <Button onClick={() => setRestoring(null)}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            onClick={async () => {
              if (!restoring) return
              try {
                await (session.source as ServerSource).flushed()
                await call(
                  project.versions[':versionId'].restore.$post({
                    param: { projectId, versionId: restoring.id },
                  }),
                )
                toast.success(t('versions.restored'))
                setRestoring(null)
                await client.invalidateQueries({ queryKey: key })
              } catch (caught) {
                toast.error(errorMessage(t, caught))
              }
            }}
          >
            {t('versions.restore')}
          </Button>
        </div>
      </Dialog>
    </>
  )
}
