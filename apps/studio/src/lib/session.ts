import { useQuery } from '@tanstack/react-query'
import { api, call, type Me } from './api.ts'
import { queryClient } from './query.ts'

export const ME_KEY = ['me'] as const

const SIGNED_OUT: Me = { user: null, spaces: [] } as unknown as Me

export function fetchMe(): Promise<Me> {
  return call(api.me.$get())
}

/** How often `/api/me` is read again while the tab is visible (it never answers 401). */
const ME_REFRESH = 5 * 60_000

/**
 * Who is signed in (`user: null` in guest mode), their spaces and the instance settings.
 * Read again when the tab comes back and every few minutes: that is how an expired or
 * revoked session is noticed, without ever probing a protected route (SPEC § 6.9).
 */
export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: fetchMe,
    refetchOnWindowFocus: 'always',
    refetchInterval: ME_REFRESH,
  })
}

let knownUserId: string | null = null
let signingOut = false

/**
 * Calls `onLost` when `/api/me` stops returning the account that was signed in, unless the
 * person signed out themself. Set up once by the app.
 */
export function watchSession(onLost: () => void) {
  queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.query.queryKey[0] !== ME_KEY[0]) return
    const data = event.query.state.data as Me | undefined
    if (!data) return
    const id = data.user?.id ?? null
    const lost = knownUserId !== null && id !== knownUserId && !signingOut
    knownUserId = id
    if (lost) onLost()
  })
}

/** The signed-in account as last read, outside React (null in guest mode). */
export function currentUserId(): string | null {
  return queryClient.getQueryData<Me>(ME_KEY)?.user?.id ?? null
}

export function useUser() {
  return useMe().data?.user ?? null
}

/**
 * Forgets the account's data. Removed rather than invalidated: refetching would only ask
 * protected routes again for nothing.
 */
export function markSignedOut() {
  queryClient.setQueryData(ME_KEY, SIGNED_OUT)
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== ME_KEY[0] })
}

export async function refreshMe() {
  await queryClient.invalidateQueries()
  return queryClient.fetchQuery({ queryKey: ME_KEY, queryFn: fetchMe })
}

/** After the account was deleted: the same as signing out, without asking the server. */
export async function forgetAccount() {
  signingOut = true
  try {
    await (await import('../storage/server-cache.ts')).clearCache()
    queryClient.clear()
    queryClient.setQueryData(ME_KEY, SIGNED_OUT)
  } finally {
    signingOut = false
  }
}

export async function signOut() {
  signingOut = true
  try {
    // Better Auth's client is only needed to sign in and out: loaded then (SPEC § 7).
    const { authClient } = await import('./auth-client.ts')
    await authClient.signOut()
    // The browser may be shared: the offline copies of the projects leave with the account.
    await (await import('../storage/server-cache.ts')).clearCache()
    queryClient.clear()
    queryClient.setQueryData(ME_KEY, SIGNED_OUT)
  } finally {
    signingOut = false
  }
}
