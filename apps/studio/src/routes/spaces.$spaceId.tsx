import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, Navigate, useNavigate } from '@tanstack/react-router'
import type { InferResponseType } from 'hono/client'
import {
  ArrowLeft,
  Download,
  KeyRound,
  LogOut,
  MoreHorizontal,
  ShieldCheck,
  Trash2,
  UserMinus,
  UserPlus,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AppHeader } from '../components/app-header.tsx'
import { Avatar } from '../components/avatar.tsx'
import { Mascot } from '../components/brand.tsx'
import { ConfirmDialog, NewAccountDialog, PasswordDialog } from '../components/dialogs.tsx'
import { InviteList, NewInviteButton } from '../components/invites.tsx'
import { Button, IconButton } from '../components/ui/button.tsx'
import { Badge, Field, Section } from '../components/ui/field.tsx'
import { Input } from '../components/ui/input.tsx'
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '../components/ui/menu.tsx'
import { Segmented } from '../components/ui/segmented.tsx'
import { Switch } from '../components/ui/switch.tsx'
import { ProjectThumbnail } from '../dashboard/thumbnail.tsx'
import { api, call } from '../lib/api.ts'
import { downloadJson } from '../lib/download.ts'
import { errorMessage } from '../lib/errors.ts'
import { useFeatures } from '../lib/features.ts'
import { isDark, usePrefs } from '../lib/prefs.ts'
import { ME_KEY, useMe } from '../lib/session.ts'
import { relativeTime } from '../lib/time.ts'
import { KIND_ICONS, SPACES_KEY, type SpaceKind } from '../spaces/shared.ts'
import type { ProjectSummary } from '../storage/projects.ts'

export const Route = createFileRoute('/spaces/$spaceId')({ component: SpacePage })

const space = api.spaces[':spaceId']

type Member = {
  id: string
  username: string
  displayName: string
  avatar: string | null
  manager: boolean
  owner: boolean
  managed: boolean
  disabled: boolean
}

/** One space: its members and their accounts, their projects, invitations, settings. */
function SpacePage() {
  const { t } = useTranslation()
  const { spaceId } = Route.useParams()
  const me = useMe()
  const user = me.data?.user
  const details = useQuery({
    queryKey: [...SPACES_KEY, spaceId],
    queryFn: () => call(space.$get({ param: { spaceId } })),
    enabled: Boolean(user),
    staleTime: 0,
    refetchOnWindowFocus: true,
  })
  if (me.isPending) return null
  if (!user) return <Navigate to="/login" search={{ redirect: `/spaces/${spaceId}` }} />
  return (
    <div className="flex min-h-full flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 pt-6 pb-16">
        <Link
          to="/spaces"
          className="inline-flex items-center gap-1.5 rounded-ui text-ui-sm font-strong text-muted hover:text-text"
        >
          <ArrowLeft size={15} />
          {t('spaces.back')}
        </Link>
        {details.isPending ? null : details.isError ? (
          <div className="mt-16 flex flex-col items-center gap-3 text-center">
            <Mascot size={100} />
            <p className="text-muted">{t('spaces.notFound')}</p>
          </div>
        ) : (
          <SpaceDetails data={details.data} meId={user.id} />
        )}
      </main>
    </div>
  )
}

type Details = InferResponseType<typeof space.$get, 200>

function SpaceDetails({ data, meId }: { data: Details; meId: string }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const Icon = KIND_ICONS[data.space.kind]
  const [tab, setTab] = useState<'members' | 'projects' | 'invites' | 'settings'>('members')
  const tabs = data.manager
    ? (['members', 'projects', 'invites', 'settings'] as const)
    : (['members'] as const)
  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <span className="grid size-14 place-items-center rounded-ui-lg bg-primary-soft text-primary-text">
          <Icon size={28} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-ui-xl font-strong tracking-tight">{data.space.name}</h1>
          <p className="text-muted">
            {t(`spaces.kinds.${data.space.kind}`)} ·{' '}
            {data.manager ? t('spaces.youManage') : t('spaces.youAreMember')}
          </p>
        </div>
      </div>
      {tabs.length > 1 ? (
        <Segmented
          className="mt-6"
          label={data.space.name}
          value={tab}
          onChange={(value) => {
            setTab(value)
            void client.invalidateQueries({ queryKey: [...SPACES_KEY, data.space.id] })
          }}
          options={tabs.map((value) => ({ value, label: t(`spaces.tabs.${value}`) }))}
        />
      ) : null}
      <div className="mt-6">
        {tab === 'members' ? <MembersSection data={data} meId={meId} /> : null}
        {tab === 'projects' ? <ProjectsSection data={data} /> : null}
        {tab === 'invites' ? (
          <Section
            title={t('spaces.tabs.invites')}
            description={t('spaces.inviteHint')}
            actions={
              <NewInviteButton
                spaces={[]}
                fixedSpace={{ id: data.space.id, name: data.space.name }}
                allowAdmin={false}
              />
            }
          >
            <InviteList spaceId={data.space.id} />
          </Section>
        ) : null}
        {tab === 'settings' ? <SettingsSection data={data} /> : null}
      </div>
    </>
  )
}

function MembersSection({ data, meId }: { data: Details; meId: string }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const navigate = useNavigate()
  const spaceId = data.space.id
  const [adding, setAdding] = useState(false)
  const [resetting, setResetting] = useState<Member | null>(null)
  const [deleting, setDeleting] = useState<Member | null>(null)
  const refresh = () => client.invalidateQueries({ queryKey: SPACES_KEY })
  const run = async (action: () => Promise<unknown>, done?: string) => {
    try {
      await action()
      if (done) toast.success(done)
      await refresh()
    } catch (caught) {
      toast.error(errorMessage(t, caught))
    }
  }
  const mine = data.members.find((m) => m.id === meId)
  return (
    <Section
      title={t('spaces.tabs.members')}
      actions={
        data.manager ? (
          <Button variant="primary" icon={<UserPlus size={16} />} onClick={() => setAdding(true)}>
            {t('spaces.addAccount')}
          </Button>
        ) : null
      }
    >
      <ul className="flex flex-col divide-y divide-border">
        {data.members.map((member) => (
          <li
            key={member.id}
            className="flex items-center gap-3 py-3"
            data-testid={`member-${member.username}`}
          >
            <Avatar id={member.avatar} name={member.displayName} size={40} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2">
                <span className="truncate font-strong">{member.displayName}</span>
                {member.manager ? (
                  <Badge tone="primary">
                    {member.owner ? t('spaces.owner') : t('spaces.manager')}
                  </Badge>
                ) : null}
                {member.managed ? <Badge>{t('spaces.managedAccount')}</Badge> : null}
                {member.disabled ? <Badge tone="danger">{t('spaces.disabled')}</Badge> : null}
              </p>
              <p className="truncate text-ui-sm text-muted">{member.username}</p>
            </div>
            {data.manager && member.id !== meId && !member.owner ? (
              <Menu>
                <MenuTrigger asChild>
                  <IconButton label={t('admin.actions', { name: member.displayName })}>
                    <MoreHorizontal size={18} />
                  </IconButton>
                </MenuTrigger>
                <MenuContent>
                  {member.managed ? (
                    <>
                      <MenuItem icon={<KeyRound size={15} />} onSelect={() => setResetting(member)}>
                        {t('spaces.resetPassword')}
                      </MenuItem>
                      <MenuItem
                        icon={<Download size={15} />}
                        onSelect={() =>
                          run(async () => {
                            // Typed loosely: the export's full type is too deep for the checker.
                            const data: unknown = await call(
                              api.spaces[':spaceId'].accounts[':userId'].export.$get({
                                param: { spaceId, userId: member.id },
                              }) as unknown as Promise<Response>,
                            )
                            downloadJson(data, `rublox-${member.username}.json`)
                          })
                        }
                      >
                        {t('spaces.exportAccount')}
                      </MenuItem>
                      <MenuSeparator />
                      <MenuItem
                        icon={<Trash2 size={15} />}
                        danger
                        onSelect={() => setDeleting(member)}
                      >
                        {t('spaces.deleteAccount')}
                      </MenuItem>
                    </>
                  ) : (
                    <>
                      <MenuItem
                        icon={<ShieldCheck size={15} />}
                        onSelect={() =>
                          run(() =>
                            call(
                              space.members[':userId'].$patch({
                                param: { spaceId, userId: member.id },
                                json: { manager: !member.manager },
                              }),
                            ),
                          )
                        }
                      >
                        {member.manager ? t('spaces.makeMember') : t('spaces.makeManager')}
                      </MenuItem>
                      <MenuItem
                        icon={<UserMinus size={15} />}
                        danger
                        onSelect={() =>
                          run(() =>
                            call(
                              space.members[':userId'].$delete({
                                param: { spaceId, userId: member.id },
                              }),
                            ),
                          )
                        }
                      >
                        {t('spaces.remove')}
                      </MenuItem>
                    </>
                  )}
                </MenuContent>
              </Menu>
            ) : null}
          </li>
        ))}
      </ul>
      {mine && !mine.managed && !mine.owner ? (
        <div className="mt-4 flex justify-end">
          <Button
            variant="ghost"
            icon={<LogOut size={16} />}
            onClick={() =>
              run(async () => {
                await call(space.members[':userId'].$delete({ param: { spaceId, userId: meId } }))
                await client.invalidateQueries({ queryKey: ME_KEY })
                await navigate({ to: '/spaces' })
              })
            }
          >
            {t('spaces.leave')}
          </Button>
        </div>
      ) : null}
      <NewAccountDialog
        open={adding}
        title={t('spaces.addAccountTitle', { name: data.space.name })}
        hint={t('spaces.addAccountHint')}
        onClose={() => setAdding(false)}
        onSubmit={async (account) => {
          await call(space.accounts.$post({ param: { spaceId }, json: account }))
          toast.success(
            t('spaces.accountCreated', { name: account.displayName, username: account.username }),
          )
          await refresh()
        }}
      />
      <PasswordDialog
        open={resetting !== null}
        title={t('spaces.resetTitle', { name: resetting?.displayName ?? '' })}
        onClose={() => setResetting(null)}
        onSubmit={async (password) => {
          if (!resetting) return
          await call(
            space.accounts[':userId'].password.$post({
              param: { spaceId, userId: resetting.id },
              json: { password },
            }),
          )
          toast.success(t('spaces.resetDone', { name: resetting.displayName }))
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        title={t('spaces.deleteAccountTitle', { name: deleting?.displayName ?? '' })}
        text={t('spaces.deleteAccountText')}
        action={t('spaces.deleteAccount')}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return
          await call(space.accounts[':userId'].$delete({ param: { spaceId, userId: deleting.id } }))
          await refresh()
        }}
      />
    </Section>
  )
}

/** The members' projects, read-only for the managers (SPEC § 4.7). */
function ProjectsSection({ data }: { data: Details }) {
  const { t, i18n } = useTranslation()
  const theme = usePrefs((s) => s.theme)
  const [now] = useState(Date.now)
  const owners = new Map(data.members.map((m) => [m.id, m]))
  if (data.projects.length === 0) {
    return <p className="py-10 text-center text-muted">{t('spaces.noProjects')}</p>
  }
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
      {data.projects.map((project) => {
        const owner = owners.get(project.ownerId)
        return (
          <li
            key={project.id}
            className="relative flex flex-col overflow-hidden rounded-ui-lg border border-border bg-surface shadow-1 transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-2"
          >
            <div className="relative h-[150px] bg-canvas [--thumb-scale:0.5]">
              <div className="absolute inset-x-5 top-3 bottom-0 overflow-hidden rounded-t-[16px] border-4 border-b-0 border-text/85 bg-surface">
                <ProjectThumbnail
                  preview={project.preview as ProjectSummary['preview']}
                  dark={isDark(theme)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 p-3">
              {owner ? <Avatar id={owner.avatar} name={owner.displayName} size={28} /> : null}
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-strong">
                  <Link
                    to="/p/$projectId"
                    params={{ projectId: project.id }}
                    search={{ tab: 'design' }}
                    className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:rounded-ui-lg focus-visible:after:ring-2 focus-visible:after:ring-primary"
                  >
                    {project.name}
                  </Link>
                </h3>
                <p className="truncate text-ui-sm text-muted">
                  {owner ? t('spaces.projectBy', { name: owner.displayName }) : ''} ·{' '}
                  {relativeTime(project.updatedAt, t, i18n.language, now)}
                </p>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function SettingsSection({ data }: { data: Details }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const navigate = useNavigate()
  const spaceId = data.space.id
  const [name, setName] = useState(data.space.name)
  const [kind, setKind] = useState<SpaceKind>(data.space.kind)
  const [deleting, setDeleting] = useState(false)
  useEffect(() => {
    setName(data.space.name)
    setKind(data.space.kind)
  }, [data.space.name, data.space.kind])
  const save = async (patch: Parameters<typeof space.$patch>[0]['json']) => {
    try {
      await call(space.$patch({ param: { spaceId }, json: patch }))
      await client.invalidateQueries({ queryKey: SPACES_KEY })
      await client.invalidateQueries({ queryKey: ME_KEY })
      toast.success(t('spaces.settingsSaved'))
    } catch (caught) {
      toast.error(errorMessage(t, caught))
    }
  }
  // Without `ANTHROPIC_API_KEY` the assistant has no switch here either (SPEC § 8).
  const { aiConfigured } = useFeatures()
  const rights = (
    [
      ['membersCanPublish', t('spaces.canPublish')],
      ['membersCanUseAi', t('ai.space.canUseAi')],
      ['membersCanShareInGallery', t('spaces.canShareInGallery')],
    ] as const
  ).filter(([field]) => aiConfigured || field !== 'membersCanUseAi')
  return (
    <div className="flex flex-col gap-5">
      <Section title={t('spaces.tabs.settings')}>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            void save({ name: name.trim(), kind })
          }}
        >
          <Field id="space-settings-name" label={t('spaces.name')} className="min-w-52 flex-1">
            <Input
              id="space-settings-name"
              maxLength={60}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-ui-sm font-strong">{t('spaces.kind')}</span>
            <Segmented
              label={t('spaces.kind')}
              value={kind}
              onChange={setKind}
              options={(['family', 'class', 'team'] as const).map((value) => ({
                value,
                label: t(`spaces.kinds.${value}`),
              }))}
            />
          </div>
          <Button type="submit" variant="primary" disabled={!name.trim()}>
            {t('common.save')}
          </Button>
        </form>
      </Section>
      <Section title={t('spaces.rights')}>
        <ul className="flex flex-col gap-3">
          {rights.map(([field, label]) => (
            <li key={field} className="flex items-center justify-between gap-3">
              <label htmlFor={`right-${field}`}>{label}</label>
              <Switch
                id={`right-${field}`}
                checked={data.space[field]}
                onChange={(value) => void save({ [field]: value })}
              />
            </li>
          ))}
        </ul>
      </Section>
      <Section title={t('spaces.deleteSpace')} description={t('spaces.deleteSpaceText')}>
        <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => setDeleting(true)}>
          {t('spaces.deleteSpace')}
        </Button>
      </Section>
      <ConfirmDialog
        open={deleting}
        title={t('spaces.deleteSpaceTitle', { name: data.space.name })}
        text={t('spaces.deleteSpaceText')}
        action={t('spaces.deleteSpace')}
        onClose={() => setDeleting(false)}
        onConfirm={async () => {
          await call(space.$delete({ param: { spaceId } }))
          toast.success(t('spaces.deleted'))
          await client.invalidateQueries({ queryKey: SPACES_KEY })
          await client.invalidateQueries({ queryKey: ME_KEY })
          await navigate({ to: '/spaces' })
        }}
      />
    </div>
  )
}
