import type { Binding } from '@rublox/catalog'
import type { BoundRow, RendererProps } from './types.ts'

/** An item drawn from a row: each bound field holds the cell of its column, as text. */
export type BoundItem = { fields: Record<string, string>; row: BoundRow }

function cellText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return typeof value === 'string' ? value : String(value)
}

/** The binding of a component (`source`), when it names a table. */
export function bindingOf(p: RendererProps): Binding | null {
  const value = p.props.source as Binding | null | undefined
  return value && typeof value === 'object' && typeof value.table === 'string' && value.table
    ? value
    : null
}

/**
 * The items of a component bound to a table (J5, SPEC § 4.5), or `null` when it is not bound
 * (it then shows its own items). A field without a column stays empty.
 */
export function boundItems(p: RendererProps, fields: readonly string[]): BoundItem[] | null {
  const binding = bindingOf(p)
  if (!binding) return null
  const rows = p.tableRows?.(binding.table) ?? []
  return rows.map((entry) => {
    const values: Record<string, string> = {}
    for (const field of fields) {
      const column = binding.fields[field]
      values[field] = column ? cellText(entry.row.values[column]) : ''
    }
    return { fields: values, row: entry }
  })
}
