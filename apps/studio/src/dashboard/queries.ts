import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ProjectsBackend } from '../storage/backend.ts'

export const PROJECTS_KEY = ['projects'] as const

export function useProjects(backend: ProjectsBackend | null) {
  return useQuery({
    queryKey: [...PROJECTS_KEY, backend?.kind ?? 'pending'],
    queryFn: () => (backend ? backend.list() : []),
    enabled: backend !== null,
    // Server projects change elsewhere too (members, shared projects): refresh on each visit.
    staleTime: backend?.kind === 'server' ? 0 : Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: backend?.kind === 'server',
  })
}

/** A mutation that refreshes the project list when done. */
export function useProjectMutation<A>(run: (args: A) => Promise<unknown>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSettled: () => client.invalidateQueries({ queryKey: PROJECTS_KEY }),
  })
}
