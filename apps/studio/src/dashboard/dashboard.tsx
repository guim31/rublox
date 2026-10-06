import { useNavigate } from '@tanstack/react-router'
import {
  Copy,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Star,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AppHeader } from '../components/app-header.tsx'
import { Avatar } from '../components/avatar.tsx'
import { Mascot } from '../components/brand.tsx'
import { Button, IconButton } from '../components/ui/button.tsx'
import { Dialog } from '../components/ui/dialog.tsx'
import { Input, Select } from '../components/ui/input.tsx'
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '../components/ui/menu.tsx'
import { Segmented } from '../components/ui/segmented.tsx'
import { cn } from '../lib/cn.ts'
import { useCommands } from '../lib/commands.ts'
import { errorMessage } from '../lib/errors.ts'
import { isDark, usePrefs } from '../lib/prefs.ts'
import { useMe } from '../lib/session.ts'
import { relativeTime } from '../lib/time.ts'
import { guestBackend, serverBackend } from '../storage/backend.ts'
import type { ProjectSummary } from '../storage/projects.ts'
import { GuestImport } from './guest-import.tsx'
import { useProjectMutation, useProjects } from './queries.ts'
import { ProjectThumbnail } from './thumbnail.tsx'

type Filter = 'all' | 'mine' | 'shared' | 'space' | 'favorites' | 'trash'
type Sort = 'recent' | 'name'

const mine = (p: ProjectSummary) => !p.access || p.access === 'owner'

function matches(project: ProjectSummary, filter: Filter): boolean {
  if (filter === 'trash') return project.deletedAt !== null
  if (project.deletedAt) return false
  if (filter === 'favorites') return project.favorite
  if (filter === 'mine') return mine(project)
  if (filter === 'shared') return project.access === 'editor' || project.access === 'viewer'
  if (filter === 'space') return project.access === 'manager'
  return true
}

/**
 * The dashboard (SPEC § 4.8): the projects of the account, or of this browser in guest mode.
 */
export function Dashboard({ openNew }: { openNew: boolean }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { mode, locale, theme } = usePrefs()
  const me = useMe()
  const signedIn = Boolean(me.data?.user)
  const backend = me.isPending ? null : signedIn ? serverBackend : guestBackend
  const store = backend ?? guestBackend
  const projects = useProjects(backend)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('recent')
  const [creating, setCreating] = useState(openNew)
  const [renaming, setRenaming] = useState<ProjectSummary | null>(null)
  const [deleting, setDeleting] = useState<ProjectSummary | null>(null)
  const dark = isDark(theme)

  useEffect(() => {
    if (openNew) setCreating(true)
  }, [openNew])

  useEffect(() => {
    useCommands.getState().setPage([])
  }, [])

  const create = useProjectMutation((name: string) => store.create({ name, locale, mode }))
  const rename = useProjectMutation(({ id, name }: { id: string; name: string }) =>
    store.rename(id, name),
  )
  const duplicate = useProjectMutation(({ id, name }: { id: string; name: string }) =>
    store.duplicate(id, name),
  )
  const favorite = useProjectMutation(({ id, value }: { id: string; value: boolean }) =>
    store.setFavorite(id, value),
  )
  const trash = useProjectMutation((id: string) => store.trash(id))
  const restore = useProjectMutation((id: string) => store.restore(id))
  const destroy = useProjectMutation((id: string) => store.deleteForever(id))

  const all = projects.data ?? []
  const live = all.filter((p) => !p.deletedAt)
  const hasShared = live.some((p) => matches(p, 'shared'))
  const hasSpace = live.some((p) => matches(p, 'space'))
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale)
    return all
      .filter((p) => matches(p, filter))
      .filter(
        (p) =>
          !needle ||
          p.name.toLocaleLowerCase(locale).includes(needle) ||
          (p.owner?.displayName.toLocaleLowerCase(locale).includes(needle) ?? false),
      )
      .sort((a, b) =>
        sort === 'name'
          ? a.name.localeCompare(b.name, locale)
          : b.updatedAt.localeCompare(a.updatedAt),
      )
  }, [all, query, filter, sort, locale])

  const defaultName = () => {
    const names = new Set(all.filter(mine).map((p) => p.name))
    for (let n = 1; ; n++) {
      const name = t('dashboard.defaultName', { n })
      if (!names.has(name)) return name
    }
  }

  const open = (id: string) =>
    navigate({ to: '/p/$projectId', params: { projectId: id }, search: { tab: 'design' } })

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-5 pt-8 pb-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-ui-xl font-strong tracking-tight">{t('dashboard.title')}</h1>
            {signedIn ? null : <p className="mt-1 text-muted">{t('guest.explain')}</p>}
          </div>
          <Button
            variant="primary"
            size="lg"
            icon={<Plus size={18} />}
            onClick={() => setCreating(true)}
          >
            {t('dashboard.newProject')}
          </Button>
        </div>

        {signedIn ? <GuestImport /> : null}

        {all.length > 0 || filter !== 'all' ? (
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
                placeholder={t('dashboard.searchPlaceholder')}
                aria-label={t('dashboard.searchPlaceholder')}
                className="pl-9"
              />
            </div>
            <Segmented
              label={t('common.search')}
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: t('dashboard.filters.all') },
                ...(hasShared || hasSpace
                  ? [{ value: 'mine' as const, label: t('library.filters.mine') }]
                  : []),
                ...(hasShared
                  ? [{ value: 'shared' as const, label: t('library.filters.shared') }]
                  : []),
                ...(hasSpace
                  ? [{ value: 'space' as const, label: t('library.filters.space') }]
                  : []),
                {
                  value: 'favorites',
                  label: t('dashboard.filters.favorites'),
                  icon: <Star size={14} />,
                },
                { value: 'trash', label: t('dashboard.filters.trash'), icon: <Trash2 size={14} /> },
              ]}
            />
            <div className="flex-1" />
            <Select
              aria-label={t('dashboard.sort.label')}
              value={sort}
              onChange={(event) => setSort(event.target.value as Sort)}
              className="w-auto"
            >
              <option value="recent">{t('dashboard.sort.recent')}</option>
              <option value="name">{t('dashboard.sort.name')}</option>
            </Select>
          </div>
        ) : null}

        {filter === 'trash' ? (
          <p className="mt-4 text-ui-sm text-muted">{t('dashboard.trashNotice')}</p>
        ) : null}

        {projects.isPending || !backend ? (
          <Grid>
            {[0, 1, 2].map((key) => (
              <li key={key} className="h-[272px] animate-pulse rounded-ui-lg bg-surface-2" />
            ))}
          </Grid>
        ) : live.length === 0 && filter === 'all' ? (
          <EmptyState onCreate={() => setCreating(true)} />
        ) : visible.length === 0 ? (
          <p className="mt-16 text-center text-muted">
            {filter === 'trash' ? t('dashboard.trashEmpty') : t('dashboard.noMatch', { query })}
          </p>
        ) : (
          <Grid>
            {visible.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                dark={dark}
                when={relativeTime(project.deletedAt ?? project.updatedAt, t, i18n.language)}
                onOpen={() => open(project.id)}
                onFavorite={() => favorite.mutate({ id: project.id, value: !project.favorite })}
                onRename={() => setRenaming(project)}
                onDuplicate={async () => {
                  const name = t('dashboard.copyName', { name: project.name })
                  try {
                    await duplicate.mutateAsync({ id: project.id, name })
                    toast.success(t('dashboard.toastDuplicated', { name }))
                  } catch (error) {
                    toast.error(errorMessage(t, error))
                  }
                }}
                onTrash={async () => {
                  await trash.mutateAsync(project.id)
                  toast(t('dashboard.toastTrashed', { name: project.name }), {
                    action: {
                      label: t('common.restore'),
                      onClick: () => restore.mutate(project.id),
                    },
                  })
                }}
                onRestore={async () => {
                  await restore.mutateAsync(project.id)
                  toast.success(t('dashboard.toastRestored', { name: project.name }))
                }}
                onDelete={() => setDeleting(project)}
              />
            ))}
          </Grid>
        )}
      </main>

      <NameDialog
        open={creating}
        title={t('dashboard.createTitle')}
        initial={creating ? defaultName() : ''}
        action={t('common.create')}
        onClose={() => {
          setCreating(false)
          if (openNew) void navigate({ to: '/', search: {} })
        }}
        onSubmit={async (name) => {
          try {
            const id = await create.mutateAsync(name)
            setCreating(false)
            await open(id as string)
          } catch (error) {
            toast.error(errorMessage(t, error))
          }
        }}
      />
      <NameDialog
        open={renaming !== null}
        title={t('dashboard.renameTitle')}
        initial={renaming?.name ?? ''}
        action={t('common.rename')}
        onClose={() => setRenaming(null)}
        onSubmit={async (name) => {
          if (renaming) await rename.mutateAsync({ id: renaming.id, name })
          setRenaming(null)
        }}
      />
      <Dialog
        open={deleting !== null}
        onOpenChange={(value) => !value && setDeleting(null)}
        title={t('dashboard.confirmDeleteTitle', { name: deleting?.name ?? '' })}
        description={signedIn ? t('library.confirmDeleteText') : t('dashboard.confirmDeleteText')}
      >
        <div className="flex justify-end gap-2">
          <Button onClick={() => setDeleting(null)}>{t('common.cancel')}</Button>
          <Button
            variant="danger"
            onClick={async () => {
              if (deleting) await destroy.mutateAsync(deleting.id)
              setDeleting(null)
            }}
          >
            {t('dashboard.deleteForever')}
          </Button>
        </div>
      </Dialog>
    </div>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <ul className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5 junior:grid-cols-[repeat(auto-fill,minmax(250px,1fr))]">
      {children}
    </ul>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  const { t } = useTranslation()
  return (
    <section className="mx-auto mt-14 flex max-w-lg flex-col items-center rounded-ui-lg border border-dashed border-border-strong bg-surface px-8 py-12 text-center rx-anim-in">
      <Mascot size={132} mood="wave" className="text-text" />
      <h2 className="mt-4 text-ui-xl font-strong">{t('dashboard.emptyTitle')}</h2>
      <p className="mt-2 text-muted">{t('dashboard.emptyText')}</p>
      <Button
        variant="primary"
        size="lg"
        className="mt-6"
        icon={<Plus size={18} />}
        onClick={onCreate}
      >
        {t('dashboard.emptyAction')}
      </Button>
    </section>
  )
}

type CardProps = {
  project: ProjectSummary
  dark: boolean
  when: string
  onOpen: () => void
  onFavorite: () => void
  onRename: () => void
  onDuplicate: () => void
  onTrash: () => void
  onRestore: () => void
  onDelete: () => void
}

function ProjectCard(props: CardProps) {
  const { t } = useTranslation()
  const { project } = props
  const trashed = project.deletedAt !== null
  const owned = mine(project)
  const writable = owned || project.access === 'editor'
  return (
    <li className="group relative flex flex-col overflow-hidden rounded-ui-lg border border-border bg-surface shadow-1 transition-[box-shadow,transform,border] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-2">
      <div
        className="relative h-[180px] bg-canvas [--thumb-scale:0.62]"
        style={{ opacity: trashed ? 0.6 : 1 }}
      >
        <div className="absolute inset-x-6 top-4 bottom-0 overflow-hidden rounded-t-[18px] border-[5px] border-b-0 border-text/85 bg-surface shadow-2">
          <ProjectThumbnail preview={project.preview} dark={props.dark} />
        </div>
      </div>
      <div className="flex items-center gap-2 p-3 junior:p-4">
        <div className="min-w-0 flex-1">
          {trashed ? (
            <h3 className="truncate font-strong">{project.name}</h3>
          ) : (
            <h3 className="truncate font-strong">
              <button
                type="button"
                onClick={props.onOpen}
                aria-label={t('dashboard.open', { name: project.name })}
                className="truncate text-left outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:rounded-ui-lg focus-visible:after:ring-2 focus-visible:after:ring-primary"
              >
                {project.name}
              </button>
            </h3>
          )}
          {!owned && project.owner ? (
            <p className="flex min-w-0 items-center gap-1.5 text-ui-sm text-muted">
              <Avatar id={project.owner.avatar} name={project.owner.displayName} size={18} />
              <span className="truncate">
                {t('library.by', { name: project.owner.displayName })}
                {writable ? '' : ` · ${t('library.readOnly')}`}
              </span>
            </p>
          ) : null}
          <p className="truncate text-ui-sm text-muted">
            {trashed
              ? t('dashboard.deletedOn', { when: props.when })
              : t('dashboard.edited', { when: props.when })}
          </p>
        </div>
        {!trashed ? (
          <IconButton
            label={project.favorite ? t('dashboard.unfavorite') : t('dashboard.favorite')}
            onClick={props.onFavorite}
            className={cn('relative z-[1]', project.favorite ? 'text-yellow' : 'text-muted')}
            active={project.favorite}
          >
            <Star size={18} fill={project.favorite ? 'currentColor' : 'none'} />
          </IconButton>
        ) : null}
        <Menu>
          <MenuTrigger asChild>
            <IconButton
              label={t('dashboard.actions', { name: project.name })}
              className="relative z-[1] text-muted"
            >
              <MoreHorizontal size={18} />
            </IconButton>
          </MenuTrigger>
          <MenuContent>
            {trashed ? (
              <>
                <MenuItem icon={<RotateCcw size={15} />} onSelect={props.onRestore}>
                  {t('common.restore')}
                </MenuItem>
                <MenuItem icon={<Trash2 size={15} />} danger onSelect={props.onDelete}>
                  {t('dashboard.deleteForever')}
                </MenuItem>
              </>
            ) : (
              <>
                <MenuItem icon={<FolderOpen size={15} />} onSelect={props.onOpen}>
                  {t('dashboard.open', { name: '' }).trim()}
                </MenuItem>
                {writable ? (
                  <MenuItem icon={<Pencil size={15} />} onSelect={props.onRename}>
                    {t('common.rename')}
                  </MenuItem>
                ) : null}
                <MenuItem icon={<Copy size={15} />} onSelect={props.onDuplicate}>
                  {t('common.duplicate')}
                </MenuItem>
                {owned ? (
                  <>
                    <MenuSeparator />
                    <MenuItem icon={<Trash2 size={15} />} danger onSelect={props.onTrash}>
                      {t('common.delete')}
                    </MenuItem>
                  </>
                ) : null}
              </>
            )}
          </MenuContent>
        </Menu>
      </div>
    </li>
  )
}

function NameDialog(props: {
  open: boolean
  title: string
  initial: string
  action: string
  onClose: () => void
  onSubmit: (name: string) => Promise<void>
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(props.initial)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (props.open) setName(props.initial)
  }, [props.open, props.initial])
  return (
    <Dialog
      open={props.open}
      onOpenChange={(value) => !value && props.onClose()}
      title={props.title}
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          if (!name.trim() || busy) return
          setBusy(true)
          try {
            await props.onSubmit(name.trim())
          } finally {
            setBusy(false)
          }
        }}
        className="flex flex-col gap-4"
      >
        <label htmlFor="project-name" className="flex flex-col gap-1.5">
          <span className="text-ui-sm font-strong">{t('dashboard.createName')}</span>
          <Input
            id="project-name"
            autoFocus
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            onFocus={(event) => event.target.select()}
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button onClick={props.onClose}>{t('common.cancel')}</Button>
          <Button type="submit" variant="primary" disabled={!name.trim() || busy}>
            {props.action}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
