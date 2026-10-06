import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Navigate } from '@tanstack/react-router'
import {
  Ban,
  CircleCheck,
  KeyRound,
  MoreHorizontal,
  Search,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Page } from '../components/app-header.tsx'
import { Avatar } from '../components/avatar.tsx'
import { ConfirmDialog, NewAccountDialog, PasswordDialog } from '../components/dialogs.tsx'
import { InviteList, NewInviteButton } from '../components/invites.tsx'
import { Button, IconButton } from '../components/ui/button.tsx'
import { Badge, Field, Section } from '../components/ui/field.tsx'
import { Input, Select } from '../components/ui/input.tsx'
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '../components/ui/menu.tsx'
import { Segmented } from '../components/ui/segmented.tsx'
import { Switch } from '../components/ui/switch.tsx'
import { api, call } from '../lib/api.ts'
import { errorMessage } from '../lib/errors.ts'
import { useMe } from '../lib/session.ts'
import { relativeTime } from '../lib/time.ts'

type Tab = 'users' | 'invites' | 'spaces' | 'settings'

export const Route = createFileRoute('/admin')({
  validateSearch: (search: Record<string, unknown>): { section?: Tab } =>
    search.section === 'invites' || search.section === 'spaces' || search.section === 'settings'
      ? { section: search.section }
      : {},
  component: Admin,
})

const admin = api.admin
const USERS_KEY = ['admin', 'users'] as const

/** Administration of the instance (SPEC § 4.13). */
function Admin() {
  const { t } = useTranslation()
  const me = useMe()
  const navigate = Route.useNavigate()
  const tab = Route.useSearch().section ?? 'users'
  if (me.isPending) return null
  const user = me.data?.user
  if (!user) return <Navigate to="/login" search={{ redirect: '/admin' }} />
  if (!user.isAdmin) return <Navigate to="/" />
  return (
    <Page title={t('admin.title')}>
      <Segmented
        className="mt-6"
        label={t('admin.title')}
        value={tab}
        onChange={(value) => void navigate({ search: value === 'users' ? {} : { section: value } })}
        options={(['users', 'invites', 'spaces', 'settings'] as const).map((value) => ({
          value,
          label: t(`admin.tabs.${value}`),
        }))}
      />
      <div className="mt-6">
        {tab === 'users' ? <UsersTab meId={user.id} /> : null}
        {tab === 'invites' ? <InvitesTab /> : null}
        {tab === 'spaces' ? <SpacesTab /> : null}
        {tab === 'settings' ? <SettingsTab /> : null}
      </div>
    </Page>
  )
}

function formatBytes(bytes: number, locale: string): string {
  const units = ['o', 'Ko', 'Mo', 'Go', 'To']
  const unitsEn = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  const label = (locale.startsWith('fr') ? units : unitsEn)[unit]
  return `${value.toLocaleString(locale, { maximumFractionDigits: unit ? 1 : 0 })} ${label}`
}

type AdminUser = {
  id: string
  username: string
  displayName: string
  role: 'admin' | 'user'
  disabled: boolean
}

function UsersTab({ meId }: { meId: string }) {
  const { t, i18n } = useTranslation()
  const client = useQueryClient()
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user')
  const [resetting, setResetting] = useState<AdminUser | null>(null)
  const [deleting, setDeleting] = useState<AdminUser | null>(null)
  const [now] = useState(Date.now)
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 250)
    return () => clearTimeout(timer)
  }, [query])
  const users = useQuery({
    queryKey: [...USERS_KEY, search],
    queryFn: () => call(admin.users.$get({ query: search ? { q: search } : {} })),
  })
  const refresh = () => client.invalidateQueries({ queryKey: USERS_KEY })
  const update = async (user: AdminUser, json: { role?: 'user' | 'admin'; disabled?: boolean }) => {
    try {
      await call(admin.users[':userId'].$patch({ param: { userId: user.id }, json }))
      toast.success(t('admin.updated'))
      await refresh()
    } catch (caught) {
      toast.error(errorMessage(t, caught))
    }
  }
  const list = users.data?.users ?? []
  return (
    <Section
      title={t('admin.tabs.users')}
      actions={
        <div className="flex flex-wrap gap-2">
          <div className="relative w-56">
            <Search
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('admin.search')}
              aria-label={t('admin.search')}
              className="pl-9"
            />
          </div>
          <Button
            variant="primary"
            icon={<UserPlus size={16} />}
            onClick={() => {
              setNewRole('user')
              setCreating(true)
            }}
          >
            {t('admin.createUser')}
          </Button>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-ui-sm">
          <thead className="text-muted">
            <tr className="border-b border-border">
              <th className="py-2 pr-3 font-strong">{t('admin.columns.account')}</th>
              <th className="py-2 pr-3 font-strong">{t('admin.columns.spaces')}</th>
              <th className="py-2 pr-3 font-strong">{t('admin.columns.storage')}</th>
              <th className="py-2 pr-3 font-strong">{t('admin.columns.lastSeen')}</th>
              <th className="py-2 pr-3 font-strong">{t('admin.columns.created')}</th>
              <th className="py-2">
                <span className="sr-only">{t('admin.actions', { name: '' })}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.map((user) => (
              <tr key={user.id} data-testid={`admin-user-${user.username}`}>
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar id={user.avatar} name={user.displayName} size={32} />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-1.5 text-ui font-strong">
                        {user.displayName}
                        {user.role === 'admin' ? (
                          <Badge tone="primary">{t('admin.admin')}</Badge>
                        ) : null}
                        {user.disabled ? <Badge tone="danger">{t('admin.disabled')}</Badge> : null}
                        {user.managed ? <Badge>{t('admin.managed')}</Badge> : null}
                      </p>
                      <p className="text-muted">
                        {user.username}
                        {user.email ? ` · ${user.email}` : ''}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="py-2.5 pr-3">
                  {user.spaces.map((space) => space.name).join(', ') || '—'}
                </td>
                <td className="py-2.5 pr-3 tabular-nums">
                  {formatBytes(user.storageBytes, i18n.language)}
                </td>
                <td className="py-2.5 pr-3">
                  {user.lastSeenAt
                    ? relativeTime(user.lastSeenAt, t, i18n.language, now)
                    : t('admin.never')}
                </td>
                <td className="py-2.5 pr-3">
                  {relativeTime(user.createdAt, t, i18n.language, now)}
                </td>
                <td className="py-2.5 text-right">
                  {user.id === meId ? null : (
                    <Menu>
                      <MenuTrigger asChild>
                        <IconButton label={t('admin.actions', { name: user.displayName })}>
                          <MoreHorizontal size={18} />
                        </IconButton>
                      </MenuTrigger>
                      <MenuContent>
                        <MenuItem icon={<KeyRound size={15} />} onSelect={() => setResetting(user)}>
                          {t('admin.resetPassword')}
                        </MenuItem>
                        <MenuItem
                          icon={
                            user.role === 'admin' ? (
                              <ShieldOff size={15} />
                            ) : (
                              <ShieldCheck size={15} />
                            )
                          }
                          onSelect={() =>
                            update(user, { role: user.role === 'admin' ? 'user' : 'admin' })
                          }
                        >
                          {user.role === 'admin' ? t('admin.makeUser') : t('admin.makeAdmin')}
                        </MenuItem>
                        <MenuItem
                          icon={user.disabled ? <CircleCheck size={15} /> : <Ban size={15} />}
                          onSelect={() => update(user, { disabled: !user.disabled })}
                        >
                          {user.disabled ? t('admin.enable') : t('admin.disable')}
                        </MenuItem>
                        <MenuSeparator />
                        <MenuItem
                          icon={<Trash2 size={15} />}
                          danger
                          onSelect={() => setDeleting(user)}
                        >
                          {t('admin.delete')}
                        </MenuItem>
                      </MenuContent>
                    </Menu>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.data && list.length === 0 ? (
          <p className="py-6 text-center text-muted">{t('admin.noUser')}</p>
        ) : null}
      </div>
      <NewAccountDialog
        open={creating}
        title={t('admin.createUserTitle')}
        onClose={() => setCreating(false)}
        onSubmit={async (account) => {
          await call(admin.users.$post({ json: { ...account, role: newRole } }))
          await refresh()
        }}
      >
        <Field id="new-account-role" label={t('invites.role')}>
          <Select
            id="new-account-role"
            value={newRole}
            onChange={(event) => setNewRole(event.target.value as 'user' | 'admin')}
          >
            <option value="user">{t('invites.roles.user')}</option>
            <option value="admin">{t('invites.roles.admin')}</option>
          </Select>
        </Field>
      </NewAccountDialog>
      <PasswordDialog
        open={resetting !== null}
        title={t('spaces.resetTitle', { name: resetting?.displayName ?? '' })}
        onClose={() => setResetting(null)}
        onSubmit={async (password) => {
          if (!resetting) return
          await call(
            admin.users[':userId'].password.$post({
              param: { userId: resetting.id },
              json: { password },
            }),
          )
          toast.success(t('spaces.resetDone', { name: resetting.displayName }))
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        title={t('admin.deleteTitle', { name: deleting?.displayName ?? '' })}
        text={t('admin.deleteText')}
        action={t('admin.delete')}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return
          await call(admin.users[':userId'].$delete({ param: { userId: deleting.id } }))
          await refresh()
        }}
      />
    </Section>
  )
}

function InvitesTab() {
  const { t } = useTranslation()
  const spaces = useQuery({
    queryKey: ['admin', 'spaces'],
    queryFn: () => call(admin.spaces.$get()),
  })
  return (
    <Section
      title={t('invites.list')}
      actions={
        <NewInviteButton
          spaces={(spaces.data?.spaces ?? []).map((space) => ({ id: space.id, name: space.name }))}
          allowAdmin
        />
      }
    >
      <InviteList />
    </Section>
  )
}

function SpacesTab() {
  const { t, i18n } = useTranslation()
  const spaces = useQuery({
    queryKey: ['admin', 'spaces'],
    queryFn: () => call(admin.spaces.$get()),
  })
  const list = spaces.data?.spaces ?? []
  return (
    <Section title={t('admin.tabs.spaces')}>
      {spaces.data && list.length === 0 ? (
        <p className="text-muted">{t('admin.spacesEmpty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-ui-sm">
            <thead className="text-muted">
              <tr className="border-b border-border">
                <th className="py-2 pr-3 font-strong">{t('spaces.name')}</th>
                <th className="py-2 pr-3 font-strong">{t('spaces.kind')}</th>
                <th className="py-2 pr-3 font-strong">{t('admin.managers')}</th>
                <th className="py-2 pr-3 font-strong">{t('spaces.tabs.members')}</th>
                <th className="py-2 font-strong">{t('admin.columns.created')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.map((space) => (
                <tr key={space.id}>
                  <td className="py-2.5 pr-3 text-ui font-strong">{space.name}</td>
                  <td className="py-2.5 pr-3">{t(`spaces.kinds.${space.kind}`)}</td>
                  <td className="py-2.5 pr-3">{space.managers.join(', ')}</td>
                  <td className="py-2.5 pr-3 tabular-nums">{space.memberCount}</td>
                  <td className="py-2.5">{relativeTime(space.createdAt, t, i18n.language)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}

function SettingsTab() {
  const { t, i18n } = useTranslation()
  const client = useQueryClient()
  const settings = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => call(admin.settings.$get()),
  })
  const stats = useQuery({ queryKey: ['admin', 'stats'], queryFn: () => call(admin.stats.$get()) })
  type Settings = NonNullable<typeof settings.data>['settings']
  const [form, setForm] = useState<Settings | null>(null)
  useEffect(() => {
    if (settings.data) setForm(settings.data.settings)
  }, [settings.data])
  if (!form) return null
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setForm({ ...form, [key]: value })
  return (
    <div className="flex flex-col gap-5">
      <Section title={t('admin.settings')}>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault()
            try {
              await call(admin.settings.$patch({ json: form }))
              await client.invalidateQueries({ queryKey: ['admin'] })
              await client.invalidateQueries({ queryKey: ['me'] })
              toast.success(t('spaces.settingsSaved'))
            } catch (caught) {
              toast.error(errorMessage(t, caught))
            }
          }}
        >
          <Field id="instance-name" label={t('admin.instanceName')}>
            <Input
              id="instance-name"
              maxLength={60}
              value={form.instanceName}
              onChange={(event) => set('instanceName', event.target.value)}
            />
          </Field>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="setting-gallery">{t('admin.gallery')}</label>
            <Switch
              id="setting-gallery"
              checked={form.galleryEnabled}
              onChange={(v) => set('galleryEnabled', v)}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <label htmlFor="setting-ai">{t('admin.ai')}</label>
              <p className="text-ui-sm text-muted">{t('admin.aiHint')}</p>
            </div>
            <Switch
              id="setting-ai"
              checked={form.aiEnabled}
              onChange={(v) => set('aiEnabled', v)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="setting-ai-quota" label={t('admin.aiQuota')}>
              <Input
                id="setting-ai-quota"
                type="number"
                min={0}
                value={form.aiDailyQuota}
                onChange={(event) => set('aiDailyQuota', Number(event.target.value))}
              />
            </Field>
            <Field id="setting-upload" label={t('admin.maxUpload')}>
              <Input
                id="setting-upload"
                type="number"
                min={1}
                value={form.maxUploadMb}
                onChange={(event) => set('maxUploadMb', Number(event.target.value))}
              />
            </Field>
            <Field id="setting-quota" label={t('admin.quota')}>
              <Input
                id="setting-quota"
                type="number"
                min={1}
                value={form.storageQuotaMb}
                onChange={(event) => set('storageQuotaMb', Number(event.target.value))}
              />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" variant="primary">
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Section>
      {stats.data ? (
        <Section title={t('admin.disk')}>
          <p className="text-ui-lg font-strong">
            {t('admin.diskUsed', { size: formatBytes(stats.data.diskBytes, i18n.language) })}
          </p>
          <p className="mt-1 text-muted">
            {t('admin.counts', {
              users: stats.data.users,
              spaces: stats.data.spaces,
              projects: stats.data.projects,
              trashed: stats.data.trashedProjects,
            })}
          </p>
        </Section>
      ) : null}
    </div>
  )
}
