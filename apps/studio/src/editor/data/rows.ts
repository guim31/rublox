import type { BoundRow, TableRows } from '@rublox/runtime'
import { type ProjectDoc, type Row, rowToObject } from '@rublox/schema'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { api, call } from '../../lib/api.ts'
import { queryClient } from '../../lib/query.ts'
import { useDoc, useSession } from '../context.tsx'
import type { ProjectSession } from '../session.ts'

/** Rows of a shared table are read again this often while the editor shows them. */
const SHARED_REFRESH_MS = 5000

export const sharedRowsKey = (projectId: string, tableId: string) =>
  ['shared-rows', projectId, tableId] as const

function fetchRows(projectId: string, tableId: string): Promise<Row[]> {
  return call(
    api.projects[':id'].data.tables[':tableId'].rows.$get({ param: { id: projectId, tableId } }),
  ).then((body) => body.rows as Row[])
}

/** Whether this project's data lives on a server (shared tables, secrets, "Try"). */
export function isServerProject(session: ProjectSession): boolean {
  return session.source.kind === 'server'
}

/** The rows of a shared table, kept fresh while shown (the apps change them too). */
export function useSharedRows(tableId: string, enabled = true) {
  const session = useSession()
  return useQuery({
    queryKey: sharedRowsKey(session.id, tableId),
    queryFn: () => fetchRows(session.id, tableId),
    enabled: enabled && isServerProject(session),
    staleTime: 0,
    refetchInterval: SHARED_REFRESH_MS,
  })
}

/** Writes the rows of a shared table into the cache (after an edit answered). */
export function setSharedRows(projectId: string, tableId: string, update: (rows: Row[]) => Row[]) {
  queryClient.setQueryData<Row[]>(sharedRowsKey(projectId, tableId), (rows) => update(rows ?? []))
}

function boundRows(doc: ProjectDoc, tableId: string, rows: Row[]): BoundRow[] {
  const columns = doc.data.tables[tableId]?.columns ?? []
  return rows.map((row) => ({ row, object: rowToObject(columns, row) }))
}

/**
 * The rows the canvas draws in bound components (SPEC § 4.5, "the canvas shows the real
 * data"): those of the project for a local table, the server's for a shared one.
 */
export function useCanvasTableRows(): TableRows {
  const session = useSession()
  const doc = useDoc()
  const shared = Object.entries(doc.data.tables)
    .filter(([, table]) => table.mode === 'shared')
    .map(([id]) => id)
  const server = isServerProject(session)
  const results = useQueries({
    queries: shared.map((tableId) => ({
      queryKey: sharedRowsKey(session.id, tableId),
      queryFn: () => fetchRows(session.id, tableId),
      enabled: server,
      staleTime: SHARED_REFRESH_MS,
    })),
  })
  const sharedRows = new Map(shared.map((id, index) => [id, results[index]?.data ?? []]))
  const key = results.map((result) => result.dataUpdatedAt).join(',')
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands for the shared rows
  return useMemo(
    () => (tableId: string) => {
      const table = doc.data.tables[tableId]
      if (!table) return undefined
      return boundRows(
        doc,
        tableId,
        table.mode === 'shared' ? (sharedRows.get(tableId) ?? []) : table.rows,
      )
    },
    [doc, key],
  )
}
