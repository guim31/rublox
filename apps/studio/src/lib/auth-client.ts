import { passkeyClient } from '@better-auth/passkey/client'
import { createAuthClient } from 'better-auth/client'
import { usernameClient } from 'better-auth/client/plugins'

/**
 * Better Auth in the browser: sign-in, sessions, passkeys. The signed-in state itself comes
 * from `/api/me` (never a 401), so the session is not refetched on focus.
 */
export const authClient = createAuthClient({
  basePath: '/api/auth',
  plugins: [usernameClient(), passkeyClient()],
  sessionOptions: { refetchOnWindowFocus: false },
})
