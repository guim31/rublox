import {
  addColumn,
  addRows,
  type Cell,
  COLUMN_TYPES,
  type Column,
  type ColumnType,
  coerceCell,
  importTable,
  moveColumn,
  ProjectOpError,
  parseCsv,
  type Row,
  removeColumn,
  removeRows,
  removeTable,
  toCsv,
  updateColumn,
  updateRow,
  updateTable,
} from '@rublox/schema'
import { useMutation } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Download,
  MoreHorizontal,
  Plus,
  Trash2,
  Upload,
  Users,
} from 'lucide-react'
import { Popover } from 'radix-ui'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDialog } from '../../components/dialogs.tsx'
import { Button, IconButton } from '../../components/ui/button.tsx'
import { Dialog } from '../../components/ui/dialog.tsx'
import { Badge } from '../../components/ui/field.tsx'
import { Input, Select } from '../../components/ui/input.tsx'
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from '../../components/ui/menu.tsx'
import { Segmented } from '../../components/ui/segmented.tsx'
import { Tooltip } from '../../components/ui/tooltip.tsx'
import { api, call } from '../../lib/api.ts'
import { errorMessage } from '../../lib/errors.ts'
import { useAssetUrl, useDoc, useSession } from '../context.tsx'
import { isServerProject, setSharedRows, useSharedRows } from './rows.ts'

type Edits = {
  add(values: Record<string, Cell>): Promise<void>
  update(rowId: string, values: Record<string, Cell>): Promise<void>
  remove(rowId: string): Promise<void>
  replace(rows: Record<string, Cell>[]): Promise<void>
}

/** A table of the Data tab, edited like a spreadsheet (SPEC § 4.5). */
export function TableEditor({ tableId }: { tableId: string }) {
  const { t } = useTranslation()
  const doc = useDoc()
  const session = useSession()
  const table = doc.data.tables[tableId]
  const shared = table?.mode === 'shared'
  const server = isServerProject(session)
  const readOnly = session.readOnly
  const sharedRows = useSharedRows(tableId, shared)
  const [confirm, setConfirm] = useState(false)
  const [importing, setImporting] = useState<{ name: string; rows: string[][] } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const projectId = session.id
  const rowsApi = api.projects[':id'].data.tables[':tableId'].rows
  const edits: Edits = shared
    ? {
        add: async (values) => {
          const { row } = await call(
            rowsApi.$post({ param: { id: projectId, tableId }, json: { values } }),
          )
          setSharedRows(projectId, tableId, (rows) => [...rows, row as Row])
        },
        update: async (rowId, values) => {
          setSharedRows(projectId, tableId, (rows) =>
            rows.map((row) =>
              row.id === rowId ? { ...row, values: { ...row.values, ...values } } : row,
            ),
          )
          await call(
            rowsApi[':rowId'].$patch({
              param: { id: projectId, tableId, rowId },
              json: { values },
            }),
          )
        },
        remove: async (rowId) => {
          setSharedRows(projectId, tableId, (rows) => rows.filter((row) => row.id !== rowId))
          await call(rowsApi[':rowId'].$delete({ param: { id: projectId, tableId, rowId } }))
        },
        replace: async (rows) => {
          const body = await call(
            rowsApi.$put({ param: { id: projectId, tableId }, json: { rows } }),
          )
          setSharedRows(projectId, tableId, () => body.rows as Row[])
        },
      }
    : {
        add: async (values) => {
          addRows(session.ydoc, tableId, [values])
        },
        update: async (rowId, values) => updateRow(session.ydoc, tableId, rowId, values),
        remove: async (rowId) => removeRows(session.ydoc, tableId, [rowId]),
        replace: async () => {},
      }
  const run = useMutation({
    mutationFn: (action: () => Promise<void>) => action(),
    onError: (error) => toast.error(errorMessage(t, error)),
  })

  if (!table) return null
  const rows: Row[] = shared ? (sharedRows.data ?? []) : table.rows
  const columns = table.columns

  const exportCsv = () => {
    const lines = [
      columns.map((column) => column.name),
      ...rows.map((row) => columns.map((column) => row.values[column.id] ?? '')),
    ]
    const blob = new Blob([`﻿${toCsv(lines)}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${table.name}.csv`
    document.body.append(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const readFile = async (file: File | undefined) => {
    if (!file) return
    const parsed = parseCsv(await file.text())
    if (parsed.length < 2) {
      toast.error(t('data.table.importEmpty'))
      return
    }
    setImporting({ name: file.name, rows: parsed })
  }

  const doImport = async (mode: 'replace' | 'append') => {
    if (!importing) return
    const [header = [], ...lines] = importing.rows
    // Columns are created in the project in both cases; a local table also takes the rows.
    importTable(session.ydoc, tableId, header, shared ? [] : lines, mode)
    if (shared) {
      const after = session.getDoc().data.tables[tableId]
      const byIndex = header.map((name) => after?.columns.find((c) => c.name === name.trim()))
      const values = lines.map((cells) => {
        const record: Record<string, Cell> = {}
        byIndex.forEach((column, index) => {
          if (column) record[column.id] = coerceCell(column.type, cells[index] ?? '') ?? null
        })
        return record
      })
      const kept = mode === 'append' ? rows.map((row) => row.values) : []
      await edits.replace([...kept, ...values])
    }
    toast.success(t('data.table.imported', { count: lines.length }))
    setImporting(null)
  }

  return (
    <div className="flex min-h-full flex-col gap-4 p-4 junior:p-6">
      <header className="flex flex-wrap items-end gap-3">
        <TableName tableId={tableId} name={table.name} disabled={readOnly} />
        <div className="flex flex-col gap-1">
          <span className="text-ui-sm font-strong">{t('data.table.mode')}</span>
          <Tooltip
            content={
              !server
                ? t('data.table.sharedNeedsAccount')
                : shared
                  ? t('data.table.sharedHint')
                  : t('data.table.localHint')
            }
          >
            <span data-tour="data:mode">
              <Segmented
                label={t('data.table.mode')}
                value={table.mode}
                onChange={(mode) => {
                  if (mode === 'shared' && !server) {
                    toast.error(t('data.table.sharedNeedsAccount'))
                    return
                  }
                  if (!readOnly) updateTable(session.ydoc, tableId, { mode })
                }}
                options={[
                  { value: 'local', label: t('data.table.local') },
                  { value: 'shared', label: t('data.table.shared'), icon: <Users size={14} /> },
                ]}
              />
            </span>
          </Tooltip>
        </div>
        {shared ? (
          <div className="flex flex-col gap-1">
            <span className="text-ui-sm font-strong">{t('data.table.access')}</span>
            <Segmented
              label={t('data.table.access')}
              value={table.access}
              onChange={(access) => !readOnly && updateTable(session.ydoc, tableId, { access })}
              options={[
                { value: 'read', label: t('data.table.read') },
                { value: 'write', label: t('data.table.write') },
              ]}
            />
          </div>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <Badge>{t('data.table.rows', { count: rows.length })}</Badge>
          <Menu>
            <MenuTrigger asChild>
              <Button icon={<MoreHorizontal size={16} />} aria-label={t('common.more')}>
                <ChevronDown size={14} />
              </Button>
            </MenuTrigger>
            <MenuContent align="end">
              <MenuItem
                icon={<Upload size={15} />}
                disabled={readOnly}
                onSelect={() => fileInput.current?.click()}
              >
                {t('data.table.import')}
              </MenuItem>
              <MenuItem icon={<Download size={15} />} onSelect={exportCsv}>
                {t('data.table.export')}
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                icon={<Trash2 size={15} />}
                danger
                disabled={readOnly}
                onSelect={() => setConfirm(true)}
              >
                {t('data.table.delete')}
              </MenuItem>
            </MenuContent>
          </Menu>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              void readFile(event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </div>
      </header>

      {shared ? (
        <p className="rounded-ui bg-primary-soft px-3 py-2 text-ui-sm text-primary-text">
          {readOnly ? t('data.table.sharedReadOnlyProject') : t('data.table.sharedLive')}
        </p>
      ) : null}

      {columns.length === 0 ? (
        <div className="flex flex-col items-start gap-2 rounded-ui-lg border border-dashed border-border p-6">
          <p className="text-muted">{t('data.table.noColumns')}</p>
          {!readOnly ? (
            <Button
              icon={<Plus size={16} />}
              onClick={() =>
                addColumn(session.ydoc, tableId, { name: t('data.defaultColumn'), type: 'text' })
              }
            >
              {t('data.table.addColumnLong')}
            </Button>
          ) : null}
        </div>
      ) : (
        <div
          className="overflow-auto rounded-ui-lg border border-border bg-surface shadow-1"
          data-tour="data:grid"
        >
          <table className="min-w-full border-collapse text-ui-sm" aria-label={table.name}>
            <thead className="sticky top-0 z-10 bg-surface-2">
              <tr>
                <th
                  scope="col"
                  className="w-12 border-b border-border px-2 py-1.5 text-right text-muted"
                >
                  #
                </th>
                {columns.map((column, index) => (
                  <th
                    key={column.id}
                    scope="col"
                    className="min-w-36 border-b border-l border-border px-1 py-1 text-left font-strong"
                  >
                    <ColumnHeader
                      tableId={tableId}
                      column={column}
                      index={index}
                      count={columns.length}
                      disabled={readOnly}
                    />
                  </th>
                ))}
                <th scope="col" className="w-28 border-b border-l border-border px-1 py-1">
                  {!readOnly ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Plus size={14} />}
                      onClick={() =>
                        addColumn(session.ydoc, tableId, {
                          name: `${t('data.defaultColumn')} ${columns.length + 1}`,
                          type: 'text',
                        })
                      }
                    >
                      {t('data.table.addColumn')}
                    </Button>
                  ) : null}
                </th>
              </tr>
            </thead>
            <tbody>
              {shared && sharedRows.isPending ? (
                <tr>
                  <td colSpan={columns.length + 2} className="p-4 text-muted">
                    {t('data.table.sharedLoading')}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 2} className="p-4 text-muted">
                    {t('data.table.noRows')}
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={row.id} className="group hover:bg-surface-2/60">
                    <th
                      scope="row"
                      className="border-b border-border px-2 text-right font-normal text-muted"
                    >
                      <span className="group-focus-within:hidden group-hover:hidden">
                        {index + 1}
                      </span>
                      {!readOnly ? (
                        <IconButton
                          size="sm"
                          label={t('data.table.deleteRow', { n: index + 1 })}
                          className="hidden group-focus-within:inline-flex group-hover:inline-flex"
                          onClick={() => run.mutate(() => edits.remove(row.id))}
                        >
                          <Trash2 size={14} />
                        </IconButton>
                      ) : null}
                    </th>
                    {columns.map((column) => (
                      <td key={column.id} className="border-b border-l border-border p-0">
                        <CellEditor
                          column={column}
                          value={row.values[column.id] ?? null}
                          label={t('data.table.cell', { column: column.name, row: index + 1 })}
                          disabled={readOnly}
                          onCommit={(value) =>
                            run.mutate(() => edits.update(row.id, { [column.id]: value }))
                          }
                        />
                      </td>
                    ))}
                    <td className="border-b border-l border-border" />
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      {columns.length > 0 && !readOnly ? (
        <div>
          <Button
            icon={<Plus size={16} />}
            data-tour="data:add-row"
            onClick={() => run.mutate(() => edits.add({}))}
          >
            {t('data.table.addRow')}
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirm}
        title={t('data.table.delete')}
        text={t('data.table.deleteConfirm', { name: table.name })}
        action={t('data.table.delete')}
        onClose={() => setConfirm(false)}
        onConfirm={async () => removeTable(session.ydoc, tableId)}
      />
      <Dialog
        open={importing !== null}
        onOpenChange={(open) => !open && setImporting(null)}
        title={t('data.table.importTitle', { file: importing?.name ?? '' })}
        description={t('data.table.importText', {
          rows: Math.max(0, (importing?.rows.length ?? 1) - 1),
          columns: importing?.rows[0]?.length ?? 0,
        })}
      >
        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={() => run.mutate(() => doImport('append'))}>
            {t('data.table.importAppend')}
          </Button>
          <Button variant="primary" onClick={() => run.mutate(() => doImport('replace'))}>
            {t('data.table.importReplace')}
          </Button>
        </div>
      </Dialog>
    </div>
  )
}

function TableName({
  tableId,
  name,
  disabled,
}: {
  tableId: string
  name: string
  disabled: boolean
}) {
  const { t } = useTranslation()
  const session = useSession()
  const [draft, setDraft] = useState(name)
  const [error, setError] = useState(false)
  const id = useId()
  useEffect(() => setDraft(name), [name])
  const commit = () => {
    const next = draft.trim()
    if (!next || next === name) {
      setDraft(name)
      setError(false)
      return
    }
    try {
      updateTable(session.ydoc, tableId, { name: next })
      setError(false)
    } catch (caught) {
      if (!(caught instanceof ProjectOpError)) throw caught
      setError(true)
    }
  }
  return (
    <div className="flex min-w-56 flex-col gap-1">
      <label htmlFor={id} className="text-ui-sm font-strong">
        {t('data.table.name')}
      </label>
      <Input
        id={id}
        value={draft}
        disabled={disabled}
        aria-invalid={error}
        maxLength={64}
        className="text-ui-lg font-strong"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
      />
      {error ? <p className="text-[11px] text-danger">{t('data.table.nameTaken')}</p> : null}
    </div>
  )
}

function ColumnHeader({
  tableId,
  column,
  index,
  count,
  disabled,
}: {
  tableId: string
  column: Column
  index: number
  count: number
  disabled: boolean
}) {
  const { t } = useTranslation()
  const session = useSession()
  const [draft, setDraft] = useState(column.name)
  const [confirm, setConfirm] = useState(false)
  const nameId = useId()
  const typeId = useId()
  useEffect(() => setDraft(column.name), [column.name])
  const rename = () => {
    const next = draft.trim()
    if (!next || next === column.name) return setDraft(column.name)
    try {
      updateColumn(session.ydoc, tableId, column.id, { name: next })
    } catch {
      setDraft(column.name)
      toast.error(t('data.table.nameTaken'))
    }
  }
  const label = (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="truncate">{column.name}</span>
      <span className="shrink-0 rounded bg-surface px-1 text-[10px] font-normal text-muted uppercase">
        {t(`data.table.types.${column.type}`)}
      </span>
    </span>
  )
  if (disabled) return <div className="px-1.5 py-1">{label}</div>
  return (
    <>
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label={t('data.table.columnMenu', { name: column.name })}
            className="flex w-full items-center justify-between gap-1 rounded-ui px-1.5 py-1 text-left hover:bg-surface"
          >
            {label}
            <ChevronDown size={13} className="shrink-0 text-muted" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            sideOffset={4}
            align="start"
            className="z-50 flex w-64 flex-col gap-3 rounded-ui-lg border border-border bg-surface p-3 shadow-2 rx-anim-in"
          >
            <div className="flex flex-col gap-1">
              <label htmlFor={nameId} className="text-ui-sm font-strong">
                {t('data.table.columnName')}
              </label>
              <Input
                id={nameId}
                value={draft}
                maxLength={64}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={rename}
                onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={typeId} className="text-ui-sm font-strong">
                {t('data.table.columnType')}
              </label>
              <Select
                id={typeId}
                value={column.type}
                onChange={(event) =>
                  updateColumn(session.ydoc, tableId, column.id, {
                    type: event.target.value as ColumnType,
                  })
                }
              >
                {COLUMN_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`data.table.types.${type}`)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center gap-1">
              <IconButton
                size="sm"
                label={t('data.table.moveLeft')}
                disabled={index === 0}
                onClick={() => moveColumn(session.ydoc, tableId, column.id, index - 1)}
              >
                <ArrowLeft size={15} />
              </IconButton>
              <IconButton
                size="sm"
                label={t('data.table.moveRight')}
                disabled={index === count - 1}
                onClick={() => moveColumn(session.ydoc, tableId, column.id, index + 1)}
              >
                <ArrowRight size={15} />
              </IconButton>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto text-danger"
                icon={<Trash2 size={14} />}
                onClick={() => setConfirm(true)}
              >
                {t('data.table.deleteColumn')}
              </Button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <ConfirmDialog
        open={confirm}
        title={t('data.table.deleteColumn')}
        text={t('data.table.deleteColumnConfirm', { name: column.name })}
        action={t('data.table.deleteColumn')}
        onClose={() => setConfirm(false)}
        onConfirm={async () => removeColumn(session.ydoc, tableId, column.id)}
      />
    </>
  )
}

const CELL =
  'h-9 w-full min-w-0 bg-transparent px-2 text-ui-sm text-text outline-none focus:bg-surface focus:ring-2 focus:ring-primary focus:ring-inset disabled:opacity-70'

/** One cell, by the column's type; it commits when it loses focus (or with Enter). */
function CellEditor({
  column,
  value,
  label,
  disabled,
  onCommit,
}: {
  column: Column
  value: Cell
  label: string
  disabled: boolean
  onCommit: (value: Cell) => void
}) {
  const { t } = useTranslation()
  const text = value === null || value === undefined ? '' : String(value)
  const [draft, setDraft] = useState(text)
  useEffect(() => setDraft(text), [text])
  const session = useSession()
  const assetUrl = useAssetUrl()

  if (column.type === 'boolean') {
    return (
      <label className="flex h-9 items-center px-2">
        <input
          type="checkbox"
          aria-label={label}
          checked={value === true}
          disabled={disabled}
          className="size-4 accent-[var(--primary)]"
          onChange={(event) => onCommit(event.target.checked)}
        />
      </label>
    )
  }
  const commit = () => {
    if (draft === text) return
    const next = coerceCell(column.type, draft)
    if (next === undefined) setDraft(text)
    else onCommit(next)
  }
  const preview = column.type === 'image' && text ? assetUrl(text) : undefined
  return (
    <div className="flex items-center">
      {preview ? (
        <img src={preview} alt="" className="ml-1 size-7 shrink-0 rounded object-cover" />
      ) : null}
      <input
        aria-label={label}
        className={CELL}
        disabled={disabled}
        type={column.type === 'number' ? 'number' : column.type === 'date' ? 'date' : 'text'}
        inputMode={column.type === 'number' ? 'decimal' : undefined}
        placeholder={
          column.type === 'image'
            ? t('data.table.imagePlaceholder')
            : column.type === 'link'
              ? t('data.table.linkPlaceholder')
              : undefined
        }
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
          if (event.key === 'Escape') {
            setDraft(text)
            event.currentTarget.blur()
          }
        }}
      />
    </div>
  )
}
