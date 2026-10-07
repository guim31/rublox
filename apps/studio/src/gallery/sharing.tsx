import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { LayoutGrid } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Switch } from '../components/ui/switch.tsx'
import { api, call } from '../lib/api.ts'
import { errorMessage } from '../lib/errors.ts'
import { useFeatures } from '../lib/features.ts'
import { GALLERY_KEY } from './queries.ts'

const sharing = api.gallery[':projectId'].sharing

/** "Share in the gallery" (SPEC § 4.11), for the owner, in the editor's share dialog. */
export function GallerySharing({ projectId }: { projectId: string }) {
  const { t } = useTranslation()
  const features = useFeatures()
  const client = useQueryClient()
  const key = [...GALLERY_KEY, 'sharing', projectId]
  const state = useQuery({
    queryKey: key,
    queryFn: () => call(sharing.$get({ param: { projectId } })),
    enabled: features.gallery,
    staleTime: 0,
  })
  if (!features.gallery || !state.data?.enabled) return null
  const { shared, allowed, removed } = state.data
  const blocked = removed || (!allowed && !shared)
  return (
    <section
      className="mt-5 rounded-ui-lg border border-border bg-surface-2/50 p-4"
      data-testid="gallery-sharing"
    >
      <h3 className="flex items-center gap-2 font-strong">
        <LayoutGrid size={16} aria-hidden="true" />
        {t('gallery.share.title')}
      </h3>
      <p className="mt-1 text-ui-sm text-muted">{t('gallery.share.text')}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <label htmlFor="gallery-share">{t('gallery.share.toggle')}</label>
        <Switch
          id="gallery-share"
          checked={shared}
          disabled={blocked}
          onChange={async (value) => {
            try {
              await call(sharing.$put({ param: { projectId }, json: { shared: value } }))
              toast.success(value ? t('gallery.share.on') : t('gallery.share.off'))
            } catch (error) {
              toast.error(errorMessage(t, error))
            }
            await client.invalidateQueries({ queryKey: GALLERY_KEY })
          }}
        />
      </div>
      {removed ? (
        <p className="mt-2 text-ui-sm text-danger">{t('gallery.share.removed')}</p>
      ) : !allowed ? (
        <p className="mt-2 text-ui-sm text-muted">{t('gallery.share.forbidden')}</p>
      ) : null}
      {shared ? (
        <Link
          to="/gallery"
          search={{ p: projectId }}
          className="mt-2 inline-block text-ui-sm font-strong text-primary-text underline-offset-2 hover:underline"
        >
          {t('gallery.share.view')}
        </Link>
      ) : null}
    </section>
  )
}
