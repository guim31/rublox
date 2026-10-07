import { HTTP_METHODS, type HttpMethod, type RowObject } from '@rublox/schema'
import { RxError } from '../errors.ts'
import { compareCells, type DataStore, matches } from './store.ts'

// biome-ignore lint/suspicious/noExplicitAny: generated code passes any value
type Value = any
type Handler = (...args: Value[]) => Promise<void> | void

/** Methods of a table in the generated code: `data.Contacts.rows()`. */
export type TableApi = {
  rows(): RowObject[]
  where(column: string, operator: string, value: Value): RowObject[]
  count(): number
  sort(rows: Value, column: string, ascending?: Value): RowObject[]
  get(row: Value, column: string): Value
  add(values: Record<string, Value>): Promise<RowObject>
  set(row: Value, column: string, value: Value): Promise<void>
  remove(row: Value): Promise<void>
  clear(): Promise<void>
  onChange(handler: Handler): void
}

/**
 * `data` in the generated code (J5): each table by name, and `data.onShared(name, handler)`
 * for "when the shared variable changes". Reading is immediate; writing waits for the server
 * when the table is shared.
 */
export function createDataApi(
  store: DataStore,
  on: (key: string, handler: Handler) => void,
  check: () => void,
): Record<string, Value> {
  const tables = new Map<string, TableApi>()
  const tableApi = (name: string): TableApi => {
    const after = async <T>(promise: Promise<T>) => {
      const result = await promise
      check()
      return result
    }
    return {
      rows: () => store.objects(store.table(name).id),
      where: (column, operator, value) => {
        const { id } = store.table(name)
        store.column(name, column)
        return store.objects(id).filter((row) => matches(row[column], operator, value))
      },
      count: () => store.rows(store.table(name).id).length,
      sort: (rows, column, ascending = true) => {
        store.column(name, column)
        const list = Array.isArray(rows) ? [...rows] : store.objects(store.table(name).id)
        const direction = ascending === false || ascending === 'false' ? -1 : 1
        return list.sort(
          (a, b) =>
            direction * compareCells((a as RowObject)?.[column], (b as RowObject)?.[column]),
        )
      },
      get: (row, column) => {
        store.column(name, column)
        if (!row || typeof row !== 'object') throw new RxError('notARow', { name })
        return (row as RowObject)[column] ?? null
      },
      add: (values) => {
        check()
        return after(store.add(name, isObject(values) ? values : {}))
      },
      set: (row, column, value) => {
        check()
        store.column(name, column)
        return after(store.update(name, row, { [column]: value }))
      },
      remove: (row) => {
        check()
        return after(store.remove(name, row))
      },
      clear: () => {
        check()
        return after(store.clear(name))
      },
      onChange: (handler) => {
        if (typeof handler === 'function') on(`table:${store.table(name).id}`, handler)
      },
    }
  }
  return new Proxy({} as Record<string, Value>, {
    get: (_, key) => {
      if (typeof key !== 'string' || key === 'then' || key === 'toJSON') return undefined
      if (key === 'onShared') {
        return (variable: string, handler: Handler) => {
          const id = store.sharedVariableId(String(variable))
          if (id && typeof handler === 'function') on(`var:${id}`, handler)
        }
      }
      let api = tables.get(key)
      if (!api) {
        store.table(key)
        api = tableApi(key)
        tables.set(key, api)
      }
      return api
    },
  })
}

/**
 * `web` in the generated code: each API connection by name, one method per HTTP verb.
 * `await web.Meteo.get('/forecast', { latitude: 48.8 })` gives the answer's body (an object
 * for JSON); an error status stops the block with a message that names the connection.
 */
export function createWebApi(
  store: DataStore,
  check: () => void,
  resumed: () => void,
): Record<string, Value> {
  return new Proxy({} as Record<string, Value>, {
    get: (_, key) => {
      if (typeof key !== 'string' || key === 'then' || key === 'toJSON') return undefined
      store.apiId(key)
      const call = async (method: HttpMethod, path: Value, query?: Value, body?: Value) => {
        check()
        const response = await store.request(key, {
          method,
          path: path === undefined || path === null ? '' : String(path),
          query: isObject(query) ? query : undefined,
          body: body === undefined || body === '' ? undefined : body,
        })
        resumed()
        check()
        if (response.status >= 400) {
          throw new RxError('apiStatus', { name: key, status: response.status })
        }
        return response.body
      }
      return Object.fromEntries(
        HTTP_METHODS.map((method) => [
          method.toLowerCase(),
          (path?: Value, query?: Value, body?: Value) => call(method, path, query, body),
        ]),
      )
    },
  })
}

function isObject(value: unknown): value is Record<string, Value> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/** `current.temperature_2m`, `hourly.time[0]`, `0.name`: the steps of a path. */
export function pathSteps(path: string): (string | number)[] {
  const steps: (string | number)[] = []
  for (const part of path.split('.')) {
    const match = /^([^[\]]*)((?:\[\d+\])*)$/.exec(part)
    if (!match) {
      steps.push(part)
      continue
    }
    if (match[1]) steps.push(/^\d+$/.test(match[1]) ? Number(match[1]) : match[1])
    for (const index of match[2]?.matchAll(/\[(\d+)\]/g) ?? []) steps.push(Number(index[1]))
  }
  return steps
}

/**
 * `rx.get(object, path)`: a field of an answer, by the path the Data tab shows. A missing
 * field gives `null` (an empty value), never an error: answers often leave fields out.
 */
export function objectGet(object: Value, path: Value): Value {
  let current: Value = typeof object === 'string' ? tryJson(object) : object
  for (const step of pathSteps(String(path ?? ''))) {
    if (current === null || current === undefined) return null
    if (Array.isArray(current) && typeof step === 'number') current = current[step]
    else if (typeof current === 'object') current = (current as Record<string, Value>)[String(step)]
    else return null
  }
  return current === undefined ? null : current
}

/** `rx.set(object, key, value)`: returns the object, so that a block can chain it. */
export function objectSet(object: Value, key: Value, value: Value): Value {
  const target = isObject(object) ? object : {}
  target[String(key)] = value
  return target
}

function tryJson(text: string): Value {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export function fromJson(text: Value): Value {
  if (typeof text !== 'string') return text
  try {
    return JSON.parse(text)
  } catch {
    throw new RxError('badJson')
  }
}

export function toJson(value: Value): string {
  try {
    return JSON.stringify(value ?? null, null, 2)
  } catch {
    return String(value)
  }
}
