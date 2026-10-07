import { SECRET_NAME } from '@rublox/schema'
import { useQueryClient } from '@tanstack/react-query'
import { KeyRound, Pencil, Trash2 } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDialog } from '../../components/dialogs.tsx'
import { Button, IconButton } from '../../components/ui/button.tsx'
import { Dialog } from '../../components/ui/dialog.tsx'
import { Input } from '../../components/ui/input.tsx'
import { api, call } from '../../lib/api.ts'
import { errorMessage } from '../../lib/errors.ts'
import { usePrefs } from '../../lib/prefs.ts'
import { relativeTime } from '../../lib/time.ts'
import { useSession } from '../context.tsx'
import { secretsKey, useSecretNames } from './api-editor.tsx'
import { isServerProject } from './rows.ts'

/**
 * The project's secrets (SPEC § 4.5, § 6.8): written once, kept encrypted by the server, never
 * read back. The studio only ever sees their names.
 */
export function SecretsPanel() {
  const { t } = useTranslation()
  const session = useSession()
  const locale = usePrefs((s) => s.locale)
  const queries = useQueryClient()
  const secrets = useSecretNames(session)
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [replacing, setReplacing] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const nameId = useId()
  const valueId = useId()
  const server = isServerProject(session)
  const canWrite = !session.readOnly
  const validName = SECRET_NAME.test(name)

  const save = async (secret: string, secretValue: string) => {
    setBusy(true)
    try {
      await call(
        api.projects[':id'].secrets[':name'].$put({
          param: { id: session.id, name: secret },
          json: { value: secretValue },
        }),
      )
      await queries.invalidateQueries({ queryKey: secretsKey(session.id) })
      toast.success(t('data.secretsPanel.saved'))
      return true
    } catch (error) {
      toast.error(errorMessage(t, error))
      return false
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 p-4 junior:p-6">
      <header className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-ui bg-yellow-soft">
          <KeyRound size={20} />
        </span>
        <h1 className="text-ui-xl font-strong">{t('data.secrets')}</h1>
      </header>
      <p className="text-muted">{t('data.secretsPanel.intro')}</p>
      {!server ? (
        <p className="rounded-ui bg-yellow-soft p-3 text-ui-sm">
          {t('data.secretsPanel.needsAccount')}
        </p>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-border rounded-ui-lg border border-border bg-surface">
            {secrets.data?.length ? (
              secrets.data.map((secret) => (
                <li key={secret.name} className="flex items-center gap-3 px-3 py-2">
                  <code className="font-mono font-strong">{secret.name}</code>
                  <span className="text-ui-sm text-muted">••••••••</span>
                  <span className="ml-auto text-ui-sm text-muted">
                    {secret.updatedAt
                      ? t('data.secretsPanel.updated', {
                          when: relativeTime(secret.updatedAt, t, locale),
                        })
                      : null}
                  </span>
                  {canWrite ? (
                    <>
                      <IconButton
                        size="sm"
                        label={t('data.secretsPanel.replace', { name: secret.name })}
                        onClick={() => {
                          setValue('')
                          setReplacing(secret.name)
                        }}
                      >
                        <Pencil size={14} />
                      </IconButton>
                      <IconButton
                        size="sm"
                        label={t('data.secretsPanel.delete', { name: secret.name })}
                        onClick={() => setRemoving(secret.name)}
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </>
                  ) : null}
                </li>
              ))
            ) : (
              <li className="px-3 py-4 text-ui-sm text-muted">
                {secrets.isPending ? t('common.loading') : t('data.secretsPanel.empty')}
              </li>
            )}
          </ul>
          {canWrite ? (
            <form
              className="flex flex-col gap-3 rounded-ui-lg border border-border bg-surface p-4"
              onSubmit={async (event) => {
                event.preventDefault()
                if (!validName || !value) return
                if (await save(name, value)) {
                  setName('')
                  setValue('')
                }
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label htmlFor={nameId} className="text-ui-sm font-strong">
                    {t('data.secretsPanel.name')}
                  </label>
                  <Input
                    id={nameId}
                    value={name}
                    className="font-mono"
                    autoComplete="off"
                    placeholder="METEO_KEY"
                    aria-invalid={name !== '' && !validName}
                    aria-describedby={`${nameId}-hint`}
                    onChange={(event) => setName(event.target.value)}
                  />
                  <p id={`${nameId}-hint`} className="text-[11px] text-muted">
                    {t('data.secretsPanel.nameHint')}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor={valueId} className="text-ui-sm font-strong">
                    {t('data.secretsPanel.value')}
                  </label>
                  <Input
                    id={valueId}
                    type="password"
                    autoComplete="new-password"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                  />
                </div>
              </div>
              <div>
                <Button type="submit" variant="primary" disabled={busy || !validName || !value}>
                  {t('data.secretsPanel.add')}
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-ui-sm text-muted">{t('data.secretsPanel.readOnly')}</p>
          )}
        </>
      )}
      <Dialog
        open={replacing !== null}
        onOpenChange={(open) => !open && setReplacing(null)}
        title={t('data.secretsPanel.replace', { name: replacing ?? '' })}
      >
        <form
          className="flex flex-col gap-3"
          onSubmit={async (event) => {
            event.preventDefault()
            if (replacing && value && (await save(replacing, value))) setReplacing(null)
          }}
        >
          <Input
            type="password"
            autoComplete="new-password"
            aria-label={t('data.secretsPanel.value')}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button onClick={() => setReplacing(null)}>{t('common.cancel')}</Button>
            <Button type="submit" variant="primary" disabled={busy || !value}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Dialog>
      <ConfirmDialog
        open={removing !== null}
        title={t('data.secretsPanel.delete', { name: removing ?? '' })}
        text={t('data.secretsPanel.deleteConfirm', { name: removing ?? '' })}
        action={t('common.delete')}
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return
          await call(
            api.projects[':id'].secrets[':name'].$delete({
              param: { id: session.id, name: removing },
            }),
          )
          await queries.invalidateQueries({ queryKey: secretsKey(session.id) })
          toast.success(t('data.secretsPanel.deleted'))
        }}
      />
    </div>
  )
}
