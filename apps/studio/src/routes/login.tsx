import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Eye, EyeOff, Fingerprint, LogIn } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Logo } from '../components/brand.tsx'
import { PrefsMenu } from '../components/prefs-controls.tsx'
import { Button, IconButton } from '../components/ui/button.tsx'
import { describedBy, Field } from '../components/ui/field.tsx'
import { Input } from '../components/ui/input.tsx'
import { authClient } from '../lib/auth-client.ts'
import { refreshMe, useMe } from '../lib/session.ts'

type Search = { redirect?: string }

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): Search =>
    typeof search.redirect === 'string' && search.redirect.startsWith('/')
      ? { redirect: search.redirect }
      : {},
  component: Login,
})

/** Sign in with a username or an e-mail and a password, or with a passkey (SPEC § 4.7). */
function Login() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { redirect } = Route.useSearch()
  const me = useMe()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const done = async () => {
    const result = await refreshMe()
    if (result.user) toast.success(t('auth.welcome', { name: result.user.displayName }))
    await navigate({ to: redirect ?? '/' })
  }

  useEffect(() => {
    if (me.data?.user) void navigate({ to: redirect ?? '/' })
  }, [me.data?.user, navigate, redirect])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy || !identifier.trim() || !password) return
    setBusy(true)
    setError('')
    try {
      const byEmail = identifier.includes('@')
      const response = await fetch(`/api/auth/sign-in/${byEmail ? 'email' : 'username'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          byEmail
            ? { email: identifier.trim(), password }
            : { username: identifier.trim(), password },
        ),
      })
      if (response.ok) return await done()
      if (response.status === 429) {
        const seconds = Number(response.headers.get('retry-after')) || 900
        setError(t('auth.tooMany', { minutes: Math.ceil(seconds / 60) }))
      } else if (response.status === 403) setError(t('auth.disabled'))
      else setError(t('auth.invalid'))
    } catch {
      setError(t('errors.network'))
    } finally {
      setBusy(false)
    }
  }

  const passkey = async () => {
    setError('')
    const result = await authClient.signIn.passkey()
    if (result?.error) setError(t('auth.passkeyFailed'))
    else await done()
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
        <div className="w-full max-w-sm rounded-ui-lg border border-border bg-surface p-6 shadow-2 junior:p-8 rx-anim-in">
          <h1 className="text-ui-xl font-strong">{t('auth.title')}</h1>
          <p className="mt-1 text-muted">{t('auth.subtitle')}</p>
          <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
            <Field id="identifier" label={t('auth.identifier')}>
              <Input
                id="identifier"
                name="username"
                autoComplete="username webauthn"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
              />
            </Field>
            <Field id="password" label={t('auth.password')} error={error || undefined}>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={visible ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={describedBy('password', undefined, error)}
                  className="pr-11"
                />
                <IconButton
                  label={visible ? t('auth.hidePassword') : t('auth.showPassword')}
                  size="sm"
                  onClick={() => setVisible(!visible)}
                  className="absolute top-1/2 right-1 -translate-y-1/2 text-muted"
                >
                  {visible ? <EyeOff size={16} /> : <Eye size={16} />}
                </IconButton>
              </div>
            </Field>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              icon={<LogIn size={18} />}
              disabled={busy || !identifier.trim() || !password}
            >
              {t('auth.submit')}
            </Button>
          </form>
          <div className="my-5 flex items-center gap-3 text-ui-sm text-muted" aria-hidden="true">
            <span className="h-px flex-1 bg-border" />
            {t('auth.or')}
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button className="w-full" icon={<Fingerprint size={18} />} onClick={passkey}>
            {t('auth.passkey')}
          </Button>
          <p className="mt-1.5 text-center text-ui-sm text-muted">{t('auth.passkeyHint')}</p>
          <div className="mt-6 border-t border-border pt-5 text-center">
            <Link
              to="/"
              className="font-strong text-primary-text underline-offset-4 hover:underline"
            >
              {t('auth.guest')}
            </Link>
            <p className="mt-1 text-ui-sm text-muted">{t('auth.guestHint')}</p>
            <p className="mt-4 text-ui-sm text-muted">{t('auth.noAccount')}</p>
          </div>
        </div>
      </main>
    </div>
  )
}
