/**
 * CSV for the tables of the Data tab (SPEC § 4.5): RFC 4180 quoting, `,` or `;` as separator
 * (French spreadsheets write `;`), a byte order mark ignored.
 */

/** Rows of cells. The separator is guessed from the first line unless given. */
export function parseCsv(text: string, separator?: ',' | ';' | '\t'): string[][] {
  const source = text.replace(/^﻿/, '')
  const sep = separator ?? guessSeparator(source)
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  let i = 0
  while (i < source.length) {
    const char = source[i] as string
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"'
          i += 2
          continue
        }
        quoted = false
      } else cell += char
      i += 1
      continue
    }
    if (char === '"' && cell === '') quoted = true
    else if (char === sep) {
      row.push(cell)
      cell = ''
    } else if (char === '\n' || char === '\r') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      if (char === '\r' && source[i + 1] === '\n') i += 1
    } else cell += char
    i += 1
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((value) => value.trim() !== ''))
}

function guessSeparator(text: string): ',' | ';' | '\t' {
  const line = text.split(/\r?\n/, 1)[0] ?? ''
  const count = (char: string) => line.split(char).length - 1
  const tabs = count('\t')
  const semis = count(';')
  const commas = count(',')
  if (tabs > semis && tabs > commas) return '\t'
  return semis > commas ? ';' : ','
}

function quoteCell(value: string): string {
  return /[",;\n\r]/.test(value) || /^\s|\s$/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** CSV text (with CRLF line ends, as spreadsheets expect). */
export function toCsv(rows: readonly (readonly unknown[])[]): string {
  return rows
    .map((row) =>
      row
        .map((value) =>
          quoteCell(value === null || value === undefined ? '' : String(value as string)),
        )
        .join(','),
    )
    .join('\r\n')
}
