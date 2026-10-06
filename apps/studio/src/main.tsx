import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { toast } from 'sonner'
import { setSignedOutHandler } from './lib/api.ts'
import { i18next, initI18n } from './lib/i18n.ts'
import { usePrefs } from './lib/prefs.ts'
import { markSignedOut } from './lib/session.ts'
import { routeTree } from './routeTree.gen.ts'
import './styles/app.css'

initI18n(usePrefs.getState().locale)

const router = createRouter({ routeTree, defaultPreload: 'intent', scrollRestoration: true })

// A session revoked from another device: say it once, then offer to sign in again.
setSignedOutHandler(() => {
  markSignedOut()
  toast(i18next.t('errors.signed_out'), { id: 'signed-out' })
  if (!location.pathname.startsWith('/login')) void router.navigate({ to: '/login' })
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}
