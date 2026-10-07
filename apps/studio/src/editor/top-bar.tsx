import {
  APP_WORKSPACE,
  duplicateScreen,
  isValidName,
  moveScreen,
  removeScreen,
  renameScreen,
  setMeta,
  setStartScreen,
  type WorkspaceKey,
} from '@rublox/schema'
import { Link } from '@tanstack/react-router'
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Cloud,
  CloudOff,
  CloudUpload,
  Copy,
  Eye,
  History,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  Puzzle,
  Redo2,
  Rocket,
  Search,
  Share2,
  Smartphone,
  Star,
  Table2,
  Trash2,
  Undo2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { LogoMark } from '../components/brand.tsx'
import { ModeSwitch, PrefsMenu } from '../components/prefs-controls.tsx'
import { Button, IconButton } from '../components/ui/button.tsx'
import { Dialog } from '../components/ui/dialog.tsx'
import { Input } from '../components/ui/input.tsx'
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from '../components/ui/menu.tsx'
import { Tooltip } from '../components/ui/tooltip.tsx'
import { HelpButton } from '../help/help-panel.tsx'
import { cn } from '../lib/cn.ts'
import { useCommands } from '../lib/commands.ts'
import type { EditorTab } from '../routes/p.$projectId.tsx'
import { addNewScreen } from './actions.ts'
import { useDoc, useSaveState, useSession, useUndoState } from './context.tsx'
import { useEditorNavigate } from './nav.ts'
import { PresenceAvatars } from './presence-ui.tsx'
import { LiveButton } from './publish/live-dialog.tsx'
import { PublishDialog } from './publish/publish-dialog.tsx'
import { TransferMenu } from './publish/transfer-menu.tsx'
import { ShareDialog } from './share-dialog.tsx'
import { VersionsDialog } from './versions-dialog.tsx'

type Props = { projectId: string; tab: EditorTab; screenId: WorkspaceKey }

/** The editor's top bar (SPEC § 5.3). */
export function TopBar({ projectId, tab, screenId }: Props) {
  const { t } = useTranslation()
  const session = useSession()
  // A gallery project (J6) is only looked at: no history, test, share nor publish.
  const visitor = session.source.access === 'gallery'
  const { canUndo, canRedo } = useUndoState()
  const go = useEditorNavigate(projectId)
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface px-2 junior:h-16 junior:gap-3 junior:px-3">
      <Tooltip content={t('editor.home')}>
        <Link
          to="/"
          aria-label={t('editor.home')}
          className="grid size-control place-items-center rounded-ui hover:bg-surface-2"
        >
          <LogoMark size={26} />
        </Link>
      </Tooltip>
      <ProjectName />
      <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
      <nav
        aria-label={t('editor.tabs.design')}
        className="flex items-center gap-1 rounded-ui bg-surface-2 p-0.5"
      >
        <TabLink
          tour="tab:design"
          active={tab === 'design'}
          onClick={() =>
            go({ tab: 'design', screen: screenId === APP_WORKSPACE ? undefined : screenId })
          }
          icon={<Layers size={16} />}
        >
          {t('editor.tabs.design')}
        </TabLink>
        <TabLink
          tour="tab:blocks"
          active={tab === 'blocks'}
          onClick={() => go({ tab: 'blocks' })}
          icon={<Puzzle size={16} />}
        >
          {t('editor.tabs.blocks')}
        </TabLink>
        <TabLink
          tour="tab:data"
          active={tab === 'data'}
          onClick={() =>
            go({ tab: 'data', screen: screenId === APP_WORKSPACE ? undefined : screenId })
          }
          icon={<Table2 size={16} />}
        >
          {t('editor.tabs.data')}
        </TabLink>
      </nav>
      {tab !== 'data' ? <ScreenPicker projectId={projectId} tab={tab} current={screenId} /> : null}
      <div className="flex items-center">
        <IconButton
          label={t('editor.undo')}
          shortcut="Mod+Z"
          disabled={!canUndo}
          onClick={() => session.undo.undo()}
        >
          <Undo2 size={18} />
        </IconButton>
        <IconButton
          label={t('editor.redo')}
          shortcut="Mod+Shift+Z"
          disabled={!canRedo}
          onClick={() => session.undo.redo()}
        >
          <Redo2 size={18} />
        </IconButton>
      </div>
      <SaveIndicator />
      <div className="flex-1" />
      <PresenceAvatars projectId={projectId} />
      <IconButton
        label={t('commands.open')}
        shortcut="Mod+K"
        onClick={() => useCommands.getState().setOpen(true)}
        data-tour="commands"
      >
        <Search size={18} />
      </IconButton>
      {visitor ? null : (
        <>
          {session.source.kind === 'server' ? <HistoryButton /> : null}
          <TransferMenu />
          {session.source.kind === 'server' ? (
            <LiveButton />
          ) : (
            <Soon label={t('live.guest')} icon={<Smartphone size={16} />} text={t('editor.test')} />
          )}
          {session.source.kind === 'server' ? (
            <ShareButton />
          ) : (
            <Soon
              label={t('editor.guestOnly')}
              icon={<Share2 size={16} />}
              text={t('editor.share')}
            />
          )}
          {session.source.kind === 'server' ? (
            <PublishButton />
          ) : (
            <Soon
              label={t('publish.guest')}
              icon={<Rocket size={16} />}
              text={t('editor.publish')}
              primary
            />
          )}
        </>
      )}
      <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
      <HelpButton />
      <ModeSwitch />
      <PrefsMenu />
    </header>
  )
}

function ShareButton() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Tooltip content={t('editor.share')}>
        <Button
          icon={<Share2 size={16} />}
          aria-label={t('editor.share')}
          onClick={() => setOpen(true)}
        >
          <span className="rx-bar-label">{t('editor.share')}</span>
        </Button>
      </Tooltip>
      {open ? <ShareDialog open onClose={() => setOpen(false)} /> : null}
    </>
  )
}

function PublishButton() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Tooltip content={t('editor.publish')}>
        <Button
          variant="primary"
          icon={<Rocket size={16} />}
          aria-label={t('editor.publish')}
          onClick={() => setOpen(true)}
          data-testid="publish-open"
        >
          <span className="rx-bar-label">{t('editor.publish')}</span>
        </Button>
      </Tooltip>
      {open ? <PublishDialog open onClose={() => setOpen(false)} /> : null}
    </>
  )
}

function HistoryButton() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <>
      <IconButton label={t('versions.open')} onClick={() => setOpen(true)}>
        <History size={18} />
      </IconButton>
      {open ? <VersionsDialog open onClose={() => setOpen(false)} /> : null}
    </>
  )
}

/** A button of a later milestone: focusable (so its tooltip explains why), but inert. */
function Soon({
  label,
  icon,
  text,
  primary,
}: {
  label: string
  icon: React.ReactNode
  text: string
  primary?: boolean
}) {
  return (
    <Tooltip content={label}>
      <Button
        variant={primary ? 'primary' : 'secondary'}
        icon={icon}
        aria-disabled="true"
        aria-label={text}
        className="cursor-not-allowed opacity-45 active:scale-100"
      >
        <span className="rx-bar-label">{text}</span>
      </Button>
    </Tooltip>
  )
}

function TabLink({
  tour,
  active,
  disabled,
  onClick,
  icon,
  children,
}: {
  tour?: string
  active: boolean
  disabled?: boolean
  onClick?: () => void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={active ? 'page' : undefined}
      data-tour={tour}
      className={cn(
        'inline-flex h-[calc(var(--h-control)-4px)] items-center gap-1.5 rounded-[calc(var(--radius)-2px)] px-3 font-strong text-muted transition-colors hover:text-text disabled:opacity-45 disabled:hover:text-muted',
        active && 'bg-surface text-text shadow-1',
      )}
    >
      {icon}
      {children}
    </button>
  )
}

/** The project name, editable in place. */
function ProjectName() {
  const { t } = useTranslation()
  const session = useSession()
  const name = useDoc().meta.name
  const [value, setValue] = useState(name)
  useEffect(() => setValue(name), [name])
  const commit = () => {
    const next = value.trim()
    if (next && next !== name) setMeta(session.ydoc, { name: next })
    else setValue(name)
  }
  return (
    <input
      aria-label={t('editor.projectName')}
      value={value}
      maxLength={80}
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') {
          setValue(name)
          event.currentTarget.blur()
        }
      }}
      className="h-control w-44 min-w-0 truncate rounded-ui border border-transparent bg-transparent px-2 font-strong outline-none hover:border-border focus:border-primary focus:bg-surface junior:w-52"
    />
  )
}

function SaveIndicator() {
  const { t } = useTranslation()
  const session = useSession()
  const state = useSaveState()
  const server = session.source.kind === 'server'
  const hint =
    state === 'offline'
      ? t('sync.offlineHint')
      : state === 'readonly'
        ? t('sync.readOnlyHint')
        : server
          ? t('sync.savedHint')
          : t('editor.savedHint')
  const label =
    state === 'saving'
      ? t('editor.saving')
      : state === 'offline'
        ? t('sync.offline')
        : state === 'readonly'
          ? t('sync.readOnly')
          : t('editor.saved')
  const Icon =
    state === 'saving'
      ? CloudUpload
      : state === 'offline'
        ? CloudOff
        : state === 'readonly'
          ? Eye
          : Cloud
  return (
    <Tooltip content={hint}>
      <span
        className={cn(
          'hidden shrink-0 items-center gap-1.5 whitespace-nowrap px-1 text-ui-sm text-muted lg:inline-flex',
          state === 'offline' && 'text-text',
        )}
        role="status"
        aria-live="polite"
        data-testid="save-state"
        data-state={state}
      >
        <Icon
          size={15}
          className={cn(
            state === 'saving' && 'text-primary-text',
            state === 'offline' && 'text-coral',
          )}
        />
        <span className="rx-save-label">{label}</span>
      </span>
    </Tooltip>
  )
}

/** Picks the screen (or, in Blocks, the shared `app` workspace) and manages screens. */
function ScreenPicker({
  projectId,
  tab,
  current,
}: {
  projectId: string
  tab: EditorTab
  current: WorkspaceKey
}) {
  const { t } = useTranslation()
  const session = useSession()
  const doc = useDoc()
  const go = useEditorNavigate(projectId)
  const [renaming, setRenaming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const isApp = current === APP_WORKSPACE
  const screen = isApp ? undefined : doc.screens[current]
  const start = doc.settings.navigation.startScreen
  const index = doc.screenOrder.indexOf(current)

  return (
    <div className="flex items-center gap-0.5">
      <Menu>
        <MenuTrigger asChild>
          <button
            type="button"
            aria-label={`${t('editor.screens.label')} : ${isApp ? t('editor.screens.appShort') : (screen?.name ?? '')}`}
            data-testid="screen-picker"
            className="inline-flex h-control max-w-48 items-center gap-2 rounded-ui border border-border bg-surface pr-2 pl-2.5 font-strong hover:border-border-strong"
          >
            <Smartphone size={15} className="shrink-0 text-muted" />
            <span className="truncate">{isApp ? t('editor.screens.appShort') : screen?.name}</span>
            <ChevronDown size={15} className="shrink-0 text-muted" />
          </button>
        </MenuTrigger>
        <MenuContent align="start">
          <MenuLabel>{t('editor.screens.manage')}</MenuLabel>
          {doc.screenOrder.map((id) => (
            <MenuItem
              key={id}
              icon={id === current ? <Check size={15} /> : null}
              onSelect={() => go({ screen: id })}
              shortcut={
                id === start ? <Star size={13} aria-label={t('editor.screens.start')} /> : null
              }
            >
              {doc.screens[id]?.name}
            </MenuItem>
          ))}
          {tab === 'blocks' ? (
            <>
              <MenuSeparator />
              <MenuItem
                icon={isApp ? <Check size={15} /> : null}
                onSelect={() => go({ screen: APP_WORKSPACE })}
              >
                {t('editor.screens.app')}
              </MenuItem>
            </>
          ) : null}
          <MenuSeparator />
          <MenuItem
            icon={<Plus size={15} />}
            onSelect={() => {
              const id = addNewScreen(session)
              go({ screen: id })
            }}
          >
            {t('editor.screens.add')}
          </MenuItem>
        </MenuContent>
      </Menu>
      {screen ? (
        <Menu>
          <MenuTrigger asChild>
            <IconButton label={`${t('editor.screens.manage')} : ${screen.name}`} size="sm">
              <MoreHorizontal size={16} />
            </IconButton>
          </MenuTrigger>
          <MenuContent align="start">
            <MenuItem icon={<Pencil size={15} />} onSelect={() => setRenaming(true)}>
              {t('editor.screens.rename')}
            </MenuItem>
            <MenuItem
              icon={<Star size={15} />}
              disabled={current === start}
              onSelect={() => setStartScreen(session.ydoc, current)}
            >
              {t('editor.screens.setStart')}
            </MenuItem>
            <MenuItem
              icon={<Copy size={15} />}
              onSelect={() => {
                const id = duplicateScreen(session.ydoc, current)
                go({ screen: id })
              }}
            >
              {t('common.duplicate')}
            </MenuItem>
            <MenuItem
              icon={<ArrowUp size={15} />}
              disabled={index <= 0}
              onSelect={() => moveScreen(session.ydoc, current, index - 1)}
            >
              {t('editor.screens.moveUp')}
            </MenuItem>
            <MenuItem
              icon={<ArrowDown size={15} />}
              disabled={index >= doc.screenOrder.length - 1}
              onSelect={() => moveScreen(session.ydoc, current, index + 1)}
            >
              {t('editor.screens.moveDown')}
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              icon={<Trash2 size={15} />}
              danger
              onSelect={() => {
                if (doc.screenOrder.length <= 1) toast(t('editor.screens.lastScreen'))
                else setDeleting(true)
              }}
            >
              {t('common.delete')}
            </MenuItem>
          </MenuContent>
        </Menu>
      ) : null}
      {screen ? (
        <RenameDialog
          open={renaming}
          initial={screen.name}
          taken={Object.entries(doc.screens)
            .filter(([id]) => id !== current)
            .map(([, s]) => s.name)
            .concat(
              Object.entries(screen.components)
                .filter(([id]) => id !== screen.rootId)
                .map(([, c]) => c.name),
            )}
          onClose={() => setRenaming(false)}
          onSubmit={(name) => {
            renameScreen(session.ydoc, current, name)
            setRenaming(false)
          }}
        />
      ) : null}
      <Dialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t('editor.screens.deleteTitle', { name: screen?.name ?? '' })}
        description={t('editor.screens.deleteText')}
      >
        <div className="flex justify-end gap-2">
          <Button onClick={() => setDeleting(false)}>{t('common.cancel')}</Button>
          <Button
            variant="danger"
            onClick={() => {
              const next = doc.screenOrder[index === 0 ? 1 : index - 1]
              removeScreen(session.ydoc, current)
              setDeleting(false)
              go({ screen: next })
            }}
          >
            {t('common.delete')}
          </Button>
        </div>
      </Dialog>
    </div>
  )
}

export function RenameDialog(props: {
  open: boolean
  initial: string
  taken: string[]
  onClose: () => void
  onSubmit: (name: string) => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(props.initial)
  useEffect(() => {
    if (props.open) setName(props.initial)
  }, [props.open, props.initial])
  const valid = isValidName(name) && !props.taken.includes(name)
  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => !open && props.onClose()}
      title={t('editor.screens.rename')}
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (valid) props.onSubmit(name)
        }}
      >
        <label htmlFor="screen-name" className="flex flex-col gap-1.5">
          <span className="text-ui-sm font-strong">{t('editor.inspector.screenName')}</span>
          <Input
            id="screen-name"
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={!valid}
          />
        </label>
        {!valid ? (
          <p className="text-ui-sm text-danger">{t('editor.inspector.nameInvalid')}</p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button onClick={props.onClose}>{t('common.cancel')}</Button>
          <Button type="submit" variant="primary" disabled={!valid}>
            {t('common.rename')}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
