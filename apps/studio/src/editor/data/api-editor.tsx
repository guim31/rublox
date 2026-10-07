import { DATA_BLOCK_TYPES } from '@rublox/blocks/data-types'
import {
  type BlocklyJson,
  HTTP_METHODS,
  type HttpMethod,
  newId,
  type Pair,
  ProjectOpError,
  RELAY_ERRORS,
  type RelayError,
  type RelayResponse,
  removeApi,
  secretRefs,
  setBlockStack,
  updateApi,
} from '@rublox/schema'
import { useQuery } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { KeyRound, Play, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDialog } from '../../components/dialogs.tsx'
import { Button, IconButton } from '../../components/ui/button.tsx'
import { Badge } from '../../components/ui/field.tsx'
import { Input, Select } from '../../components/ui/input.tsx'
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from '../../components/ui/menu.tsx'
import { ApiError, api, call } from '../../lib/api.ts'
import { errorMessage } from '../../lib/errors.ts'
import { useDoc, useSession } from '../context.tsx'
import { useEditorNavigate } from '../nav.ts'
import type { ProjectSession } from '../session.ts'
import { useEditor } from '../store.ts'
import { JsonTree } from './json-tree.tsx'
import { isServerProject } from './rows.ts'

export const secretsKey = (projectId: string) => ['secrets', projectId] as const

/** The names of the project's secrets (never their values). */
export function useSecretNames(session: ProjectSession) {
  return useQuery({
    queryKey: secretsKey(session.id),
    queryFn: () =>
      call(api.projects[':id'].secrets.$get({ param: { id: session.id } })).then(
        (body) => body.secrets,
      ),
    enabled: isServerProject(session),
  })
}

/**
 * Adds, to a screen's blocks, the block that reads `path` in the answer of a connection:
 * "‹path› of (answer of ‹api› ‹method› path ‹call path›)". Returns its id.
 */
export function createReadBlock(
  session: ProjectSession,
  workspace: string,
  apiId: string,
  method: HttpMethod,
  callPath: string,
  path: string,
): string {
  const stacks = (session.getDoc().blocks[workspace] ?? {}) as Record<
    string,
    BlocklyJson & { y?: number }
  >
  const bottom = Object.values(stacks).reduce(
    (max, stack) => Math.max(max, Number(stack.y) || 0),
    0,
  )
  const id = newId()
  const request: BlocklyJson = {
    type: DATA_BLOCK_TYPES.apiRequest,
    fields: { API: apiId, METHOD: method },
    inputs: { PATH: { shadow: { type: 'text', fields: { TEXT: callPath } } } },
  }
  const json: BlocklyJson = path
    ? {
        type: DATA_BLOCK_TYPES.objectGet,
        id,
        x: 40,
        y: Object.keys(stacks).length ? bottom + 160 : 40,
        fields: { PATH: path },
        inputs: { OBJECT: { block: request } },
      }
    : { ...request, id, x: 40, y: Object.keys(stacks).length ? bottom + 160 : 40 }
  setBlockStack(session.ydoc, workspace, id, json)
  return id
}

/** An API connection of the Data tab (SPEC § 4.5): address, headers, parameters, "Try". */
export function ApiEditor({ apiId, screenId }: { apiId: string; screenId: string }) {
  const { t } = useTranslation()
  const doc = useDoc()
  const session = useSession()
  const connection = doc.data.apis[apiId]
  const readOnly = session.readOnly
  const [confirm, setConfirm] = useState(false)
  const nameId = useId()
  const urlId = useId()
  const [name, setName] = useState(connection?.name ?? '')
  const [baseUrl, setBaseUrl] = useState(connection?.baseUrl ?? '')
  const [nameError, setNameError] = useState(false)
  useEffect(() => setName(connection?.name ?? ''), [connection?.name])
  useEffect(() => setBaseUrl(connection?.baseUrl ?? ''), [connection?.baseUrl])
  const secrets = useSecretNames(session)
  if (!connection) return null

  const patch = (next: Parameters<typeof updateApi>[2]) => {
    if (!readOnly) updateApi(session.ydoc, apiId, next)
  }
  const known = new Set((secrets.data ?? []).map((secret) => secret.name))
  const used = [
    ...secretRefs(connection.baseUrl),
    ...connection.headers.flatMap((pair) => secretRefs(pair.value)),
    ...connection.params.flatMap((pair) => secretRefs(pair.value)),
  ]
  const missing =
    isServerProject(session) && secrets.isSuccess ? used.filter((n) => !known.has(n)) : []

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 p-4 junior:p-6">
      <header className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-56 flex-1 flex-col gap-1">
          <label htmlFor={nameId} className="text-ui-sm font-strong">
            {t('data.api.name')}
          </label>
          <Input
            id={nameId}
            value={name}
            disabled={readOnly}
            maxLength={64}
            aria-invalid={nameError}
            className="text-ui-lg font-strong"
            onChange={(event) => setName(event.target.value)}
            onBlur={() => {
              const next = name.trim()
              if (!next || next === connection.name) return setName(connection.name)
              try {
                patch({ name: next })
                setNameError(false)
              } catch (error) {
                if (!(error instanceof ProjectOpError)) throw error
                setNameError(true)
              }
            }}
            onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
          />
          {nameError ? <p className="text-[11px] text-danger">{t('data.api.nameTaken')}</p> : null}
        </div>
        {!readOnly ? (
          <Button variant="ghost" icon={<Trash2 size={15} />} onClick={() => setConfirm(true)}>
            {t('data.api.delete')}
          </Button>
        ) : null}
      </header>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={urlId} className="text-ui-sm font-strong">
          {t('data.api.baseUrl')}
        </label>
        <Input
          id={urlId}
          type="url"
          value={baseUrl}
          disabled={readOnly}
          placeholder="https://api.example.com"
          aria-describedby={`${urlId}-hint`}
          data-tour="data:base-url"
          className="font-mono"
          onChange={(event) => setBaseUrl(event.target.value)}
          onBlur={() => baseUrl !== connection.baseUrl && patch({ baseUrl: baseUrl.trim() })}
        />
        <p id={`${urlId}-hint`} className="text-ui-sm text-muted">
          {t('data.api.baseUrlHint')}
        </p>
      </div>

      <Pairs
        title={t('data.api.params')}
        addLabel={t('data.api.addParam')}
        pairs={connection.params}
        disabled={readOnly}
        secrets={[...known]}
        onChange={(params) => patch({ params })}
        tour="data:params"
      />
      <Pairs
        title={t('data.api.headers')}
        addLabel={t('data.api.addHeader')}
        pairs={connection.headers}
        disabled={readOnly}
        secrets={[...known]}
        onChange={(headers) => patch({ headers })}
        tour="data:headers"
      />
      <p className="flex items-start gap-2 rounded-ui bg-surface-2 p-2.5 text-ui-sm text-muted">
        <KeyRound size={15} className="mt-0.5 shrink-0" />
        <span>
          {t('data.api.secretHint', {
            example: '{{secret:NOM}}',
            interpolation: { escapeValue: false },
          })}
        </span>
      </p>
      {missing.map((secret) => (
        <p key={secret} role="alert" className="text-ui-sm text-danger">
          {t('data.api.missingSecret', { name: secret })}
        </p>
      ))}

      <TryPanel apiId={apiId} screenId={screenId} />

      <ConfirmDialog
        open={confirm}
        title={t('data.api.delete')}
        text={t('data.api.deleteConfirm', { name: connection.name })}
        action={t('data.api.delete')}
        onClose={() => setConfirm(false)}
        onConfirm={async () => removeApi(session.ydoc, apiId)}
      />
    </div>
  )
}

function Pairs({
  title,
  addLabel,
  pairs,
  disabled,
  secrets,
  onChange,
  tour,
}: {
  title: string
  addLabel: string
  pairs: Pair[]
  disabled: boolean
  secrets: string[]
  onChange: (pairs: Pair[]) => void
  tour: string
}) {
  const { t } = useTranslation()
  const set = (index: number, patch: Partial<Pair>) =>
    onChange(pairs.map((pair, i) => (i === index ? { ...pair, ...patch } : pair)))
  return (
    <section className="flex flex-col gap-2" data-tour={tour}>
      <h2 className="text-ui-sm font-strong">{title}</h2>
      {pairs.map((pair, index) => (
        <div key={pair.id} className="flex items-center gap-2">
          <DraftInput
            label={`${title} ${index + 1} — ${t('data.api.key')}`}
            placeholder={t('data.api.key')}
            value={pair.key}
            disabled={disabled}
            className="w-48 font-mono"
            onCommit={(key) => set(index, { key })}
          />
          <DraftInput
            label={`${title} ${index + 1} — ${t('data.api.value')}`}
            placeholder={t('data.api.value')}
            value={pair.value}
            disabled={disabled}
            className="flex-1 font-mono"
            onCommit={(value) => set(index, { value })}
          />
          {!disabled && secrets.length ? (
            <Menu>
              <MenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t('data.api.insertSecret')}
                  title={t('data.api.insertSecret')}
                  className="grid size-control-sm place-items-center rounded-ui text-muted hover:bg-surface-2 hover:text-text"
                >
                  <KeyRound size={15} />
                </button>
              </MenuTrigger>
              <MenuContent>
                <MenuLabel>{t('data.api.insertSecret')}</MenuLabel>
                {secrets.map((secret) => (
                  <MenuItem
                    key={secret}
                    onSelect={() => set(index, { value: `${pair.value}{{secret:${secret}}}` })}
                  >
                    {secret}
                  </MenuItem>
                ))}
              </MenuContent>
            </Menu>
          ) : null}
          {!disabled ? (
            <IconButton
              size="sm"
              label={t('data.api.remove')}
              onClick={() => onChange(pairs.filter((_, i) => i !== index))}
            >
              <X size={15} />
            </IconButton>
          ) : null}
        </div>
      ))}
      {!disabled ? (
        <div>
          <Button
            size="sm"
            variant="ghost"
            icon={<Plus size={14} />}
            onClick={() => onChange([...pairs, { id: newId(), key: '', value: '' }])}
          >
            {addLabel}
          </Button>
        </div>
      ) : null}
    </section>
  )
}

function DraftInput({
  label,
  value,
  onCommit,
  ...rest
}: {
  label: string
  value: string
  placeholder?: string
  disabled?: boolean
  className?: string
  onCommit: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  return (
    <Input
      aria-label={label}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
      {...rest}
    />
  )
}

/** "Try": calls the connection through the server, shows the answer as a tree. */
function TryPanel({ apiId, screenId }: { apiId: string; screenId: string }) {
  const { t } = useTranslation()
  const session = useSession()
  const doc = useDoc()
  const { projectId } = useParams({ strict: false }) as { projectId?: string }
  const go = useEditorNavigate(projectId ?? session.id)
  const [method, setMethod] = useState<HttpMethod>('GET')
  const [path, setPath] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<RelayResponse | null>(null)
  const [error, setError] = useState('')
  const pathId = useId()
  const methodId = useId()
  const server = isServerProject(session)

  const tryIt = async () => {
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const body = await call(
        api.projects[':id'].data.try.$post({
          param: { id: session.id },
          json: { api: apiId, method, path },
        }),
      )
      if ('response' in body) setResult(body.response as RelayResponse)
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : ''
      setError(
        (RELAY_ERRORS as readonly string[]).includes(code)
          ? t(`data.api.errors.${code as RelayError}`)
          : errorMessage(t, caught),
      )
    } finally {
      setBusy(false)
    }
  }

  const screenName = doc.screens[screenId]?.name ?? ''
  const pick = (fieldPath: string) => {
    const id = createReadBlock(session, screenId, apiId, method, path, fieldPath)
    toast.success(t('data.api.blockCreated', { screen: screenName }), {
      action: {
        label: t('data.api.seeBlock'),
        onClick: () => {
          useEditor.getState().set({ focusBlock: id })
          void go({ tab: 'blocks', screen: screenId })
        },
      },
    })
  }

  return (
    <section
      className="flex flex-col gap-3 rounded-ui-lg border border-border bg-surface p-4 shadow-1"
      aria-label={t('data.api.tryTitle')}
    >
      <h2 className="font-strong">{t('data.api.tryTitle')}</h2>
      {!server ? (
        <p className="text-ui-sm text-muted">{t('data.api.tryNeedsAccount')}</p>
      ) : session.readOnly ? (
        <p className="text-ui-sm text-muted">{t('data.api.tryNeedsWrite')}</p>
      ) : (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void tryIt()
          }}
        >
          <div className="flex flex-col gap-1">
            <label htmlFor={methodId} className="text-ui-sm text-muted">
              {t('data.api.method')}
            </label>
            <Select
              id={methodId}
              value={method}
              className="w-28"
              onChange={(event) => setMethod(event.target.value as HttpMethod)}
            >
              {HTTP_METHODS.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </Select>
          </div>
          <div className="flex min-w-48 flex-1 flex-col gap-1">
            <label htmlFor={pathId} className="text-ui-sm text-muted">
              {t('data.api.path')}
            </label>
            <Input
              id={pathId}
              value={path}
              className="font-mono"
              placeholder={t('data.api.pathPlaceholder')}
              onChange={(event) => setPath(event.target.value)}
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            icon={<Play size={15} />}
            disabled={busy}
            data-tour="data:try"
          >
            {busy ? t('data.api.trying') : t('data.api.try')}
          </Button>
        </form>
      )}
      {error ? (
        <p role="alert" className="rounded-ui bg-coral-soft p-2.5 text-ui-sm">
          {error}
        </p>
      ) : null}
      {result ? (
        <div className="flex flex-col gap-2" data-tour="data:response">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={result.status < 400 ? 'success' : 'danger'}>
              {t('data.api.status', { status: result.status })}
            </Badge>
            {result.body && typeof result.body === 'object' ? (
              <span className="text-ui-sm text-muted">{t('data.api.clickField')}</span>
            ) : (
              <span className="text-ui-sm text-muted">{t('data.api.noFields')}</span>
            )}
          </div>
          <div className="max-h-[28rem] overflow-auto rounded-ui border border-border bg-bg p-2 font-mono text-[12px]">
            <JsonTree value={result.body} onPick={pick} />
          </div>
        </div>
      ) : null}
    </section>
  )
}
