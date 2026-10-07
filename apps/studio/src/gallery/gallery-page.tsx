import { useQuery } from '@tanstack/react-query'
import { Navigate, useNavigate } from '@tanstack/react-router'
import { GitFork, Heart, Search, Shuffle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Page } from '../components/app-header.tsx'
import { Avatar } from '../components/avatar.tsx'
import { Mascot } from '../components/brand.tsx'
import { Input } from '../components/ui/input.tsx'
import { Segmented } from '../components/ui/segmented.tsx'
import { ProjectThumbnail } from '../dashboard/thumbnail.tsx'
import { useFeatures } from '../lib/features.ts'
import { isDark, usePrefs } from '../lib/prefs.ts'
import { useMe } from '../lib/session.ts'
import { EntryDialog } from './entry-dialog.tsx'
import { type GalleryEntry, galleryKey, listGallery, useLike } from './queries.ts'

type Sort = 'recent' | 'popular'
type ModeFilter = 'all' | 'junior' | 'studio'

/**
 * The gallery of the instance (SPEC § 4.11): the projects people shared, to try, to look at
 * and to remix. `?p=<id>` opens one of them.
 */
export function GalleryPage({ open }: { open?: string }) {
  const { t } = useTranslation()
  const me = useMe()
  const features = useFeatures()
  const navigate = useNavigate()
  const { theme } = usePrefs()
  const [sort, setSort] = useState<Sort>('recent')
  const [mode, setMode] = useState<ModeFilter>('all')
  const [query, setQuery] = useState('')
  const signedIn = Boolean(me.data?.user)
  const list = useQuery({
    queryKey: galleryKey(sort, mode),
    queryFn: () => listGallery(sort, mode),
    enabled: signedIn && features.gallery,
    staleTime: 0,
  })
  const like = useLike()
  const needle = query.trim().toLocaleLowerCase()
  const entries = useMemo(
    () =>
      (list.data?.entries ?? []).filter(
        (entry) =>
          !needle ||
          entry.name.toLocaleLowerCase().includes(needle) ||
          entry.owner.displayName.toLocaleLowerCase().includes(needle) ||
          (entry.description ?? '').toLocaleLowerCase().includes(needle),
      ),
    [list.data, needle],
  )
  if (me.isPending) return null
  if (!signedIn) return <Navigate to="/login" />
  const setOpen = (id: string | undefined) =>
    void navigate({ to: '/gallery', search: id ? { p: id } : {} })

  return (
    <Page title={t('gallery.title')} subtitle={t('gallery.subtitle')}>
      {!features.gallery ? (
        <p className="mt-10 text-center text-muted">{t('gallery.disabled')}</p>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-xs">
              <Search
                size={16}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
              />
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('gallery.search')}
                aria-label={t('gallery.search')}
                className="pl-9"
              />
            </div>
            <Segmented
              label={t('gallery.sortLabel')}
              value={sort}
              onChange={setSort}
              options={[
                { value: 'recent', label: t('gallery.sort.recent') },
                { value: 'popular', label: t('gallery.sort.popular') },
              ]}
            />
            <Segmented
              label={t('gallery.modeLabel')}
              value={mode}
              onChange={setMode}
              options={(['all', 'junior', 'studio'] as const).map((value) => ({
                value,
                label: t(`gallery.modes.${value}`),
              }))}
            />
          </div>
          {list.isPending ? (
            <ul className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5">
              {[0, 1, 2, 3].map((key) => (
                <li key={key} className="h-[300px] animate-pulse rounded-ui-lg bg-surface-2" />
              ))}
            </ul>
          ) : entries.length === 0 ? (
            needle ? (
              <p className="mt-16 text-center text-muted">{t('gallery.noMatch', { query })}</p>
            ) : (
              <section className="mx-auto mt-14 flex max-w-lg flex-col items-center rounded-ui-lg border border-dashed border-border-strong bg-surface px-8 py-12 text-center">
                <Mascot size={120} mood="wave" className="text-text" />
                <h2 className="mt-4 text-ui-xl font-strong">{t('gallery.empty')}</h2>
                <p className="mt-2 text-muted">{t('gallery.emptyText')}</p>
              </section>
            )
          ) : (
            <ul
              className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5 junior:grid-cols-[repeat(auto-fill,minmax(250px,1fr))]"
              data-testid="gallery-grid"
            >
              {entries.map((entry) => (
                <GalleryCard
                  key={entry.id}
                  entry={entry}
                  dark={isDark(theme)}
                  onOpen={() => setOpen(entry.id)}
                  onLike={() => like.mutate({ id: entry.id, liked: !entry.liked })}
                />
              ))}
            </ul>
          )}
        </>
      )}
      <EntryDialog projectId={open ?? null} onClose={() => setOpen(undefined)} />
    </Page>
  )
}

function GalleryCard(props: {
  entry: GalleryEntry
  dark: boolean
  onOpen: () => void
  onLike: () => void
}) {
  const { t } = useTranslation()
  const { entry } = props
  return (
    <li className="group relative flex flex-col overflow-hidden rounded-ui-lg border border-border bg-surface shadow-1 transition-[box-shadow,transform,border] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-2">
      <div className="relative h-[180px] bg-canvas [--thumb-scale:0.62]">
        <div className="absolute inset-x-6 top-4 bottom-0 overflow-hidden rounded-t-[18px] border-[5px] border-b-0 border-text/85 bg-surface shadow-2">
          <ProjectThumbnail preview={entry.preview} dark={props.dark} />
        </div>
        <span className="absolute top-2 left-2 rounded-full bg-surface/90 px-2 py-0.5 text-ui-sm font-strong text-muted shadow-1">
          {t(`gallery.modes.${entry.mode}`)}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3 junior:p-4">
        <h3 className="truncate font-strong">
          <button
            type="button"
            onClick={props.onOpen}
            aria-label={t('gallery.open', { name: entry.name })}
            className="truncate text-left outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:rounded-ui-lg focus-visible:after:ring-2 focus-visible:after:ring-primary"
          >
            {entry.name}
          </button>
        </h3>
        <p className="flex min-w-0 items-center gap-1.5 text-ui-sm text-muted">
          <Avatar id={entry.owner.avatar} name={entry.owner.displayName} size={18} />
          <span className="truncate">
            {entry.mine ? t('gallery.mine') : t('gallery.by', { name: entry.owner.displayName })}
          </span>
        </p>
        {entry.remixOf ? (
          <p className="flex min-w-0 items-center gap-1 text-ui-sm text-muted">
            <Shuffle size={13} className="shrink-0" aria-hidden="true" />
            <span className="truncate">
              {t('gallery.remixOf', { name: entry.remixOf.name, owner: entry.remixOf.owner })}
            </span>
          </p>
        ) : null}
        <div className="mt-auto flex items-center gap-3 pt-1 text-ui-sm text-muted">
          <button
            type="button"
            onClick={props.onLike}
            aria-pressed={entry.liked}
            aria-label={entry.liked ? t('gallery.unlike') : t('gallery.like')}
            className="relative z-[1] inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 hover:bg-coral-soft"
          >
            <Heart
              size={16}
              className={entry.liked ? 'text-coral' : ''}
              fill={entry.liked ? 'currentColor' : 'none'}
            />
            <span className="tabular-nums">{entry.likes}</span>
          </button>
          <span
            className="inline-flex items-center gap-1"
            title={t('gallery.remixes', { count: entry.remixes })}
          >
            <GitFork size={15} aria-hidden="true" />
            <span className="tabular-nums">{entry.remixes}</span>
            <span className="sr-only">{t('gallery.remixes', { count: entry.remixes })}</span>
          </span>
        </div>
      </div>
    </li>
  )
}
