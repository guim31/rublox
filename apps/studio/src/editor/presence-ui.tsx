import { APP_WORKSPACE, type ComponentId, type ScreenId, type WorkspaceKey } from '@rublox/schema'
import { Eye } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Avatar } from '../components/avatar.tsx'
import { MenuContent, MenuLabel } from '../components/ui/menu.tsx'
import { Tooltip } from '../components/ui/tooltip.tsx'
import { cn } from '../lib/cn.ts'
import { usePrefs } from '../lib/prefs.ts'
import type { EditorTab } from '../routes/p.$projectId.tsx'
import { useDoc, useSession } from './context.tsx'
import { useEditorNavigate } from './nav.ts'
import { type Peer, type PeerView, peerStyle, usePeers, usePeople } from './presence.ts'
import { useEditor } from './store.ts'

/** Shares where this tab is and what it selects (Design), for the others' presence. */
export function PresenceSync({ tab, workspace }: { tab: EditorTab; workspace: WorkspaceKey }) {
  const presence = useSession().presence
  const selection = useEditor((s) => s.selection)
  useEffect(() => {
    presence?.set({ view: { tab, screen: workspace } })
  }, [presence, tab, workspace])
  useEffect(() => {
    presence?.set({ selection: tab === 'design' ? selection : [] })
    if (tab !== 'blocks') presence?.set({ block: null })
  }, [presence, tab, selection])
  return null
}

/** "Design · Home": a peer's tab and screen. */
function usePlace() {
  const { t } = useTranslation()
  const doc = useDoc()
  return (view: PeerView | null) => {
    if (!view) return t('collab.presence.nowhere')
    const screen =
      view.screen === APP_WORKSPACE
        ? t('collab.presence.app')
        : (doc.screens[view.screen]?.name ?? '')
    return t('collab.presence.where', { tab: t(`collab.presence.tabs.${view.tab}`), screen })
  }
}

const MAX_AVATARS = 4

/**
 * The people in the project (SPEC § 4.9, § 5.3: "présents"): their avatars in the top bar,
 * ringed with their colour; the menu says where each one is and takes you there.
 */
export function PresenceAvatars({ projectId }: { projectId: string }) {
  const { t } = useTranslation()
  const people = usePeople()
  const junior = usePrefs((s) => s.mode) === 'junior'
  const place = usePlace()
  const go = useEditorNavigate(projectId)
  if (people.length === 0) return null
  const size = junior ? 30 : 26
  const shown = people.slice(0, MAX_AVATARS)
  const label = t('collab.presence.count', { count: people.length })
  return (
    <DropdownMenu.Root>
      <Tooltip content={label}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label={label}
            data-testid="presence"
            data-count={people.length}
            className="flex h-control shrink-0 items-center rounded-full px-1 hover:bg-surface-2"
          >
            {shown.map((person, index) => (
              <span
                key={person.user.id}
                style={peerStyle(person.color)}
                className={cn(
                  'relative rounded-full bg-surface p-[2px] ring-2 ring-(--peer-line)',
                  index > 0 && '-ml-1.5',
                )}
                data-testid="presence-avatar"
                data-user={person.user.name}
              >
                <Avatar id={person.user.avatar} name={person.user.name} size={size} />
                {person.user.readOnly ? (
                  <span className="absolute -right-1 -bottom-1 grid size-4 place-items-center rounded-full border border-border bg-surface text-muted">
                    <Eye size={10} aria-hidden="true" />
                  </span>
                ) : null}
              </span>
            ))}
            {people.length > MAX_AVATARS ? (
              <span className="-ml-1.5 grid h-7 min-w-7 place-items-center rounded-full border-2 border-surface bg-surface-2 px-1 text-ui-sm font-strong">
                {t('collab.presence.more', { count: people.length - MAX_AVATARS })}
              </span>
            ) : null}
          </button>
        </DropdownMenu.Trigger>
      </Tooltip>
      <MenuContent>
        <MenuLabel>{t('collab.presence.title')}</MenuLabel>
        {people.map((person) => {
          const view = person.peers.find((peer) => peer.view)?.view ?? null
          return (
            <DropdownMenu.Item
              key={person.user.id}
              disabled={!view}
              onSelect={() => view && go({ tab: view.tab, screen: view.screen })}
              title={t('collab.presence.joinHint', { name: person.user.name })}
              style={peerStyle(person.color)}
              data-testid="presence-person"
              className="flex min-w-60 cursor-pointer select-none items-center gap-2.5 rounded-[calc(var(--radius)-2px)] px-2.5 py-1.5 outline-none data-[highlighted]:bg-surface-2 data-[disabled]:cursor-default"
            >
              <span className="rounded-full p-[2px] ring-2 ring-(--peer-line)">
                <Avatar id={person.user.avatar} name={person.user.name} size={28} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-strong">{person.user.name}</span>
                <span className="truncate text-ui-sm text-muted">
                  {person.peers.map((peer) => place(peer.view)).join(' — ')}
                </span>
              </span>
              {person.user.readOnly ? (
                <span className="inline-flex shrink-0 items-center gap-1 text-ui-sm text-muted">
                  <Eye size={14} aria-hidden="true" />
                  {t('collab.presence.readOnly')}
                </span>
              ) : view ? (
                <span className="shrink-0 text-ui-sm font-strong text-primary-text">
                  {t('collab.presence.join')}
                </span>
              ) : null}
            </DropdownMenu.Item>
          )
        })}
      </MenuContent>
    </DropdownMenu.Root>
  )
}

/** The peers in Design on this screen. */
export function usePeersOnScreen(screenId: ScreenId): Peer[] {
  const peers = usePeers()
  return useMemo(
    () =>
      peers.filter(
        (peer) =>
          peer.view?.tab === 'design' && peer.view.screen === screenId && peer.selection.length,
      ),
    [peers, screenId],
  )
}

type Box = { left: number; top: number; width: number; height: number }

/**
 * The components the others selected, outlined in their colour on the canvas, with their name
 * on the right of the phone (one's own names are on the left).
 */
export function PeerSelections({
  screenId,
  boxOf,
}: {
  screenId: ScreenId
  boxOf: (id: ComponentId) => Box | undefined
}) {
  const { t } = useTranslation()
  const peers = usePeersOnScreen(screenId)
  const [boxes, setBoxes] = useState<{ peer: Peer; id: ComponentId; box: Box }[]>([])
  // Follows the drawn components, like one's own selection (layout, fonts, images).
  useEffect(() => {
    if (peers.length === 0) {
      setBoxes([])
      return
    }
    let frame = 0
    let last = ''
    const loop = () => {
      const next = peers.flatMap((peer) =>
        peer.selection.flatMap((id) => {
          const box = boxOf(id)
          return box ? [{ peer, id, box }] : []
        }),
      )
      const key = JSON.stringify(next.map((entry) => [entry.peer.clientId, entry.id, entry.box]))
      if (key !== last) {
        last = key
        setBoxes(next)
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [peers, boxOf])
  if (boxes.length === 0) return null
  const labelled = new Set<number>()
  return (
    <div className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
      {boxes.map(({ peer, id, box }) => {
        const first = !labelled.has(peer.clientId)
        labelled.add(peer.clientId)
        return (
          <div key={`${peer.clientId}:${id}`} style={peerStyle(peer.color)}>
            <div
              className="absolute rounded-[3px] outline-2 outline-(--peer-line)"
              style={box}
              data-testid="peer-selection"
              data-user={peer.user.name}
              title={t('collab.presence.selects', { name: peer.user.name })}
            />
            {first ? (
              <span
                className="absolute left-[calc(100%+14px)] flex h-6 items-center rounded-md bg-(--peer) px-2 text-[12px] font-semibold whitespace-nowrap text-white shadow-1"
                style={{ top: box.top }}
                data-testid="peer-label"
              >
                {peer.user.name}
                <span
                  aria-hidden="true"
                  className="absolute top-1/2 right-full h-px bg-(--peer-line)"
                  style={{ width: 14 }}
                />
              </span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
