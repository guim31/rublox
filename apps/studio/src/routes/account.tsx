import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Navigate } from '@tanstack/react-router'
import { Fingerprint, KeyRound, LogOut, MonitorSmartphone, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Page } from '../components/app-header.tsx'
import { AvatarPicker } from '../components/avatar.tsx'
import { Button, IconButton } from '../components/ui/button.tsx'
import { Badge, describedBy, Field, Section } from '../components/ui/field.tsx'
import { Input } from '../components/ui/input.tsx'
import { Segmented } from '../components/ui/segmented.tsx'
import { api, call, type Profile } from '../lib/api.ts'
import { authClient } from '../lib/auth-client.ts'
import { errorMessage } from '../lib/errors.ts'
import { usePrefs } from '../lib/prefs.ts'
import { ME_KEY, useMe } from '../lib/session.ts'
import { relativeTime } from '../lib/time.ts'

export const Route = createFileRoute('/account')({ component: Account })

/** Profile, preferences and security of the signed-in account (SPEC § 4.7). */
function Account() {
  const { t } = useTranslation()
  const me = useMe()
  if (me.isPending) return null
  const user = me.data?.user
  if (!user) return <Navigate to="/login" search={{ redirect: '/account' }} />
  return (
    <Page title={t('account.title')} width="narrow">
      <div className="mt-6 flex flex-col gap-5">
        <ProfileSection user={user} />
        <PreferencesSection />
        <PasswordSection managed={user.managedBySpaceId !== null} />
        <PasskeysSection />
        <SessionsSection />
      </div>
    </Page>
  )
}

function ProfileSection({ user }: { user: Profile }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [displayName, setDisplayName] = useState(user.displayName)
  const [avatar, setAvatar] = useState(user.avatar)
  const [email, setEmail] = useState(user.email ?? '')
  const [error, setError] = useState('')
  const managed = user.managedBySpaceId !== null
  const changed =
    displayName.trim() !== user.displayName ||
    avatar !== user.avatar ||
    (!managed && email.trim() !== (user.email ?? ''))

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    try {
      await call(
        api.me.$patch({
          json: {
            displayName: displayName.trim(),
            avatar,
            ...(managed ? {} : { email: email.trim() }),
          },
        }),
      )
      await client.invalidateQueries({ queryKey: ME_KEY })
      toast.success(t('account.saved'))
    } catch (caught) {
      setError(errorMessage(t, caught))
    }
  }

  return (
    <Section title={t('account.profile')}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="display-name" label={t('account.displayName')}>
            <Input
              id="display-name"
              value={displayName}
              maxLength={60}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </Field>
          <Field id="account-username" label={t('account.username')}>
            <Input id="account-username" value={user.username} readOnly disabled />
          </Field>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-ui-sm font-strong">{t('account.avatar')}</legend>
          <AvatarPicker value={avatar} onChange={setAvatar} />
        </fieldset>
        {managed ? (
          <p className="text-ui-sm text-muted">{t('account.emailManaged')}</p>
        ) : (
          <Field id="account-email" label={t('account.email')} hint={t('account.emailHint')}>
            <Input
              id="account-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-describedby={describedBy('account-email', true)}
            />
          </Field>
        )}
        {error ? (
          <p role="alert" className="text-ui-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button type="submit" variant="primary" disabled={!changed || !displayName.trim()}>
            {t('account.save')}
          </Button>
        </div>
      </form>
    </Section>
  )
}

/** The same preferences as the top bar; with an account they are saved in the profile. */
function PreferencesSection() {
  const { t } = useTranslation()
  const { mode, setMode, theme, setTheme, locale, setLocale } = usePrefs()
  return (
    <Section title={t('account.preferences')} description={t('account.preferencesHint')}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-strong" id="pref-mode">
            {t('prefs.mode')}
          </span>
          <Segmented
            label={t('prefs.mode')}
            value={mode}
            onChange={setMode}
            options={[
              { value: 'junior', label: t('prefs.junior'), title: t('prefs.juniorHint') },
              { value: 'studio', label: t('prefs.studio'), title: t('prefs.studioHint') },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-strong">{t('prefs.theme')}</span>
          <Segmented
            label={t('prefs.theme')}
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'light', label: t('prefs.light') },
              { value: 'dark', label: t('prefs.dark') },
              { value: 'system', label: t('prefs.system') },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-strong">{t('prefs.language')}</span>
          <Segmented
            label={t('prefs.language')}
            value={locale}
            onChange={setLocale}
            options={[
              { value: 'fr', label: t('prefs.french') },
              { value: 'en', label: t('prefs.english') },
            ]}
          />
        </div>
      </div>
    </Section>
  )
}

function PasswordSection({ managed }: { managed: boolean }) {
  const { t } = useTranslation()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [error, setError] = useState('')
  if (managed) {
    return (
      <Section title={t('account.security')}>
        <p className="text-muted">{t('account.passwordManaged')}</p>
      </Section>
    )
  }
  return (
    <Section title={t('account.changePassword')}>
      <form
        className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={async (event) => {
          event.preventDefault()
          setError('')
          const result = await authClient.changePassword({
            currentPassword: current,
            newPassword: next,
            revokeOtherSessions: true,
          })
          if (result.error) {
            setError(result.error.status === 400 ? t('account.wrongPassword') : t('errors.unknown'))
            return
          }
          setCurrent('')
          setNext('')
          toast.success(t('account.passwordChanged'))
        }}
      >
        <Field id="current-password" label={t('account.currentPassword')}>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
          />
        </Field>
        <Field id="next-password" label={t('account.newPassword')} hint={t('invite.passwordHint')}>
          <Input
            id="next-password"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
            aria-describedby={describedBy('next-password', true)}
          />
        </Field>
        <Button
          type="submit"
          icon={<KeyRound size={16} />}
          disabled={!current || next.length < 8}
          className="sm:mb-[calc(1lh+6px)]"
        >
          {t('account.changePassword')}
        </Button>
        {error ? (
          <p role="alert" className="text-ui-sm text-danger sm:col-span-3">
            {error}
          </p>
        ) : null}
      </form>
    </Section>
  )
}

function PasskeysSection() {
  const { t, i18n } = useTranslation()
  const client = useQueryClient()
  const passkeys = useQuery({
    queryKey: ['passkeys'],
    queryFn: async () => (await authClient.passkey.listUserPasskeys()).data ?? [],
  })
  const supported = typeof window !== 'undefined' && 'PublicKeyCredential' in window
  return (
    <Section
      title={t('account.passkeys')}
      description={t('account.passkeysHint')}
      actions={
        supported ? (
          <Button
            icon={<Fingerprint size={16} />}
            onClick={async () => {
              const name = t('account.passkeyName', {
                date: new Date().toLocaleDateString(i18n.language),
              })
              const result = await authClient.passkey.addPasskey({ name })
              if (result?.error) toast.error(t('account.passkeyFailed'))
              else toast.success(t('account.passkeyAdded'))
              await client.invalidateQueries({ queryKey: ['passkeys'] })
            }}
          >
            {t('account.addPasskey')}
          </Button>
        ) : null
      }
    >
      {(passkeys.data ?? []).length === 0 ? (
        <p className="text-ui-sm text-muted">{t('account.noPasskey')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {(passkeys.data ?? []).map((key) => (
            <li key={key.id} className="flex items-center gap-3 py-2">
              <Fingerprint size={18} className="text-muted" aria-hidden="true" />
              <span className="flex-1 truncate">{key.name ?? key.id}</span>
              <IconButton
                label={t('account.deletePasskey', { name: key.name ?? '' })}
                onClick={async () => {
                  await authClient.passkey.deletePasskey({ id: key.id })
                  await client.invalidateQueries({ queryKey: ['passkeys'] })
                }}
              >
                <Trash2 size={16} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

/** "Firefox on Linux", from the user agent, for the list of devices. */
function describeAgent(
  agent: string | null | undefined,
  t: ReturnType<typeof useTranslation>['t'],
) {
  if (!agent) return t('account.unknownDevice')
  const browser = /Edg\//.test(agent)
    ? 'Edge'
    : /Firefox\//.test(agent)
      ? 'Firefox'
      : /Chrome\//.test(agent)
        ? 'Chrome'
        : /Safari\//.test(agent)
          ? 'Safari'
          : null
  const os = /Android/.test(agent)
    ? 'Android'
    : /iPhone|iPad/.test(agent)
      ? 'iOS'
      : /Mac OS X/.test(agent)
        ? 'macOS'
        : /Windows/.test(agent)
          ? 'Windows'
          : /Linux/.test(agent)
            ? 'Linux'
            : null
  if (!browser || !os) return t('account.unknownDevice')
  return t('account.browserOn', { browser, os })
}

function SessionsSection() {
  const { t, i18n } = useTranslation()
  const client = useQueryClient()
  const sessions = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const [list, current] = await Promise.all([
        authClient.listSessions(),
        authClient.getSession(),
      ])
      return { list: list.data ?? [], currentId: current.data?.session.id ?? null }
    },
  })
  const [now, setNow] = useState(Date.now)
  useEffect(() => setNow(Date.now()), [])
  const refresh = () => client.invalidateQueries({ queryKey: ['sessions'] })
  const list = [...(sessions.data?.list ?? [])].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
  return (
    <Section
      title={t('account.sessions')}
      description={t('account.sessionsHint')}
      actions={
        list.length > 1 ? (
          <Button
            icon={<LogOut size={16} />}
            onClick={async () => {
              await authClient.revokeOtherSessions()
              toast.success(t('account.revoked'))
              await refresh()
            }}
          >
            {t('account.revokeOthers')}
          </Button>
        ) : null
      }
    >
      <ul className="flex flex-col divide-y divide-border">
        {list.map((session) => {
          const current = session.id === sessions.data?.currentId
          return (
            <li key={session.id} className="flex items-center gap-3 py-2.5">
              <MonitorSmartphone size={18} className="text-muted" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-strong">{describeAgent(session.userAgent, t)}</p>
                <p className="truncate text-ui-sm text-muted">
                  {t('account.lastActive', {
                    when: relativeTime(
                      new Date(session.updatedAt).toISOString(),
                      t,
                      i18n.language,
                      now,
                    ),
                  })}
                </p>
              </div>
              {current ? (
                <Badge tone="primary">{t('account.thisDevice')}</Badge>
              ) : (
                <Button
                  size="sm"
                  onClick={async () => {
                    await authClient.revokeSession({ token: session.token })
                    toast.success(t('account.revoked'))
                    await refresh()
                  }}
                >
                  {t('account.revoke')}
                </Button>
              )}
            </li>
          )
        })}
      </ul>
    </Section>
  )
}
