import { useNavigate } from '@tanstack/react-router'
import { Command as Cmdk } from 'cmdk'
import {
  Blocks,
  Gamepad2,
  Globe,
  LayoutDashboard,
  LogIn,
  LogOut,
  Moon,
  Plus,
  ShieldCheck,
  Sparkles,
  Sun,
  SunMoon,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { Dialog as Radix } from 'radix-ui'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { type Command, useCommands } from '../lib/commands.ts'
import { usePrefs } from '../lib/prefs.ts'
import { signOut, useMe } from '../lib/session.ts'
import { createDemo } from '../storage/demos.ts'
import { Kbd } from './ui/kbd.tsx'

const GROUP_ORDER: Command['group'][] = ['editor', 'add', 'project', 'interface']

/** Ctrl/Cmd + K: every action of the current page, searchable (SPEC § 5.1). */
export function CommandPalette() {
  const { t } = useTranslation()
  const { open, setOpen, page } = useCommands()
  const prefs = usePrefs()
  const navigate = useNavigate()
  const me = useMe()

  const global: Command[] = [
    {
      id: 'new-project',
      group: 'project',
      label: t('commands.newProject'),
      icon: <Plus size={16} />,
      run: () => void navigate({ to: '/', search: { new: true } }),
    },
    ...(['catchGame', 'bouncing'] as const).map(
      (demo): Command => ({
        id: `demo-${demo}`,
        group: 'project',
        label: t(`game.demos.${demo}`),
        icon: <Gamepad2 size={16} />,
        keywords: ['jeu', 'game', 'demo', 'démo'],
        run: () => {
          const created = createDemo(demo, prefs.locale, Boolean(me.data?.user)).then((projectId) =>
            navigate({ to: '/p/$projectId', params: { projectId }, search: { tab: 'design' } }),
          )
          toast.promise(created, { loading: t('game.demoCreating'), error: t('game.demoFailed') })
        },
      }),
    ),
    {
      id: 'dashboard',
      group: 'project',
      label: t('commands.dashboard'),
      icon: <LayoutDashboard size={16} />,
      run: () => void navigate({ to: '/' }),
    },
    prefs.mode === 'junior'
      ? {
          id: 'studio',
          group: 'interface',
          label: t('commands.switchToStudio'),
          icon: <Blocks size={16} />,
          run: () => prefs.setMode('studio'),
        }
      : {
          id: 'junior',
          group: 'interface',
          label: t('commands.switchToJunior'),
          icon: <Sparkles size={16} />,
          run: () => prefs.setMode('junior'),
        },
    {
      id: 'light',
      group: 'interface',
      label: t('commands.lightTheme'),
      icon: <Sun size={16} />,
      run: () => prefs.setTheme('light'),
    },
    {
      id: 'dark',
      group: 'interface',
      label: t('commands.darkTheme'),
      icon: <Moon size={16} />,
      run: () => prefs.setTheme('dark'),
    },
    {
      id: 'system',
      group: 'interface',
      label: t('commands.systemTheme'),
      icon: <SunMoon size={16} />,
      run: () => prefs.setTheme('system'),
    },
    prefs.locale === 'fr'
      ? {
          id: 'en',
          group: 'interface',
          label: t('commands.english'),
          icon: <Globe size={16} />,
          keywords: ['english', 'langue'],
          run: () => prefs.setLocale('en'),
        }
      : {
          id: 'fr',
          group: 'interface',
          label: t('commands.french'),
          icon: <Globe size={16} />,
          keywords: ['français', 'language'],
          run: () => prefs.setLocale('fr'),
        },
  ]
  const user = me.data?.user
  const account: Command[] = me.isPending
    ? []
    : user
      ? [
          {
            id: 'account',
            group: 'project',
            label: t('userMenu.account'),
            icon: <UserRound size={16} />,
            run: () => void navigate({ to: '/account' }),
          },
          {
            id: 'spaces',
            group: 'project',
            label: t('nav.spaces'),
            icon: <UsersRound size={16} />,
            run: () => void navigate({ to: '/spaces' }),
          },
          ...(user.isAdmin
            ? [
                {
                  id: 'admin',
                  group: 'project' as const,
                  label: t('nav.admin'),
                  icon: <ShieldCheck size={16} />,
                  run: () => void navigate({ to: '/admin' }),
                },
              ]
            : []),
          {
            id: 'sign-out',
            group: 'project',
            label: t('userMenu.signOut'),
            icon: <LogOut size={16} />,
            run: async () => {
              await signOut()
              await navigate({ to: '/login' })
            },
          },
        ]
      : [
          {
            id: 'sign-in',
            group: 'project',
            label: t('userMenu.signIn'),
            icon: <LogIn size={16} />,
            run: () => void navigate({ to: '/login' }),
          },
        ]
  const commands = [...page, ...global, ...account]

  return (
    <Radix.Root open={open} onOpenChange={setOpen}>
      <Radix.Portal>
        <Radix.Overlay className="fixed inset-0 z-40 bg-overlay rx-anim-in" />
        <Radix.Content className="fixed top-[14vh] left-1/2 z-50 w-[min(92vw,560px)] -translate-x-1/2 overflow-hidden rounded-ui-lg border border-border bg-surface shadow-3 animate-[rx-pop_160ms_ease-out]">
          <Radix.Title className="sr-only">{t('commands.open')}</Radix.Title>
          <Radix.Description className="sr-only">{t('commands.placeholder')}</Radix.Description>
          <Cmdk label={t('commands.open')} loop>
            <Cmdk.Input
              placeholder={t('commands.placeholder')}
              className="h-14 w-full border-b border-border bg-transparent px-4 text-ui-lg outline-none placeholder:text-muted"
            />
            <Cmdk.List className="max-h-[50vh] overflow-y-auto p-1.5">
              <Cmdk.Empty className="p-6 text-center text-muted">{t('commands.empty')}</Cmdk.Empty>
              {GROUP_ORDER.map((group) => {
                const items = commands.filter((command) => command.group === group)
                if (!items.length) return null
                return (
                  <Cmdk.Group
                    key={group}
                    heading={t(`commands.groups.${group}`)}
                    className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-ui-sm [&_[cmdk-group-heading]]:text-muted"
                  >
                    {items.map((command) => (
                      <Cmdk.Item
                        key={command.id}
                        value={`${command.label} ${command.id}`}
                        keywords={command.keywords}
                        onSelect={() => {
                          setOpen(false)
                          command.run()
                        }}
                        className="flex h-control cursor-pointer items-center gap-3 rounded-ui px-2.5 text-ui data-[selected=true]:bg-primary-soft data-[selected=true]:text-primary-text"
                      >
                        <span className="grid w-4 place-items-center text-muted">
                          {command.icon}
                        </span>
                        <span className="flex-1">{command.label}</span>
                        {command.shortcut ? <Kbd>{command.shortcut}</Kbd> : null}
                      </Cmdk.Item>
                    ))}
                  </Cmdk.Group>
                )
              })}
            </Cmdk.List>
          </Cmdk>
        </Radix.Content>
      </Radix.Portal>
    </Radix.Root>
  )
}
