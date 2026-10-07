import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { toast } from 'sonner'
import { setSignedOutHandler } from './lib/api.ts'
import { i18next, initI18n } from './lib/i18n.ts'
import { usePrefs } from './lib/prefs.ts'
import { markSignedOut, watchSession } from './lib/session.ts'
import { routeTree } from './routeTree.gen.ts'
import './styles/app.css'

const router = createRouter({ routeTree, defaultPreload: 'intent', scrollRestoration: true })

// A session that expired or was revoked elsewhere: say it once, then offer to sign in again.
// Noticed by `/api/me` (focus, every few minutes) or an answer `signed_out` (403, never 401).
const sessionLost = () => {
  markSignedOut()
  toast(i18next.t('errors.signed_out'), { id: 'signed-out' })
  if (!location.pathname.startsWith('/login')) void router.navigate({ to: '/login' })
}
setSignedOutHandler(sessionLost)
watchSession(sessionLost)

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const root = document.getElementById('root')
// The strings of the language in use come first: nothing is drawn in a missing language.
if (root) {
  await initI18n(usePrefs.getState().locale)
  createRoot(root).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}
