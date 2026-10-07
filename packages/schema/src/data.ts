import { z } from 'zod'

/**
 * Data of a project (SPEC § 4.5): tables and API connections, in `ProjectDoc.data`. Never a
 * secret: a connection only names one (`{{secret:NAME}}`), the relay of the server puts the
 * value in (SPEC § 6.9).
 */

const id = z.string().min(1).max(64)

export const COLUMN_TYPES = ['text', 'number', 'boolean', 'date', 'image', 'link'] as const
export type ColumnType = (typeof COLUMN_TYPES)[number]

/** A cell: text (also dates `YYYY-MM-DD`, images, links), number, yes/no, or empty. */
export const cellSchema = z.union([z.string().max(10_000), z.number(), z.boolean(), z.null()])
export type Cell = z.infer<typeof cellSchema>

export const columnSchema = z.object({
  id,
  name: z.string().min(1).max(64),
  type: z.enum(COLUMN_TYPES),
})
export type Column = z.infer<typeof columnSchema>

/** A row: its id, and its cells by column id (renaming a column keeps them). */
export const rowSchema = z.object({
  id,
  values: z.record(z.string(), cellSchema),
})
export type Row = z.infer<typeof rowSchema>

/**
 * `local`: the rows ship with the app, each device keeps its own changes. `shared`: the rows
 * live on the server, common to everyone who uses the app; `access` says whether the app may
 * change them (`write`) or only read them (`read`).
 */
export const TABLE_MODES = ['local', 'shared'] as const
export type TableMode = (typeof TABLE_MODES)[number]
export const TABLE_ACCESS = ['read', 'write'] as const
export type TableAccess = (typeof TABLE_ACCESS)[number]

export const MAX_COLUMNS = 30
export const MAX_LOCAL_ROWS = 2000

export const tableSchema = z.object({
  name: z.string().min(1).max(64),
  mode: z.enum(TABLE_MODES).default('local'),
  access: z.enum(TABLE_ACCESS).default('write'),
  columns: z.array(columnSchema).max(MAX_COLUMNS).default([]),
  /** Rows of a local table. A shared table keeps its rows on the server: this stays empty. */
  rows: z.array(rowSchema).max(MAX_LOCAL_ROWS).default([]),
})
export type Table = z.infer<typeof tableSchema>

export const pairSchema = z.object({
  id,
  key: z.string().max(200),
  value: z.string().max(2000),
})
export type Pair = z.infer<typeof pairSchema>

export const apiConnectionSchema = z.object({
  name: z.string().min(1).max(64),
  /** `https://api.example.com/v1`: every call stays under it. */
  baseUrl: z.string().max(2000).default(''),
  headers: z.array(pairSchema).max(30).default([]),
  /** Query parameters added to every call. */
  params: z.array(pairSchema).max(30).default([]),
})
export type ApiConnection = z.infer<typeof apiConnectionSchema>

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const
export type HttpMethod = (typeof HTTP_METHODS)[number]

/** A secret's name: what `{{secret:NAME}}` refers to. */
export const SECRET_NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/
const SECRET_REF = /\{\{\s*secret:([A-Za-z][A-Za-z0-9_]{0,63})\s*\}\}/g

/** The secrets a text refers to, in order, without duplicates. */
export function secretRefs(text: string): string[] {
  return [...new Set([...text.matchAll(SECRET_REF)].map((match) => match[1] as string))]
}

/** Replaces each `{{secret:NAME}}` by its value (`''` for an unknown one). */
export function fillSecrets(text: string, values: ReadonlyMap<string, string>): string {
  return text.replace(SECRET_REF, (_, name: string) => values.get(name) ?? '')
}

/** The secrets a connection uses (headers, parameters, address). */
export function connectionSecrets(connection: ApiConnection): string[] {
  return [
    ...new Set([
      ...secretRefs(connection.baseUrl),
      ...connection.headers.flatMap((pair) => [...secretRefs(pair.key), ...secretRefs(pair.value)]),
      ...connection.params.flatMap((pair) => [...secretRefs(pair.key), ...secretRefs(pair.value)]),
    ]),
  ]
}

/**
 * The address of a call: the connection's base, then `path` (which may not leave it), then
 * the parameters of the connection and of the call. Throws a `TypeError` for an invalid one.
 */
export function buildApiUrl(
  connection: Pick<ApiConnection, 'baseUrl' | 'params'>,
  path: string,
  query: Record<string, unknown> = {},
  fill: (text: string) => string = (text) => text,
): URL {
  const base = new URL(fill(connection.baseUrl.trim()))
  if (base.protocol !== 'https:' && base.protocol !== 'http:') throw new TypeError('protocol')
  const extra = path.trim()
  let url = base
  if (extra) {
    if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(extra)) throw new TypeError('path leaves the base')
    const [pathPart = '', queryPart] = extra.split('?', 2)
    // An encoded slash or backslash would leave the base once the API decodes it.
    if (/%(2f|5c)/i.test(pathPart)) throw new TypeError('path leaves the base')
    const joined = `${base.pathname.replace(/\/+$/, '')}/${pathPart.replace(/^\/+/, '')}`
    url = new URL(base)
    url.pathname = joined
    if (queryPart) {
      for (const [key, value] of new URLSearchParams(queryPart)) url.searchParams.append(key, value)
    }
    // `..` segments are resolved by the URL parser: the result must stay under the base.
    const prefix = base.pathname.replace(/\/+$/, '')
    if (url.origin !== base.origin || (prefix && !`${url.pathname}/`.startsWith(`${prefix}/`))) {
      throw new TypeError('path leaves the base')
    }
  } else url = new URL(base)
  for (const pair of connection.params) {
    if (pair.key.trim()) url.searchParams.set(fill(pair.key.trim()), fill(pair.value))
  }
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue
    url.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value))
  }
  return url
}

// Cells

/** A value as a cell of `type`, or `undefined` when it cannot be one. */
export function coerceCell(type: ColumnType, value: unknown): Cell | undefined {
  if (value === null || value === undefined || value === '') return null
  switch (type) {
    case 'number': {
      const n =
        typeof value === 'string' ? Number(value.trim().replace(',', '.')) : Number(value as never)
      return typeof value !== 'boolean' && Number.isFinite(n) ? n : undefined
    }
    case 'boolean': {
      if (typeof value === 'boolean') return value
      const text = String(value).trim().toLowerCase()
      if (['true', 'vrai', 'oui', 'yes', '1', 'x'].includes(text)) return true
      if (['false', 'faux', 'non', 'no', '0'].includes(text)) return false
      return undefined
    }
    case 'date': {
      if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) return undefined
        return value.toISOString().slice(0, 10)
      }
      const text = String(value).trim()
      const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text)
      if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
      const fr = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text)
      if (fr) return `${fr[3]}-${fr[2]?.padStart(2, '0')}-${fr[1]?.padStart(2, '0')}`
      return undefined
    }
    default: {
      if (typeof value === 'string') return value.slice(0, 10_000)
      if (typeof value === 'number' || typeof value === 'boolean') return String(value)
      try {
        return JSON.stringify(value).slice(0, 10_000)
      } catch {
        return undefined
      }
    }
  }
}

/** Plain object of a row, as the generated code sees it: `{ id, Nom: 'Léa', Âge: 9 }`. */
export type RowObject = { id: string } & Record<string, Cell>

export function rowToObject(columns: readonly Column[], row: Row): RowObject {
  const object: RowObject = { id: row.id }
  for (const column of columns) object[column.name] = row.values[column.id] ?? null
  return object
}

/**
 * Cells of a row from an object keyed by column name (or id): unknown keys are left out,
 * values are converted to the column's type (an impossible one becomes empty).
 */
export function objectToValues(
  columns: readonly Column[],
  object: Record<string, unknown>,
): Record<string, Cell> {
  const values: Record<string, Cell> = {}
  for (const column of columns) {
    const key = column.name in object ? column.name : column.id in object ? column.id : undefined
    if (key === undefined) continue
    values[column.id] = coerceCell(column.type, object[key]) ?? null
  }
  return values
}
