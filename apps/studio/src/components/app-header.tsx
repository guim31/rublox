import { Link, useNavigate } from '@tanstack/react-router'
import { LogIn, LogOut, Search, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { cn } from '../lib/cn.ts'
import { useCommands } from '../lib/commands.ts'
import { useFeatures } from '../lib/features.ts'
import { signOut, useMe } from '../lib/session.ts'
import { Avatar } from './avatar.tsx'
import { Logo } from './brand.tsx'
import { ModeSwitch, PrefsMenu } from './prefs-controls.tsx'
import { Button } from './ui/button.tsx'
import { Kbd } from './ui/kbd.tsx'
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from './ui/menu.tsx'

/** The top bar of every page but the editor: navigation, preferences and account. */
export function AppHeader() {
  const { t } = useTranslation()
  const me = useMe()
  const user = me.data?.user ?? null
  const features = useFeatures()
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-5 junior:h-[72px]">
        <Link to="/" aria-label={t('nav.projects')} className="rounded-ui">
          <Logo />
        </Link>
        {me.isPending ? null : user ? (
          <nav aria-label={t('nav.main')} className="ml-2 hidden items-center gap-1 sm:flex">
            <NavLink to="/">{t('nav.projects')}</NavLink>
            {features.gallery ? <NavLink to="/gallery">{t('gallery.nav')}</NavLink> : null}
            <NavLink to="/spaces">{t('nav.spaces')}</NavLink>
            <NavLink to="/learn">{t('learn.open')}</NavLink>
            {user.isAdmin ? <NavLink to="/admin">{t('nav.admin')}</NavLink> : null}
          </nav>
        ) : (
          <>
            <span
              className="hidden items-center gap-1.5 rounded-full bg-yellow-soft px-3 py-1 text-ui-sm font-strong text-text sm:inline-flex"
              title={t('guest.explain')}
            >
              <span className="size-2 rounded-full bg-yellow" aria-hidden="true" />
              {t('guest.badge')}
            </span>
            <nav aria-label={t('nav.main')} className="ml-1 hidden items-center gap-1 sm:flex">
              <NavLink to="/">{t('nav.projects')}</NavLink>
              <NavLink to="/learn">{t('learn.open')}</NavLink>
            </nav>
          </>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => useCommands.getState().setOpen(true)}
          className="hidden h-control items-center gap-2 rounded-ui border border-border bg-surface px-3 text-muted hover:border-border-strong md:inline-flex"
        >
          <Search size={15} />
          <span className="text-ui-sm">{t('commands.open')}</span>
          <Kbd>Mod+K</Kbd>
        </button>
        <ModeSwitch />
        <PrefsMenu />
        {me.isPending ? null : user ? (
          <UserMenu name={user.displayName} avatar={user.avatar} />
        ) : (
          <Link to="/login">
            <Button variant="soft" icon={<LogIn size={16} />}>
              {t('userMenu.signIn')}
            </Button>
          </Link>
        )}
      </div>
    </header>
  )
}

function NavLink({
  to,
  children,
}: {
  to: '/' | '/spaces' | '/admin' | '/learn' | '/gallery'
  children: ReactNode
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === '/', includeSearch: false }}
      className="rounded-ui px-3 py-2 font-strong text-muted hover:bg-surface-2 hover:text-text"
      activeProps={{ className: cn('bg-surface-2 text-text'), 'aria-current': 'page' }}
    >
      {children}
    </Link>
  )
}

export function UserMenu({ name, avatar }: { name: string; avatar: string | null }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={t('userMenu.label', { name })}
          data-testid="user-menu"
          className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Avatar id={avatar} name={name} size={36} />
        </button>
      </MenuTrigger>
      <MenuContent>
        <MenuLabel>{name}</MenuLabel>
        <MenuItem icon={<UserRound size={15} />} onSelect={() => void navigate({ to: '/account' })}>
          {t('userMenu.account')}
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          icon={<LogOut size={15} />}
          onSelect={async () => {
            await signOut()
            toast(t('userMenu.signedOut'))
            await navigate({ to: '/login' })
          }}
        >
          {t('userMenu.signOut')}
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}

/** A page under the app header, with its title. */
export function Page({
  title,
  subtitle,
  actions,
  children,
  width = 'wide',
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  width?: 'wide' | 'narrow'
}) {
  return (
    <div className="flex min-h-full flex-col">
      <AppHeader />
      <main
        className={cn(
          'mx-auto w-full flex-1 px-5 pt-8 pb-16',
          width === 'wide' ? 'max-w-7xl' : 'max-w-3xl',
        )}
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-ui-xl font-strong tracking-tight">{title}</h1>
            {subtitle ? <p className="mt-1 text-muted">{subtitle}</p> : null}
          </div>
          {actions}
        </div>
        {children}
      </main>
    </div>
  )
}
