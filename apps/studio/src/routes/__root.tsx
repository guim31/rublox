import { QueryClientProvider } from '@tanstack/react-query'
import { createRootRoute, type ErrorComponentProps, Outlet } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Toaster } from 'sonner'
import { Mascot } from '../components/brand.tsx'
import { CommandPalette } from '../components/command-palette.tsx'
import { Button } from '../components/ui/button.tsx'
import { LinkButton } from '../components/ui/link-button.tsx'
import { TooltipProvider } from '../components/ui/tooltip.tsx'
import { BadgeToasts } from '../learn/badges.tsx'
import { useLearningSync } from '../learn/sync.ts'
import { useCommands } from '../lib/commands.ts'
import { isMod, useKeydown } from '../lib/hotkeys.ts'
import { i18next } from '../lib/i18n.ts'
import { isDark, usePrefs } from '../lib/prefs.ts'
import { useProfileSync } from '../lib/profile-sync.ts'
import { queryClient } from '../lib/query.ts'

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
  return (
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  )
}

function App() {
  usePrefsOnDocument()
  useProfileSync()
  useLearningSync()
  const theme = usePrefs((s) => s.theme)
  useKeydown((event) => {
    if (isMod(event) && event.key.toLowerCase() === 'k') {
      event.preventDefault()
      useCommands.getState().setOpen(!useCommands.getState().open)
    }
  })
  return (
    <TooltipProvider>
      <Outlet />
      <CommandPalette />
      <BadgeToasts />
      <Toaster
        position="bottom-center"
        theme={theme}
        toastOptions={{ className: 'font-ui' }}
        closeButton
      />
    </TooltipProvider>
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
        <LinkButton to="/" variant="primary">
          {t('notFound.action')}
        </LinkButton>
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
