import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { errorMessage } from '../lib/errors.ts'
import { Button } from './ui/button.tsx'
import { Dialog } from './ui/dialog.tsx'
import { describedBy, Field } from './ui/field.tsx'
import { Input } from './ui/input.tsx'

/** "Are you sure?" for a destructive action, which says exactly what it destroys (SPEC § 5.1). */
export function ConfirmDialog({
  open,
  title,
  text,
  action,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  text: string
  action: string
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const { t } = useTranslation()
  const [error, setError] = useState('')
  useEffect(() => {
    if (open) setError('')
  }, [open])
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => !value && onClose()}
      title={title}
      description={text}
    >
      {error ? (
        <p role="alert" className="mb-3 text-ui-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          variant="danger"
          onClick={async () => {
            try {
              await onConfirm()
              onClose()
            } catch (caught) {
              setError(errorMessage(t, caught))
            }
          }}
        >
          {action}
        </Button>
      </div>
    </Dialog>
  )
}

/** Sets a new password for someone else (member account, admin). */
export function PasswordDialog({
  open,
  title,
  onClose,
  onSubmit,
}: {
  open: boolean
  title: string
  onClose: () => void
  onSubmit: (password: string) => Promise<void>
}) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    if (open) {
      setPassword('')
      setError('')
    }
  }, [open])
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()} title={title}>
      <form
        className="flex flex-col gap-4"
        onSubmit={async (event) => {
          event.preventDefault()
          try {
            await onSubmit(password)
            onClose()
          } catch (caught) {
            setError(errorMessage(t, caught))
          }
        }}
      >
        <Field
          id="other-password"
          label={t('account.newPassword')}
          hint={t('invite.passwordHint')}
          error={error || undefined}
        >
          <Input
            id="other-password"
            type="text"
            autoComplete="off"
            autoFocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-describedby={describedBy('other-password', true, error)}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" variant="primary" disabled={password.length < 8}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

const USERNAME = /^[a-z0-9][a-z0-9._-]{2,31}$/

export function usernameFrom(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[^a-z0-9]+|-+$/g, '')
    .slice(0, 32)
}

export type NewAccount = { displayName: string; username: string; password: string }

/** Name, username and password of a new account (space member, admin page). */
export function NewAccountDialog({
  open,
  title,
  hint,
  onClose,
  onSubmit,
  children,
}: {
  open: boolean
  title: string
  hint?: string
  onClose: () => void
  onSubmit: (account: NewAccount) => Promise<void>
  children?: React.ReactNode
}) {
  const { t } = useTranslation()
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    if (open) {
      setDisplayName('')
      setUsername(null)
      setPassword('')
      setError('')
    }
  }, [open])
  const name = username ?? usernameFrom(displayName)
  const valid = displayName.trim() !== '' && USERNAME.test(name) && password.length >= 8
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => !value && onClose()}
      title={title}
      description={hint}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={async (event) => {
          event.preventDefault()
          if (!valid) return
          try {
            await onSubmit({ displayName: displayName.trim(), username: name, password })
            onClose()
          } catch (caught) {
            setError(errorMessage(t, caught))
          }
        }}
      >
        <Field id="new-display-name" label={t('invite.displayName')}>
          <Input
            id="new-display-name"
            autoFocus
            maxLength={60}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </Field>
        <Field id="new-username" label={t('invite.username')} hint={t('invite.usernameHint')}>
          <Input
            id="new-username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={32}
            value={name}
            onChange={(event) => setUsername(event.target.value.toLowerCase())}
            aria-describedby={describedBy('new-username', true)}
          />
        </Field>
        <Field
          id="new-account-password"
          label={t('invite.password')}
          hint={t('invite.passwordHint')}
        >
          <Input
            id="new-account-password"
            type="text"
            autoComplete="off"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-describedby={describedBy('new-account-password', true)}
          />
        </Field>
        {children}
        {error ? (
          <p role="alert" className="text-ui-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" variant="primary" disabled={!valid}>
            {t('common.create')}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
