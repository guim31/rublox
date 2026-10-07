import type { DataCredential } from '@rublox/schema'
import { useQuery } from '@tanstack/react-query'
import { api, call } from '../../lib/api.ts'
import type { ProjectSession } from '../session.ts'
import { isServerProject } from './rows.ts'

/** Tickets last 12 hours: one is asked again well before. */
const RENEW_MS = 6 * 3600 * 1000

/**
 * The ticket that lets the preview (apps origin, no cookie) use the API relay and the shared
 * data of a project open in the editor (SPEC § 6.9). A guest's project has none: `ready` at
 * once, `credential` null.
 */
export function useDataTicket(session: ProjectSession): {
  ready: boolean
  credential: DataCredential | null
} {
  const server = isServerProject(session)
  const query = useQuery({
    queryKey: ['data-ticket', session.id],
    queryFn: () =>
      call(api.projects[':id'].data.ticket.$post({ param: { id: session.id } })).then(
        (body): DataCredential => ({ kind: 'editor', project: session.id, ticket: body.ticket }),
      ),
    enabled: server,
    staleTime: RENEW_MS,
    refetchInterval: RENEW_MS,
  })
  if (!server) return { ready: true, credential: null }
  // A refused ticket (offline, trash) still lets the preview run, without the services.
  return { ready: !query.isPending, credential: query.data ?? null }
}
