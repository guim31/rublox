import { describe, expect, it } from 'vitest'
import {
  addApi,
  addColumn,
  addRows,
  addTable,
  buildApiUrl,
  coerceCell,
  connectionSecrets,
  fillSecrets,
  guessType,
  importTable,
  migrateProject,
  ProjectOpError,
  parseCsv,
  projectDocSchema,
  projectToYDoc,
  removeColumn,
  removeRows,
  rowToObject,
  toCsv,
  updateColumn,
  updateRow,
  updateTable,
  yDocToProject,
} from '../src/index.ts'
import { fixture } from './fixture.ts'

const valid = (ydoc: ReturnType<typeof projectToYDoc>) =>
  projectDocSchema.parse(yDocToProject(ydoc))

describe('tables', () => {
  it('adds a table, columns and rows, and reads them back', () => {
    const ydoc = projectToYDoc(fixture())
    const id = addTable(ydoc, { name: 'Contacts' })
    const name = addColumn(ydoc, id, { name: 'Nom', type: 'text' })
    const age = addColumn(ydoc, id, { name: 'Âge', type: 'number' })
    const [row] = addRows(ydoc, id, [{ [name]: 'Léa', [age]: '9' }])
    const doc = valid(ydoc)
    const table = doc.data.tables[id]!
    expect(table.mode).toBe('local')
    expect(table.rows).toEqual([{ id: row, values: { [name]: 'Léa', [age]: 9 } }])
    expect(rowToObject(table.columns, table.rows[0]!)).toEqual({ id: row, Nom: 'Léa', Âge: 9 })
    // The JSON form goes back into Yjs unchanged.
    expect(yDocToProject(projectToYDoc(doc)).data).toEqual(doc.data)
  })

  it('keeps names unique', () => {
    const ydoc = projectToYDoc(fixture())
    const a = addTable(ydoc, { name: 'Notes' })
    const b = addTable(ydoc, { name: 'Notes' })
    expect(valid(ydoc).data.tables[b]!.name).toBe('Notes1')
    expect(() => updateTable(ydoc, b, { name: 'Notes' })).toThrow(ProjectOpError)
    const c1 = addColumn(ydoc, a, { name: 'X', type: 'text' })
    addColumn(ydoc, a, { name: 'X', type: 'text' })
    expect(() => updateColumn(ydoc, a, c1, { name: 'X1' })).toThrow(ProjectOpError)
  })

  it('converts the cells when a column changes type, and forgets a removed column', () => {
    const ydoc = projectToYDoc(fixture())
    const id = addTable(ydoc, { name: 'T' })
    const col = addColumn(ydoc, id, { name: 'n', type: 'text' })
    const [r1, r2] = addRows(ydoc, id, [{ [col]: '12' }, { [col]: 'douze' }])
    updateColumn(ydoc, id, col, { type: 'number' })
    let rows = valid(ydoc).data.tables[id]!.rows
    expect(rows.map((row) => row.values[col])).toEqual([12, null])
    updateRow(ydoc, id, r2!, { [col]: 3 })
    removeRows(ydoc, id, [r1!])
    rows = valid(ydoc).data.tables[id]!.rows
    expect(rows).toEqual([{ id: r2, values: { [col]: 3 } }])
    removeColumn(ydoc, id, col)
    expect(valid(ydoc).data.tables[id]!.rows[0]!.values).toEqual({})
  })

  it('imports a CSV, guessing the types', () => {
    const ydoc = projectToYDoc(fixture())
    const id = addTable(ydoc, { name: 'Villes' })
    const [header, ...rows] = parseCsv(
      'Ville;Habitants;Capitale\r\nParis;2100000;oui\nLyon;520000;non\n',
    )
    importTable(ydoc, id, header!, rows, 'replace')
    const table = valid(ydoc).data.tables[id]!
    expect(table.columns.map((c) => [c.name, c.type])).toEqual([
      ['Ville', 'text'],
      ['Habitants', 'number'],
      ['Capitale', 'boolean'],
    ])
    expect(table.rows.map((row) => rowToObject(table.columns, row).Habitants)).toEqual([
      2100000, 520000,
    ])
  })

  it('accepts a project written before J5 (a table with a name only)', () => {
    const doc = { ...fixture(), data: { tables: { t1: { name: 'Old' } }, apis: {} } }
    expect(migrateProject(doc).data.tables.t1).toEqual({
      name: 'Old',
      mode: 'local',
      access: 'write',
      columns: [],
      rows: [],
    })
  })
})

describe('cells and CSV', () => {
  it('converts values to each type', () => {
    expect(coerceCell('number', '3,5')).toBe(3.5)
    expect(coerceCell('number', 'abc')).toBeUndefined()
    expect(coerceCell('boolean', 'Oui')).toBe(true)
    expect(coerceCell('date', '07/10/2026')).toBe('2026-10-07')
    expect(coerceCell('text', 42)).toBe('42')
    expect(coerceCell('text', '')).toBeNull()
  })

  it('reads quotes, separators and line breaks', () => {
    expect(parseCsv('a,b\n"x, ""y""",2\n"multi\nline",3')).toEqual([
      ['a', 'b'],
      ['x, "y"', '2'],
      ['multi\nline', '3'],
    ])
    expect(
      parseCsv(
        toCsv([
          ['a;b', 'c"d', null],
          ['1', 2, true],
        ]),
      ),
    ).toEqual([
      ['a;b', 'c"d', ''],
      ['1', '2', 'true'],
    ])
  })

  it('guesses column types', () => {
    expect(guessType(['1', '2.5', ''])).toBe('number')
    expect(guessType(['https://example.com/a.png'])).toBe('image')
    expect(guessType(['https://example.com/'])).toBe('link')
    expect(guessType(['2026-01-02'])).toBe('date')
    expect(guessType(['abc', '1'])).toBe('text')
  })
})

describe('API connections', () => {
  const connection = {
    baseUrl: 'https://api.example.com/v1',
    params: [{ id: 'p', key: 'units', value: 'metric' }],
  }

  it('builds addresses that stay under the base', () => {
    expect(buildApiUrl(connection, '/forecast?city=Lyon', { days: 2 }).href).toBe(
      'https://api.example.com/v1/forecast?city=Lyon&units=metric&days=2',
    )
    expect(buildApiUrl(connection, '').href).toBe('https://api.example.com/v1?units=metric')
    expect(() => buildApiUrl(connection, '../admin')).toThrow(TypeError)
    expect(() => buildApiUrl(connection, '..%2F..%2Fadmin')).toThrow(TypeError)
    expect(() => buildApiUrl(connection, '..%5cadmin')).toThrow(TypeError)
    // A name with an encoded character is fine; only the separators are refused.
    expect(buildApiUrl(connection, '/caf%C3%A9').pathname).toBe('/v1/caf%C3%A9')
    expect(() => buildApiUrl(connection, '//evil.example.com/x')).toThrow(TypeError)
    expect(() => buildApiUrl(connection, 'https://evil.example.com')).toThrow(TypeError)
    expect(() => buildApiUrl({ baseUrl: 'file:///etc/passwd', params: [] }, '')).toThrow(TypeError)
  })

  it('names its secrets without holding them', () => {
    const ydoc = projectToYDoc(fixture())
    const id = addApi(ydoc, {
      name: 'Meteo',
      baseUrl: 'https://api.example.com',
      headers: [{ id: 'h', key: 'Authorization', value: 'Bearer {{secret:METEO_KEY}}' }],
    })
    const api = valid(ydoc).data.apis[id]!
    expect(connectionSecrets(api)).toEqual(['METEO_KEY'])
    expect(fillSecrets(api.headers[0]!.value, new Map([['METEO_KEY', 'abc']]))).toBe('Bearer abc')
  })
})
