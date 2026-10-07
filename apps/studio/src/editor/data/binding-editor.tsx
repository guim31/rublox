import type { Binding } from '@rublox/catalog'
import type { Column, Table } from '@rublox/schema'
import { useParams } from '@tanstack/react-router'
import { Table2 } from 'lucide-react'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/button.tsx'
import { Select } from '../../components/ui/input.tsx'
import { useDoc } from '../context.tsx'
import type { EditorProps } from '../design/editors.tsx'
import { useEditorNavigate } from '../nav.ts'

/** The column that best fits a field, when a table is chosen (by name, then by type). */
export function guessColumn(field: string, kind: string, columns: Column[]): string | undefined {
  const names: Record<string, RegExp> = {
    latitude: /^lat/i,
    longitude: /^(lon|lng)/i,
    image: /image|photo|img|avatar/i,
    title: /nom|name|titre|title/i,
    subtitle: /desc|sous|sub|ville|city|tel|phone|mail/i,
    label: /nom|name|label|étiquette|jour|day|mois|month/i,
    value: /valeur|value|total|score|nombre|count/i,
  }
  const byName = columns.find((column) => names[field]?.test(column.name))
  if (byName) return byName.id
  const types: Record<string, Column['type'][]> = {
    image: ['image'],
    value: ['number'],
    latitude: ['number'],
    longitude: ['number'],
  }
  const wanted = types[field] ?? (kind === 'asset' ? ['image'] : ['text'])
  return columns.find((column) => wanted.includes(column.type))?.id
}

/** The bindings a table gives by default: each field its best column, without repeats. */
export function defaultBinding(
  tableId: string,
  table: Table,
  fields: Record<string, string>,
): Binding {
  const chosen: Record<string, string> = {}
  const used = new Set<string>()
  for (const [field, kind] of Object.entries(fields)) {
    const free = table.columns.filter((column) => !used.has(column.id))
    const column = guessColumn(field, kind, free)
    if (column) {
      chosen[field] = column
      used.add(column)
    }
  }
  return { table: tableId, fields: chosen }
}

/**
 * The `source` of a data list, a grid, a map or a chart (SPEC § 4.5): a table of the Data
 * tab, and the column shown in each field.
 */
export function BindingEditor({ id, def, value, onChange }: EditorProps<Binding | null>) {
  const { t } = useTranslation()
  const doc = useDoc()
  const { projectId } = useParams({ strict: false }) as { projectId?: string }
  const go = useEditorNavigate(projectId ?? '')
  const tables = Object.entries(doc.data.tables)
  const fields = def.bindingFields ?? {}
  const table = value?.table ? doc.data.tables[value.table] : undefined

  if (!tables.length) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-ui bg-surface-2 p-2.5 text-ui-sm text-muted">
        <p>{t('data.binding.noTables')}</p>
        {projectId ? (
          <Button size="sm" icon={<Table2 size={14} />} onClick={() => go({ tab: 'data' })}>
            {t('data.binding.openData')}
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <Select
        id={id}
        value={value?.table ?? ''}
        onChange={(event) => {
          const tableId = event.target.value
          const chosen = doc.data.tables[tableId]
          onChange(tableId && chosen ? defaultBinding(tableId, chosen, fields) : null)
        }}
      >
        <option value="">{t('data.binding.none')}</option>
        {tables.map(([tableId, entry]) => (
          <option key={tableId} value={tableId}>
            {entry.name}
          </option>
        ))}
      </Select>
      {value && table ? (
        <div className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1.5 rounded-ui bg-surface-2 p-2">
          {Object.keys(fields).map((field) => {
            const fieldId = `${id}-${field}`
            return (
              <Fragment key={field}>
                <label htmlFor={fieldId} className="text-ui-sm text-muted">
                  {t(`data.binding.fields.${field}`, { defaultValue: field })}
                </label>
                <Select
                  id={fieldId}
                  className="h-control-sm"
                  value={value.fields[field] ?? ''}
                  onChange={(event) => {
                    const next = { ...value.fields }
                    if (event.target.value) next[field] = event.target.value
                    else delete next[field]
                    onChange({ table: value.table, fields: next })
                  }}
                >
                  <option value="">{t('data.binding.noColumn')}</option>
                  {table.columns.map((column) => (
                    <option key={column.id} value={column.id}>
                      {column.name}
                    </option>
                  ))}
                </Select>
              </Fragment>
            )
          })}
          <p className="col-span-2 text-[11px] text-muted">{t('data.binding.bound')}</p>
        </div>
      ) : null}
    </div>
  )
}
