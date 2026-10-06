import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRootRoute, type ErrorComponentProps, Link, Outlet } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Toaster } from 'sonner'
import { Mascot } from '../components/brand.tsx'
import { CommandPalette } from '../components/command-palette.tsx'
import { Button } from '../components/ui/button.tsx'
import { TooltipProvider } from '../components/ui/tooltip.tsx'
import { useCommands } from '../lib/commands.ts'
import { isMod, useKeydown } from '../lib/hotkeys.ts'
import { i18next } from '../lib/i18n.ts'
import { isDark, usePrefs } from '../lib/prefs.ts'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } },
})

export const Route = createRootRoute({
  component: Root,
  notFoundComponent: NotFound,
  errorComponent: Failure,
})

/** Keeps `<html>` in sync with the preferences: mode, theme, language. */
function usePrefsOnDocument() {
  const { mode, theme, locale } = usePrefs()
  useEffect(() => {
    const root = document.documentElement
    root.dataset.mode = mode
    const apply = () => {
      root.dataset.theme = isDark(theme) ? 'dark' : 'light'
    }
    apply()
    const query = matchMedia('(prefers-color-scheme: dark)')
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [mode, theme])
  useEffect(() => {
    document.documentElement.lang = locale
    void i18next.changeLanguage(locale)
  }, [locale])
}

function Root() {
  usePrefsOnDocument()
  const theme = usePrefs((s) => s.theme)
  useKeydown((event) => {
    if (isMod(event) && event.key.toLowerCase() === 'k') {
      event.preventDefault()
      useCommands.getState().setOpen(!useCommands.getState().open)
    }
  })
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Outlet />
        <CommandPalette />
        <Toaster
          position="bottom-center"
          theme={theme}
          toastOptions={{ className: 'font-ui' }}
          closeButton
        />
      </TooltipProvider>
    </QueryClientProvider>
  )
}

function NotFound() {
  const { t } = useTranslation()
  return (
    <main className="grid min-h-full place-items-center p-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <Mascot size={110} />
        <h1 className="text-ui-xl font-strong">{t('notFound.title')}</h1>
        <p className="text-muted">{t('notFound.text')}</p>
        <Link to="/">
          <Button variant="primary">{t('notFound.action')}</Button>
        </Link>
      </div>
    </main>
  )
}

function Failure({ error }: ErrorComponentProps) {
  const { t } = useTranslation()
  console.error(error)
  return (
    <main className="grid min-h-full place-items-center p-6 text-center">
      <div className="flex max-w-md flex-col items-center gap-3">
        <Mascot size={110} />
        <h1 className="text-ui-xl font-strong">{t('error.title')}</h1>
        <p className="text-muted">{t('error.text')}</p>
        <Button variant="primary" onClick={() => location.reload()}>
          {t('error.action')}
        </Button>
      </div>
    </main>
  )
}
