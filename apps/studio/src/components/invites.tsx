import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Link2, Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api, call } from '../lib/api.ts'
import { errorMessage } from '../lib/errors.ts'
import { relativeTime } from '../lib/time.ts'
import { Button, IconButton } from './ui/button.tsx'
import { Dialog } from './ui/dialog.tsx'
import { Badge, Field } from './ui/field.tsx'
import { Input, Select } from './ui/input.tsx'

export const INVITES_KEY = ['invites'] as const

type Space = { id: string; name: string }

/** The link to send: `<studio>/invite/<code>`. */
export function inviteUrl(code: string): string {
  return `${location.origin}/invite/${code}`
}

/**
 * Creates an invitation (SPEC § 4.7): role, space, number of uses, expiry. Admins choose
 * everything; a space manager invites into their space.
 */
export function CreateInviteDialog({
  open,
  onClose,
  spaces,
  fixedSpace,
  allowAdmin,
}: {
  open: boolean
  onClose: () => void
  spaces: Space[]
  fixedSpace?: Space
  allowAdmin: boolean
}) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [note, setNote] = useState('')
  const [role, setRole] = useState<'user' | 'admin'>('user')
  const [spaceId, setSpaceId] = useState(fixedSpace?.id ?? '')
  const [spaceRole, setSpaceRole] = useState<'member' | 'manager'>('member')
  const [maxUses, setMaxUses] = useState(1)
  const [expires, setExpires] = useState<'1' | '7' | '30' | 'never'>('7')
  const [code, setCode] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (open) {
      setNote('')
      setRole('user')
      setSpaceId(fixedSpace?.id ?? '')
      setSpaceRole('member')
      setMaxUses(1)
      setExpires('7')
      setCode(null)
      setError('')
      setCopied(false)
    }
  }, [open, fixedSpace?.id])

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      const result = await call(
        api.invites.$post({
          json: {
            note: note.trim() || undefined,
            role,
            spaceId: spaceId || undefined,
            spaceRole: spaceId ? spaceRole : undefined,
            maxUses,
            expiresInDays: expires === 'never' ? null : Number(expires),
          },
        }),
      )
      setCode(result.code)
      await client.invalidateQueries({ queryKey: INVITES_KEY })
    } catch (caught) {
      setError(errorMessage(t, caught))
    }
  }

  const copy = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(inviteUrl(code))
      setCopied(true)
      toast.success(t('invites.copied'))
    } catch {}
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => !value && onClose()}
      title={
        code
          ? t('invites.created')
          : fixedSpace
            ? t('spaces.inviteTitle', { name: fixedSpace.name })
            : t('invites.createTitle')
      }
      description={code ? t('invites.linkHint') : fixedSpace ? t('spaces.inviteHint') : undefined}
    >
      {code ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={inviteUrl(code)}
              aria-label={t('invites.copy')}
              data-testid="invite-link"
              onFocus={(event) => event.target.select()}
            />
            <IconButton label={t('invites.copy')} variant="secondary" onClick={copy}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </IconButton>
          </div>
          <div className="flex justify-end">
            <Button variant="primary" onClick={onClose}>
              {t('common.close')}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={create} className="flex flex-col gap-4">
          <Field id="invite-note" label={t('invites.note')}>
            <Input
              id="invite-note"
              maxLength={120}
              placeholder={t('invites.notePlaceholder')}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            {allowAdmin ? (
              <Field id="invite-role" label={t('invites.role')}>
                <Select
                  id="invite-role"
                  value={role}
                  onChange={(event) => setRole(event.target.value as 'user' | 'admin')}
                >
                  <option value="user">{t('invites.roles.user')}</option>
                  <option value="admin">{t('invites.roles.admin')}</option>
                </Select>
              </Field>
            ) : null}
            {fixedSpace ? null : (
              <Field id="invite-space" label={t('invites.space')}>
                <Select
                  id="invite-space"
                  value={spaceId}
                  onChange={(event) => setSpaceId(event.target.value)}
                >
                  <option value="">{t('invites.noSpace')}</option>
                  {spaces.map((space) => (
                    <option key={space.id} value={space.id}>
                      {space.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {spaceId ? (
              <Field id="invite-space-role" label={t('invites.spaceRole')}>
                <Select
                  id="invite-space-role"
                  value={spaceRole}
                  onChange={(event) => setSpaceRole(event.target.value as 'member' | 'manager')}
                >
                  <option value="member">{t('spaces.member')}</option>
                  <option value="manager">{t('spaces.manager')}</option>
                </Select>
              </Field>
            ) : null}
            <Field id="invite-uses" label={t('invites.maxUses')}>
              <Input
                id="invite-uses"
                type="number"
                min={1}
                max={1000}
                value={maxUses}
                onChange={(event) =>
                  setMaxUses(Math.max(1, Math.min(1000, Number(event.target.value) || 1)))
                }
              />
            </Field>
            <Field id="invite-expires" label={t('invites.expires')}>
              <Select
                id="invite-expires"
                value={expires}
                onChange={(event) => setExpires(event.target.value as typeof expires)}
              >
                {(['1', '7', '30', 'never'] as const).map((value) => (
                  <option key={value} value={value}>
                    {t(`invites.expiresIn.${value}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {error ? (
            <p role="alert" className="text-ui-sm text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" variant="primary" icon={<Link2 size={16} />}>
              {t('invites.create')}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}

/** The invitations visible to the caller (all for an admin), optionally of one space. */
export function InviteList({ spaceId }: { spaceId?: string }) {
  const { t, i18n } = useTranslation()
  const client = useQueryClient()
  const invites = useQuery({ queryKey: INVITES_KEY, queryFn: () => call(api.invites.$get()) })
  const list = (invites.data?.invites ?? []).filter(
    (invite) => !spaceId || invite.spaceId === spaceId,
  )
  if (invites.isPending) return null
  if (list.length === 0) return <p className="text-ui-sm text-muted">{t('invites.empty')}</p>
  const tone = {
    active: 'success',
    used: 'neutral',
    expired: 'warning',
    revoked: 'danger',
  } as const
  return (
    <ul className="flex flex-col divide-y divide-border">
      {list.map((invite) => (
        <li key={invite.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-strong">
              <span className="truncate">{invite.note || t('invites.list')}</span>
              <Badge tone={tone[invite.status]}>{t(`invites.status.${invite.status}`)}</Badge>
              {invite.role === 'admin' ? (
                <Badge tone="primary">{t('invites.roles.admin')}</Badge>
              ) : null}
              {invite.spaceName && !spaceId ? (
                <Badge>
                  {invite.spaceName} ·{' '}
                  {invite.spaceRole === 'manager' ? t('spaces.manager') : t('spaces.member')}
                </Badge>
              ) : null}
            </p>
            <p className="text-ui-sm text-muted">
              {t('invites.uses', { uses: invite.uses, max: invite.maxUses })} ·{' '}
              {invite.expiresAt
                ? t('invites.expiresOn', {
                    when: new Date(invite.expiresAt).toLocaleDateString(i18n.language, {
                      day: 'numeric',
                      month: 'short',
                    }),
                  })
                : t('invites.noExpiry')}
              {invite.createdBy ? ` · ${t('invites.by', { name: invite.createdBy })}` : ''}
              {' · '}
              {relativeTime(invite.createdAt, t, i18n.language)}
            </p>
            {invite.usedBy.length > 0 ? (
              <p className="text-ui-sm text-muted">
                {t('invites.usedBy', {
                  names: invite.usedBy
                    .map((user) => `${user.displayName} (${user.username})`)
                    .join(', '),
                })}
              </p>
            ) : null}
          </div>
          {invite.status === 'active' ? (
            <Button
              size="sm"
              variant="ghost"
              icon={<X size={14} />}
              onClick={async () => {
                try {
                  await call(api.invites[':inviteId'].$delete({ param: { inviteId: invite.id } }))
                  toast.success(t('invites.revoked'))
                  await client.invalidateQueries({ queryKey: INVITES_KEY })
                } catch (caught) {
                  toast.error(errorMessage(t, caught))
                }
              }}
            >
              {t('invites.revoke')}
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

export function NewInviteButton(
  props: Omit<Parameters<typeof CreateInviteDialog>[0], 'open' | 'onClose'>,
) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button icon={<Plus size={16} />} onClick={() => setOpen(true)}>
        {t('invites.create')}
      </Button>
      <CreateInviteDialog {...props} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
