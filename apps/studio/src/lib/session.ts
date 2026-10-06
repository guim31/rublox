import { useQuery } from '@tanstack/react-query'
import { api, call, type Me } from './api.ts'
import { authClient } from './auth-client.ts'
import { queryClient } from './query.ts'

export const ME_KEY = ['me'] as const

const SIGNED_OUT: Me = { user: null, spaces: [] } as unknown as Me

export function fetchMe(): Promise<Me> {
  return call(api.me.$get())
}

/** Who is signed in (`user: null` in guest mode), their spaces and the instance settings. */
export function useMe() {
  return useQuery({ queryKey: ME_KEY, queryFn: fetchMe })
}

export function useUser() {
  return useMe().data?.user ?? null
}

export function markSignedOut() {
  queryClient.setQueryData(ME_KEY, SIGNED_OUT)
  void queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== 'me' })
}

export async function refreshMe() {
  await queryClient.invalidateQueries()
  return queryClient.fetchQuery({ queryKey: ME_KEY, queryFn: fetchMe })
}

export async function signOut() {
  await authClient.signOut()
  queryClient.clear()
  queryClient.setQueryData(ME_KEY, SIGNED_OUT)
}
