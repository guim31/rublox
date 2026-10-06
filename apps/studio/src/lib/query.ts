import { QueryClient } from '@tanstack/react-query'

/** The one query cache of the studio (also used outside React: sign-out, API errors). */
export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY, retry: false } },
})
