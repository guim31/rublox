import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as projects from '../storage/projects.ts'

export const PROJECTS_KEY = ['projects'] as const

export function useProjects() {
  return useQuery({
    queryKey: PROJECTS_KEY,
    queryFn: async () => {
      await projects.purgeExpired()
      return projects.listProjects()
    },
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
