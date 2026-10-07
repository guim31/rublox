import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Crown, MoreHorizontal, UserMinus, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Avatar } from '../components/avatar.tsx'
import { Button, IconButton } from '../components/ui/button.tsx'
import { Dialog } from '../components/ui/dialog.tsx'
import { Badge, Field } from '../components/ui/field.tsx'
import { Input, Select } from '../components/ui/input.tsx'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../components/ui/menu.tsx'
import { GallerySharing } from '../gallery/sharing.tsx'
import { ApiError, api, call } from '../lib/api.ts'
import { errorMessage } from '../lib/errors.ts'
import { useUser } from '../lib/session.ts'
import { useSession } from './context.tsx'

const project = api.projects[':projectId']

/** Shares a server project with other accounts, read or write (SPEC § 4.8). */
export function ShareDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const session = useSession()
  const user = useUser()
  const client = useQueryClient()
  const navigate = useNavigate()
  const projectId = session.id
  const owner = session.source.owner
  const isOwner = session.source.access === 'owner'
  const key = ['project-members', projectId]
  const members = useQuery({
    queryKey: key,
    queryFn: () => call(project.members.$get({ param: { projectId } })),
    enabled: open,
  })
  const [username, setUsername] = useState('')
  const [role, setRole] = useState<'viewer' | 'editor'>('editor')
  const [error, setError] = useState('')
  const [transferTo, setTransferTo] = useState<{ id: string; name: string } | null>(null)
  const name = session.getDoc().meta.name

  const refresh = () => client.invalidateQueries({ queryKey: key })

  const add = async (event: React.FormEvent) => {
    event.preventDefault()
    const target = username.trim().toLowerCase()
    if (!target) return
    setError('')
    try {
      await call(project.members.$put({ param: { projectId }, json: { username: target, role } }))
      toast.success(t('share.added', { username: target }))
      setUsername('')
      await refresh()
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.code === 'not_found'
          ? t('share.notFound')
          : errorMessage(t, caught),
      )
    }
  }

  const remove = async (userId: string) => {
    try {
      await call(project.members[':userId'].$delete({ param: { projectId, userId } }))
      if (userId === user?.id) {
        onClose()
        await navigate({ to: '/' })
      } else await refresh()
    } catch (caught) {
      toast.error(errorMessage(t, caught))
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(value) => !value && onClose()}
        title={t('share.title', { name })}
        description={isOwner ? t('share.hint') : t('share.onlyOwner')}
        className="w-[min(92vw,520px)]"
      >
        {isOwner ? (
          <form onSubmit={add} className="flex flex-wrap items-end gap-2">
            <Field id="share-username" label={t('share.username')} className="min-w-40 flex-1">
              <Input
                id="share-username"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </Field>
            <Field id="share-role" label={t('share.role')}>
              <Select
                id="share-role"
                value={role}
                onChange={(event) => setRole(event.target.value as 'viewer' | 'editor')}
              >
                <option value="editor">{t('share.roles.editor')}</option>
                <option value="viewer">{t('share.roles.viewer')}</option>
              </Select>
            </Field>
            <Button
              type="submit"
              variant="primary"
              icon={<UserPlus size={16} />}
              disabled={!username.trim()}
            >
              {t('share.add')}
            </Button>
            {error ? (
              <p role="alert" className="w-full text-ui-sm text-danger">
                {error}
              </p>
            ) : null}
          </form>
        ) : null}
        <ul className="mt-5 flex flex-col divide-y divide-border">
          {owner ? (
            <li className="flex items-center gap-3 py-2.5">
              <Avatar id={owner.avatar} name={owner.displayName} size={32} />
              <span className="min-w-0 flex-1 truncate font-strong">{owner.displayName}</span>
              <Badge tone="primary">{t('share.owner')}</Badge>
            </li>
          ) : null}
          {(members.data?.members ?? []).map((member) => (
            <li key={member.id} className="flex items-center gap-3 py-2.5">
              <Avatar id={member.avatar} name={member.displayName} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-strong">{member.displayName}</p>
                <p className="truncate text-ui-sm text-muted">{member.username}</p>
              </div>
              {isOwner ? (
                <>
                  <Select
                    aria-label={t('share.role')}
                    value={member.role}
                    className="w-auto"
                    onChange={async (event) => {
                      await call(
                        project.members.$put({
                          param: { projectId },
                          json: {
                            username: member.username,
                            role: event.target.value as 'viewer' | 'editor',
                          },
                        }),
                      ).catch((caught) => toast.error(errorMessage(t, caught)))
                      await refresh()
                    }}
                  >
                    <option value="editor">{t('share.roles.editor')}</option>
                    <option value="viewer">{t('share.roles.viewer')}</option>
                  </Select>
                  <Menu>
                    <MenuTrigger asChild>
                      <IconButton label={t('admin.actions', { name: member.displayName })}>
                        <MoreHorizontal size={18} />
                      </IconButton>
                    </MenuTrigger>
                    <MenuContent>
                      <MenuItem
                        icon={<Crown size={15} />}
                        onSelect={() => setTransferTo({ id: member.id, name: member.displayName })}
                      >
                        {t('share.makeOwner')}
                      </MenuItem>
                      <MenuItem
                        icon={<UserMinus size={15} />}
                        danger
                        onSelect={() => remove(member.id)}
                      >
                        {t('share.remove', { name: member.displayName })}
                      </MenuItem>
                    </MenuContent>
                  </Menu>
                </>
              ) : (
                <Badge>{t(`share.roles.${member.role}`)}</Badge>
              )}
            </li>
          ))}
        </ul>
        {members.data && members.data.members.length === 0 ? (
          <p className="mt-2 text-ui-sm text-muted">{t('share.nobody')}</p>
        ) : null}
        {isOwner ? <GallerySharing projectId={projectId} /> : null}
        {!isOwner && user && members.data?.members.some((m) => m.id === user.id) ? (
          <div className="mt-4 flex justify-end">
            <Button variant="ghost" icon={<UserMinus size={16} />} onClick={() => remove(user.id)}>
              {t('share.leave')}
            </Button>
          </div>
        ) : null}
      </Dialog>
      <Dialog
        open={transferTo !== null}
        onOpenChange={(value) => !value && setTransferTo(null)}
        title={t('share.makeOwnerTitle', { project: name, name: transferTo?.name ?? '' })}
        description={t('share.makeOwnerText', { name: transferTo?.name ?? '' })}
      >
        <div className="flex justify-end gap-2">
          <Button onClick={() => setTransferTo(null)}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            onClick={async () => {
              if (!transferTo) return
              try {
                await call(
                  project.owner.$post({ param: { projectId }, json: { userId: transferTo.id } }),
                )
                toast.success(t('share.transferred', { name: transferTo.name }))
                setTransferTo(null)
                onClose()
                // Reopen with the new rights.
                location.reload()
              } catch (caught) {
                toast.error(errorMessage(t, caught))
              }
            }}
          >
            {t('share.makeOwner')}
          </Button>
        </div>
      </Dialog>
    </>
  )
}
