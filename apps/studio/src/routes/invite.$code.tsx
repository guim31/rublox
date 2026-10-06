import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Logo, Mascot } from '../components/brand.tsx'
import { PrefsMenu } from '../components/prefs-controls.tsx'
import { Button } from '../components/ui/button.tsx'
import { describedBy, Field } from '../components/ui/field.tsx'
import { Input } from '../components/ui/input.tsx'
import { ApiError, api, call } from '../lib/api.ts'
import { errorMessage } from '../lib/errors.ts'
import { refreshMe } from '../lib/session.ts'

export const Route = createFileRoute('/invite/$code')({ component: Invite })

const USERNAME = /^[a-z0-9][a-z0-9._-]{2,31}$/

/** Creates an account from an invitation link (SPEC § 4.7: no open registration). */
function Invite() {
  const { t } = useTranslation()
  const { code } = Route.useParams()
  const navigate = useNavigate()
  const check = useQuery({
    queryKey: ['invite', code],
    queryFn: () => call(api.invites.check.$post({ json: { code } })),
  })
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [usernameEdited, setUsernameEdited] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<{ field?: string; message: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const suggested = displayName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[^a-z0-9]+|-+$/g, '')
    .slice(0, 32)
  const name = usernameEdited ? username : suggested
  const mismatch = confirm.length > 0 && confirm !== password
  const valid =
    displayName.trim().length > 0 && USERNAME.test(name) && password.length >= 8 && !mismatch

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    setError(null)
    try {
      await call(
        api.invites.accept.$post({
          json: { code, username: name, displayName: displayName.trim(), password, email },
        }),
      )
      const me = await refreshMe()
      if (me.user) toast.success(t('auth.welcome', { name: me.user.displayName }))
      await navigate({ to: '/' })
    } catch (caught) {
      const field =
        caught instanceof ApiError && caught.code === 'username_taken'
          ? 'username'
          : caught instanceof ApiError && caught.code === 'email_taken'
            ? 'email'
            : undefined
      setError({ field, message: errorMessage(t, caught) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5">
        <Link to="/" className="rounded-ui">
          <Logo />
        </Link>
        <PrefsMenu />
      </header>
      <main className="grid flex-1 place-items-center px-5 pb-16">
        {check.isPending ? (
          <p role="status" className="text-muted">
            {t('invite.checking')}
          </p>
        ) : check.isError ? (
          <div className="flex max-w-md flex-col items-center gap-3 text-center">
            <Mascot size={110} />
            <h1 className="text-ui-xl font-strong">{t('invite.invalidTitle')}</h1>
            <p className="text-muted">{t('invite.invalidText')}</p>
            <Link to="/login">
              <Button variant="primary">{t('userMenu.signIn')}</Button>
            </Link>
          </div>
        ) : (
          <div className="w-full max-w-md rounded-ui-lg border border-border bg-surface p-6 shadow-2 junior:p-8 rx-anim-in">
            <div className="flex items-center gap-4">
              <Mascot size={72} mood="wave" className="shrink-0 text-text" />
              <div>
                <h1 className="text-ui-xl font-strong">{t('invite.title')}</h1>
                <p className="mt-1 text-muted">{t('invite.subtitle')}</p>
              </div>
            </div>
            {check.data.space ? (
              <p className="mt-4 rounded-ui bg-primary-soft px-3 py-2 text-primary-text">
                {check.data.space.role === 'manager'
                  ? t('invite.joinSpaceManager', { name: check.data.space.name })
                  : t('invite.joinSpace', { name: check.data.space.name })}
              </p>
            ) : null}
            {check.data.role === 'admin' ? (
              <p className="mt-3 rounded-ui bg-yellow-soft px-3 py-2">{t('invite.asAdmin')}</p>
            ) : null}
            <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
              <Field
                id="displayName"
                label={t('invite.displayName')}
                hint={t('invite.displayNameHint')}
              >
                <Input
                  id="displayName"
                  autoComplete="nickname"
                  autoFocus
                  maxLength={60}
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  aria-describedby={describedBy('displayName', true)}
                />
              </Field>
              <Field
                id="username"
                label={t('invite.username')}
                hint={t('invite.usernameHint')}
                error={error?.field === 'username' ? error.message : undefined}
              >
                <Input
                  id="username"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={32}
                  value={name}
                  onChange={(event) => {
                    setUsernameEdited(true)
                    setUsername(event.target.value.toLowerCase())
                  }}
                  aria-invalid={name.length > 0 && !USERNAME.test(name) ? true : undefined}
                  aria-describedby={describedBy('username', true, error?.field === 'username')}
                />
              </Field>
              <Field id="new-password" label={t('invite.password')} hint={t('invite.passwordHint')}>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-describedby={describedBy('new-password', true)}
                />
              </Field>
              <Field
                id="confirm"
                label={t('invite.confirm')}
                error={mismatch ? t('invite.mismatch') : undefined}
              >
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  aria-invalid={mismatch ? true : undefined}
                  aria-describedby={describedBy('confirm', undefined, mismatch)}
                />
              </Field>
              <Field
                id="email"
                label={t('invite.email')}
                hint={t('invite.emailHint')}
                error={error?.field === 'email' ? error.message : undefined}
              >
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-describedby={describedBy('email', true, error?.field === 'email')}
                />
              </Field>
              {error && !error.field ? (
                <p role="alert" className="text-ui-sm text-danger">
                  {error.message}
                </p>
              ) : null}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                icon={<UserPlus size={18} />}
                disabled={!valid || busy}
              >
                {t('invite.submit')}
              </Button>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}
