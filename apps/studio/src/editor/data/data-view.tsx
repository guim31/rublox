import { addApi, addColumn, addTable } from '@rublox/schema'
import { Braces, Globe, KeyRound, Plus, Table2, Users } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Mascot } from '../../components/brand.tsx'
import { Button, IconButton } from '../../components/ui/button.tsx'
import { cn } from '../../lib/cn.ts'
import { useDoc, useSession } from '../context.tsx'
import { type DataItem, useEditor } from '../store.ts'
import { ApiEditor } from './api-editor.tsx'
import { isServerProject } from './rows.ts'
import { SecretsPanel } from './secrets-panel.tsx'
import { TableEditor } from './table-editor.tsx'
import { VariablesPanel } from './variables-panel.tsx'

/**
 * The Data tab (SPEC § 4.5): tables edited like a spreadsheet, API connections with "Try",
 * the project's secrets and its shared variables.
 */
export function DataTab({ screenId }: { screenId: string }) {
  const { t } = useTranslation()
  const doc = useDoc()
  const session = useSession()
  const item = useEditor((s) => s.dataItem)
  const set = useEditor((s) => s.set)
  const select = (next: DataItem | null) => set({ dataItem: next })
  const tables = Object.entries(doc.data.tables)
  const apis = Object.entries(doc.data.apis)
  const server = isServerProject(session)
  const readOnly = session.readOnly

  // Something deleted (or undone): fall back to the first item, or the introduction.
  const exists =
    !item ||
    (item.kind === 'table'
      ? Boolean(doc.data.tables[item.id])
      : item.kind === 'api'
        ? Boolean(doc.data.apis[item.id])
        : true)
  useEffect(() => {
    if (!exists) set({ dataItem: null })
  }, [exists, set])

  const newTable = () => {
    const id = addTable(session.ydoc, { name: t('data.defaultTable') })
    addColumn(session.ydoc, id, { name: t('data.defaultColumn'), type: 'text' })
    select({ kind: 'table', id })
  }
  const newApi = () => {
    const id = addApi(session.ydoc, { name: t('data.defaultApi'), baseUrl: 'https://' })
    select({ kind: 'api', id })
  }

  const entry = (
    key: string,
    active: boolean,
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
  ) => (
    <li key={key}>
      <button
        type="button"
        aria-current={active ? 'true' : undefined}
        onClick={onClick}
        className={cn(
          'flex h-control-sm w-full items-center gap-2 rounded-ui px-2 text-left text-ui-sm hover:bg-surface-2 junior:h-control junior:text-ui',
          active && 'bg-primary-soft font-strong text-primary-text hover:bg-primary-soft',
        )}
      >
        <span className="shrink-0 text-muted">{icon}</span>
        <span className="truncate">{label}</span>
      </button>
    </li>
  )

  return (
    <div className="flex h-full min-h-0">
      <nav
        aria-label={t('data.sections')}
        className="flex w-64 shrink-0 flex-col gap-4 overflow-y-auto border-r border-border bg-surface p-3"
        data-tour="data:sidebar"
      >
        <Group
          title={t('data.tables')}
          addLabel={t('data.newTable')}
          onAdd={readOnly ? undefined : newTable}
          tour="data:add-table"
        >
          {tables.map(([id, table]) =>
            entry(
              id,
              item?.kind === 'table' && item.id === id,
              table.name,
              table.mode === 'shared' ? <Users size={15} /> : <Table2 size={15} />,
              () => select({ kind: 'table', id }),
            ),
          )}
        </Group>
        <Group
          title={t('data.apis')}
          addLabel={t('data.newApi')}
          onAdd={readOnly ? undefined : newApi}
          tour="data:add-api"
        >
          {apis.map(([id, api]) =>
            entry(id, item?.kind === 'api' && item.id === id, api.name, <Globe size={15} />, () =>
              select({ kind: 'api', id }),
            ),
          )}
        </Group>
        <ul className="flex flex-col gap-0.5 border-t border-border pt-3">
          {entry(
            'secrets',
            item?.kind === 'secrets',
            t('data.secrets'),
            <KeyRound size={15} />,
            () => select({ kind: 'secrets' }),
          )}
          {entry(
            'variables',
            item?.kind === 'variables',
            t('data.variables'),
            <Braces size={15} />,
            () => select({ kind: 'variables' }),
          )}
        </ul>
        {!server ? (
          <p className="mt-auto rounded-ui bg-yellow-soft p-2.5 text-ui-sm">{t('data.guest')}</p>
        ) : null}
      </nav>
      <main className="min-w-0 flex-1 overflow-auto bg-bg">
        {item?.kind === 'table' && doc.data.tables[item.id] ? (
          <TableEditor key={item.id} tableId={item.id} />
        ) : item?.kind === 'api' && doc.data.apis[item.id] ? (
          <ApiEditor key={item.id} apiId={item.id} screenId={screenId} />
        ) : item?.kind === 'secrets' ? (
          <SecretsPanel />
        ) : item?.kind === 'variables' ? (
          <VariablesPanel />
        ) : (
          <Intro onTable={readOnly ? undefined : newTable} onApi={readOnly ? undefined : newApi} />
        )}
      </main>
    </div>
  )
}

function Group({
  title,
  addLabel,
  onAdd,
  tour,
  children,
}: {
  title: string
  addLabel: string
  onAdd?: () => void
  tour: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="text-ui-sm font-strong text-muted uppercase tracking-wide junior:normal-case junior:tracking-normal">
          {title}
        </h2>
        {onAdd ? (
          <span data-tour={tour}>
            <IconButton size="sm" label={addLabel} onClick={onAdd}>
              <Plus size={16} />
            </IconButton>
          </span>
        ) : null}
      </div>
      <ul className="flex flex-col gap-0.5">{children}</ul>
    </section>
  )
}

function Intro({ onTable, onApi }: { onTable?: () => void; onApi?: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-16 text-center">
      <Mascot size={96} mood="think" />
      <h1 className="text-ui-xl font-strong">{t('data.intro.title')}</h1>
      <p className="text-muted">{t('data.intro.text')}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {onTable ? (
          <Button variant="primary" icon={<Table2 size={16} />} onClick={onTable}>
            {t('data.intro.table')}
          </Button>
        ) : null}
        {onApi ? (
          <Button icon={<Globe size={16} />} onClick={onApi}>
            {t('data.intro.api')}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
