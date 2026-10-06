import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, Navigate, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Page } from '../components/app-header.tsx'
import { Mascot } from '../components/brand.tsx'
import { Button } from '../components/ui/button.tsx'
import { Dialog } from '../components/ui/dialog.tsx'
import { Badge, Field } from '../components/ui/field.tsx'
import { Input } from '../components/ui/input.tsx'
import { Segmented } from '../components/ui/segmented.tsx'
import { api, call } from '../lib/api.ts'
import { errorMessage } from '../lib/errors.ts'
import { ME_KEY, useMe } from '../lib/session.ts'
import { KIND_ICONS, SPACES_KEY, type SpaceKind } from '../spaces/shared.ts'

export const Route = createFileRoute('/spaces/')({ component: Spaces })

/** The spaces of the account: families, classes, teams (SPEC § 4.7). */
function Spaces() {
  const { t } = useTranslation()
  const me = useMe()
  const navigate = useNavigate()
  const spaces = useQuery({
    queryKey: SPACES_KEY,
    queryFn: () => call(api.spaces.$get()),
    enabled: Boolean(me.data?.user),
  })
  const [creating, setCreating] = useState(false)
  if (me.isPending) return null
  const user = me.data?.user
  if (!user) return <Navigate to="/login" search={{ redirect: '/spaces' }} />
  const managed = user.managedBySpaceId !== null
  const list = spaces.data?.spaces ?? []
  return (
    <Page
      title={t('spaces.title')}
      subtitle={t('spaces.subtitle')}
      actions={
        managed ? null : (
          <Button
            variant="primary"
            size="lg"
            icon={<Plus size={18} />}
            onClick={() => setCreating(true)}
          >
            {t('spaces.create')}
          </Button>
        )
      }
    >
      {spaces.isPending ? null : list.length === 0 ? (
        <section className="mx-auto mt-14 flex max-w-lg flex-col items-center rounded-ui-lg border border-dashed border-border-strong bg-surface px-8 py-12 text-center">
          <Mascot size={110} mood="wave" className="text-text" />
          <h2 className="mt-4 text-ui-xl font-strong">{t('spaces.empty')}</h2>
          <p className="mt-2 text-muted">
            {managed ? t('spaces.managedNotice') : t('spaces.emptyHint')}
          </p>
        </section>
      ) : (
        <ul className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          {list.map((space) => {
            const Icon = KIND_ICONS[space.kind]
            return (
              <li
                key={space.id}
                className="relative flex items-center gap-4 rounded-ui-lg border border-border bg-surface p-4 shadow-1 transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-2"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-ui bg-primary-soft text-primary-text">
                  <Icon size={24} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-strong">
                    <Link
                      to="/spaces/$spaceId"
                      params={{ spaceId: space.id }}
                      aria-label={t('spaces.open', { name: space.name })}
                      className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:rounded-ui-lg focus-visible:after:ring-2 focus-visible:after:ring-primary"
                    >
                      {space.name}
                    </Link>
                  </h2>
                  <p className="text-ui-sm text-muted">
                    {t(`spaces.kinds.${space.kind}`)} ·{' '}
                    {t('spaces.members', { count: space.memberCount })}
                  </p>
                </div>
                <Badge tone={space.manager ? 'primary' : 'neutral'}>
                  {space.manager ? t('spaces.manager') : t('spaces.member')}
                </Badge>
              </li>
            )
          })}
        </ul>
      )}
      <CreateSpaceDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => navigate({ to: '/spaces/$spaceId', params: { spaceId: id } })}
      />
    </Page>
  )
}

function CreateSpaceDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [kind, setKind] = useState<SpaceKind>('family')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    if (open) {
      setKind('family')
      setName(t('spaces.defaultName.family'))
      setError('')
    }
  }, [open, t])
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => !value && onClose()}
      title={t('spaces.createTitle')}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={async (event) => {
          event.preventDefault()
          try {
            const { id } = await call(api.spaces.$post({ json: { name: name.trim(), kind } }))
            await client.invalidateQueries({ queryKey: SPACES_KEY })
            await client.invalidateQueries({ queryKey: ME_KEY })
            onClose()
            onCreated(id)
          } catch (caught) {
            setError(errorMessage(t, caught))
          }
        }}
      >
        <div className="flex flex-col gap-1.5">
          <span className="text-ui-sm font-strong" id="space-kind-label">
            {t('spaces.kind')}
          </span>
          <Segmented
            label={t('spaces.kind')}
            value={kind}
            onChange={(value) => {
              if (name === t(`spaces.defaultName.${kind}`))
                setName(t(`spaces.defaultName.${value}`))
              setKind(value)
            }}
            options={(['family', 'class', 'team'] as const).map((value) => {
              const Icon = KIND_ICONS[value]
              return { value, label: t(`spaces.kinds.${value}`), icon: <Icon size={15} /> }
            })}
          />
          <p className="text-ui-sm text-muted">{t(`spaces.kindHints.${kind}`)}</p>
        </div>
        <Field id="space-name" label={t('spaces.name')} error={error || undefined}>
          <Input
            id="space-name"
            autoFocus
            maxLength={60}
            value={name}
            onChange={(event) => setName(event.target.value)}
            onFocus={(event) => event.target.select()}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" variant="primary" disabled={!name.trim()}>
            {t('common.create')}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
