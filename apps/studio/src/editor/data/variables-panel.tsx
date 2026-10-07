import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Braces, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { IconButton } from '../../components/ui/button.tsx'
import { api, call } from '../../lib/api.ts'
import { errorMessage } from '../../lib/errors.ts'
import { useDoc, useSession } from '../context.tsx'
import { isServerProject } from './rows.ts'

function show(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/** The shared variables of the project and their values on the server (SPEC § 4.2). */
export function VariablesPanel() {
  const { t } = useTranslation()
  const doc = useDoc()
  const session = useSession()
  const queries = useQueryClient()
  const server = isServerProject(session)
  const key = ['shared-variables', session.id]
  const values = useQuery({
    queryKey: key,
    queryFn: () =>
      call(api.projects[':id'].data.variables.$get({ param: { id: session.id } })).then(
        (body) => body.values as Record<string, unknown>,
      ),
    enabled: server,
    staleTime: 0,
    refetchInterval: 5000,
  })
  const variables = doc.variables.shared
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 p-4 junior:p-6">
      <header className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-ui bg-coral-soft">
          <Braces size={20} />
        </span>
        <h1 className="text-ui-xl font-strong">{t('data.variables')}</h1>
      </header>
      <p className="text-muted">{t('data.variablesPanel.intro')}</p>
      {!server ? (
        <p className="rounded-ui bg-yellow-soft p-3 text-ui-sm">
          {t('data.variablesPanel.needsAccount')}
        </p>
      ) : null}
      <ul className="flex flex-col divide-y divide-border rounded-ui-lg border border-border bg-surface">
        {variables.length ? (
          variables.map((variable) => (
            <li key={variable.id} className="flex items-center gap-3 px-3 py-2">
              <code className="font-mono font-strong">{variable.name}</code>
              <span
                className="min-w-0 flex-1 truncate font-mono text-ui-sm text-muted"
                title={t('data.variablesPanel.value')}
              >
                {server && values.data && variable.id in values.data
                  ? show(values.data[variable.id])
                  : show(variable.initial ?? 0)}
              </span>
              {server && !session.readOnly ? (
                <IconButton
                  size="sm"
                  label={t('data.variablesPanel.reset', { name: variable.name })}
                  onClick={async () => {
                    try {
                      await call(
                        api.projects[':id'].data.variables[':varId'].$delete({
                          param: { id: session.id, varId: variable.id },
                        }),
                      )
                      await queries.invalidateQueries({ queryKey: key })
                      toast.success(t('data.variablesPanel.resetDone'))
                    } catch (error) {
                      toast.error(errorMessage(t, error))
                    }
                  }}
                >
                  <RotateCcw size={14} />
                </IconButton>
              ) : null}
            </li>
          ))
        ) : (
          <li className="px-3 py-4 text-ui-sm text-muted">{t('data.variablesPanel.empty')}</li>
        )}
      </ul>
    </div>
  )
}
