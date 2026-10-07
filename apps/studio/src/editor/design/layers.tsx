import { componentLabel } from '@rublox/catalog'
import {
  type ComponentId,
  isValidName,
  moveComponent,
  renameComponent,
  renameScreen,
  type Screen,
  type ScreenId,
  setComponentFlag,
} from '@rublox/schema'
import { Copy, Eye, EyeOff, Lock, LockOpen, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn.ts'
import { usePrefs } from '../../lib/prefs.ts'
import { addComponentOfType, deleteComponent, duplicate, moveComponentTo } from '../actions.ts'
import { ComponentIcon } from '../component-icon.tsx'
import { useDoc, useSession } from '../context.tsx'
import { useEditor } from '../store.ts'
import { currentDrag, endDrag, isContainer, parentOf, startDrag, validTarget } from './dnd.ts'
import { touchDrag } from './touch-drag.ts'

type Row = { id: ComponentId; depth: number }
type Zone = { id: ComponentId; where: 'before' | 'after' | 'inside' }

function flatten(screen: Screen): Row[] {
  const rows: Row[] = []
  const visit = (id: ComponentId, depth: number) => {
    rows.push({ id, depth })
    for (const child of screen.components[id]?.children ?? []) visit(child, depth + 1)
  }
  visit(screen.rootId, 0)
  return rows
}

/**
 * The component tree of the screen (SPEC § 4.1). Keyboard: arrows to move the selection,
 * Space to grab then arrows to move, Alt + arrows to move directly, F2 to rename.
 */
export function Layers({ screenId }: { screenId: ScreenId }) {
  const { t } = useTranslation()
  const session = useSession()
  const doc = useDoc()
  const locale = usePrefs((s) => s.locale)
  const { selected, select, hover, announce } = useEditor()
  const screen = doc.screens[screenId]
  const [renaming, setRenaming] = useState<ComponentId | null>(null)
  const [zone, setZone] = useState<Zone | null>(null)
  const grab = useRef<{ id: ComponentId; from: { parentId: ComponentId; index: number } } | null>(
    null,
  )
  const [grabbed, setGrabbed] = useState<ComponentId | null>(null)
  const treeRef = useRef<HTMLDivElement>(null)
  if (!screen) return null
  const rows = flatten(screen)
  const current = selected && screen.components[selected] ? selected : screen.rootId

  const focusRow = (id: ComponentId) => {
    requestAnimationFrame(() =>
      treeRef.current?.querySelector<HTMLElement>(`[data-layer="${CSS.escape(id)}"]`)?.focus(),
    )
  }

  const name = (id: ComponentId) => screen.components[id]?.name ?? ''

  /** Moves a component one place, for keyboard moves. */
  const step = (id: ComponentId, direction: 'up' | 'down' | 'out' | 'in') => {
    const at = parentOf(screen, id)
    if (!at) return
    const siblings = screen.components[at.parentId]?.children ?? []
    if (direction === 'up' && at.index > 0)
      moveComponent(session.ydoc, screenId, id, at.parentId, at.index - 1)
    if (direction === 'down' && at.index < siblings.length - 1)
      moveComponent(session.ydoc, screenId, id, at.parentId, at.index + 2)
    if (direction === 'out' && at.parentId !== screen.rootId) {
      const outer = parentOf(screen, at.parentId)
      if (outer) moveComponent(session.ydoc, screenId, id, outer.parentId, outer.index + 1)
    }
    if (direction === 'in') {
      const previous = siblings[at.index - 1]
      if (previous && isContainer(screen, previous)) {
        moveComponent(
          session.ydoc,
          screenId,
          id,
          previous,
          screen.components[previous]?.children?.length ?? 0,
        )
      }
    }
    announce(t('editor.design.moved', { name: name(id) }))
    focusRow(id)
  }

  const onKeyDown = (event: React.KeyboardEvent, id: ComponentId) => {
    if (renaming) return
    const index = rows.findIndex((row) => row.id === id)
    const isRoot = id === screen.rootId
    if (grabbed) {
      const directions: Record<string, 'up' | 'down' | 'out' | 'in'> = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'out',
        ArrowRight: 'in',
      }
      const direction = directions[event.key]
      if (direction) {
        event.preventDefault()
        step(grabbed, direction)
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        announce(t('editor.design.dropped', { name: name(grabbed) }))
        grab.current = null
        setGrabbed(null)
      } else if (event.key === 'Escape') {
        event.preventDefault()
        const origin = grab.current
        if (origin) {
          const at = parentOf(screen, origin.id)
          const index =
            at && at.parentId === origin.from.parentId && at.index < origin.from.index
              ? origin.from.index + 1
              : origin.from.index
          moveComponent(session.ydoc, screenId, origin.id, origin.from.parentId, index)
          focusRow(origin.id)
        }
        announce(t('editor.design.cancelled'))
        grab.current = null
        setGrabbed(null)
      }
      return
    }
    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault()
      if (!isRoot) step(id, event.key === 'ArrowUp' ? 'up' : 'down')
      return
    }
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault()
        const next = rows[index + (event.key === 'ArrowDown' ? 1 : -1)]
        if (next) {
          select(next.id)
          focusRow(next.id)
        }
        return
      }
      case 'Home':
      case 'End': {
        event.preventDefault()
        const next = event.key === 'Home' ? rows[0] : rows.at(-1)
        if (next) {
          select(next.id)
          focusRow(next.id)
        }
        return
      }
      case ' ':
        event.preventDefault()
        if (!isRoot && !screen.components[id]?.locked) {
          const from = parentOf(screen, id)
          if (from) {
            grab.current = { id, from }
            setGrabbed(id)
            announce(t('editor.design.grabbed', { name: name(id) }))
          }
        }
        return
      case 'F2':
        event.preventDefault()
        setRenaming(id)
        return
      case 'Delete':
      case 'Backspace':
        event.preventDefault()
        if (!isRoot) {
          deleteComponent(session, screenId, id)
          focusRow(useEditor.getState().selected ?? screen.rootId)
        }
        return
    }
  }

  const zoneAt = (event: React.DragEvent, id: ComponentId): Zone => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const ratio = (event.clientY - rect.top) / rect.height
    if (id === screen.rootId) return { id, where: 'inside' }
    if (isContainer(screen, id) && ratio > 0.3 && ratio < 0.7) return { id, where: 'inside' }
    return { id, where: ratio < 0.5 ? 'before' : 'after' }
  }

  const targetOf = (z: Zone) => {
    if (z.where === 'inside')
      return { parentId: z.id, index: screen.components[z.id]?.children?.length ?? 0 }
    const at = parentOf(screen, z.id)
    if (!at) return null
    return { parentId: at.parentId, index: at.index + (z.where === 'after' ? 1 : 0) }
  }

  return (
    <section aria-label={t('editor.layers.title')} className="flex min-h-0 flex-1 flex-col">
      <div
        ref={treeRef}
        role="tree"
        aria-label={t('editor.layers.title')}
        aria-description={t('editor.layers.moveHint')}
        className="min-h-0 flex-1 overflow-y-auto p-1.5"
        onDragLeave={(event) => {
          if (!treeRef.current?.contains(event.relatedTarget as Node)) setZone(null)
        }}
      >
        {rows.map(({ id, depth }) => {
          const node = screen.components[id]
          if (!node) return null
          const isRoot = id === screen.rootId
          const active = id === current
          const container = isContainer(screen, id)
          return (
            <div
              key={id}
              role="treeitem"
              aria-level={depth + 1}
              aria-selected={active}
              aria-expanded={container ? true : undefined}
              aria-grabbed={grabbed === id ? true : undefined}
              aria-label={`${node.name}, ${componentLabel(node.type, locale)}`}
              data-layer={id}
              data-testid={`layer-${node.name}`}
              tabIndex={active ? 0 : -1}
              draggable={!isRoot && !node.locked && renaming !== id}
              onDragStart={(event) => startDrag(event, { kind: 'move', id })}
              onPointerDown={
                !isRoot && !node.locked && renaming !== id
                  ? touchDrag(() => ({ kind: 'move', id }), node.name)
                  : undefined
              }
              onDragEnd={() => {
                endDrag()
                setZone(null)
              }}
              onDragOver={(event) => {
                const payload = currentDrag()
                if (!payload) return
                const z = zoneAt(event, id)
                const target = targetOf(z)
                if (!target || !validTarget(screen, payload, target)) {
                  setZone(null)
                  return
                }
                event.preventDefault()
                event.stopPropagation()
                setZone(z)
              }}
              onDrop={(event) => {
                event.preventDefault()
                const payload = currentDrag()
                const z = zone ?? zoneAt(event, id)
                const target = targetOf(z)
                setZone(null)
                endDrag()
                if (!payload || !target || !validTarget(screen, payload, target)) return
                if (payload.kind === 'new')
                  addComponentOfType(session, screenId, payload.type, locale, target)
                else {
                  moveComponentTo(session, screenId, payload.id, target)
                  select(payload.id)
                }
              }}
              onClick={() => select(id)}
              onDoubleClick={() => setRenaming(id)}
              onMouseEnter={() => hover(id)}
              onMouseLeave={() => hover(null)}
              onKeyDown={(event) => onKeyDown(event, id)}
              title={t('editor.layers.renameHint')}
              className={cn(
                'group relative flex h-control-sm cursor-default items-center gap-1.5 rounded-[calc(var(--radius)-2px)] pr-1 text-ui-sm outline-none select-none junior:text-ui',
                active ? 'bg-primary-soft text-primary-text' : 'hover:bg-surface-2',
                grabbed === id && 'ring-2 ring-coral',
                zone?.id === id && zone.where === 'inside' && 'ring-2 ring-coral',
                'focus-visible:ring-2 focus-visible:ring-primary',
                node.hidden && 'opacity-55',
              )}
              style={{ paddingLeft: 6 + depth * 14 }}
            >
              {zone?.id === id && zone.where !== 'inside' ? (
                <span
                  className={cn(
                    'absolute right-1 h-0.5 rounded bg-coral',
                    zone.where === 'before' ? '-top-px' : '-bottom-px',
                  )}
                  style={{ left: 6 + depth * 14 }}
                />
              ) : null}
              <ComponentIcon
                type={node.type}
                size={14}
                className={cn('shrink-0', active ? '' : 'text-muted')}
              />
              {renaming === id ? (
                <RenameInput
                  initial={node.name}
                  taken={Object.entries(screen.components)
                    .filter(([other]) => other !== id)
                    .map(([, c]) => c.name)
                    .concat(
                      isRoot
                        ? Object.entries(doc.screens)
                            .filter(([sid]) => sid !== screenId)
                            .map(([, s]) => s.name)
                        : [],
                    )}
                  onDone={(next) => {
                    setRenaming(null)
                    if (next && next !== node.name) {
                      if (isRoot) renameScreen(session.ydoc, screenId, next)
                      else renameComponent(session.ydoc, screenId, id, next)
                    }
                    focusRow(id)
                  }}
                />
              ) : (
                <span className="min-w-0 flex-1 truncate">{node.name}</span>
              )}
              {!isRoot && renaming !== id ? (
                <span
                  className={cn(
                    'flex items-center',
                    !active && !node.hidden && !node.locked && 'opacity-0 group-hover:opacity-100',
                  )}
                >
                  <RowAction
                    label={node.hidden ? t('editor.layers.show') : t('editor.layers.hide')}
                    onClick={() =>
                      setComponentFlag(session.ydoc, screenId, id, 'hidden', !node.hidden)
                    }
                  >
                    {node.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                  </RowAction>
                  <RowAction
                    label={node.locked ? t('editor.layers.unlock') : t('editor.layers.lock')}
                    onClick={() =>
                      setComponentFlag(session.ydoc, screenId, id, 'locked', !node.locked)
                    }
                  >
                    {node.locked ? <Lock size={13} /> : <LockOpen size={13} />}
                  </RowAction>
                  {active ? (
                    <>
                      <RowAction
                        label={t('common.duplicate')}
                        onClick={() => duplicate(session, screenId, id)}
                      >
                        <Copy size={13} />
                      </RowAction>
                      <RowAction
                        label={t('common.delete')}
                        onClick={() => deleteComponent(session, screenId, id)}
                      >
                        <Trash2 size={13} />
                      </RowAction>
                    </>
                  ) : null}
                </span>
              ) : null}
            </div>
          )
        })}
      </div>
      <p className="border-t border-border px-3 py-2 text-[11px] leading-snug text-muted junior:text-ui-sm">
        {t('editor.layers.moveHint')}
      </p>
    </section>
  )
}

function RowAction({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className="grid size-6 place-items-center rounded text-muted hover:bg-surface-3 hover:text-text"
    >
      {children}
    </button>
  )
}

function RenameInput({
  initial,
  taken,
  onDone,
}: {
  initial: string
  taken: string[]
  onDone: (name: string | null) => void
}) {
  const [value, setValue] = useState(initial)
  const valid = isValidName(value) && !taken.includes(value)
  return (
    <input
      // biome-ignore lint/a11y/noAutofocus: renaming starts on purpose (double-click, F2)
      autoFocus
      value={value}
      aria-invalid={!valid}
      onChange={(event) => setValue(event.target.value)}
      onFocus={(event) => event.target.select()}
      onBlur={() => onDone(valid ? value : null)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Enter') onDone(valid ? value : null)
        if (event.key === 'Escape') onDone(null)
      }}
      className={cn(
        'h-6 min-w-0 flex-1 rounded border bg-surface px-1 text-text outline-none',
        valid ? 'border-primary' : 'border-danger',
      )}
    />
  )
}
