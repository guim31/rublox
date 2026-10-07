import { componentLabel, getComponentDef } from '@rublox/catalog'
import { AppIcon, AppSurface, navigationItems, ScreenView } from '@rublox/runtime'
import { type ComponentId, type Screen, type ScreenId, setProp } from '@rublox/schema'
import { GripVertical, Minus, Moon, Plus, RotateCcw, Scan, Sun } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PhoneFrame } from '../../components/phone.tsx'
import { IconButton } from '../../components/ui/button.tsx'
import { Select } from '../../components/ui/input.tsx'
import { Tooltip } from '../../components/ui/tooltip.tsx'
import { cn } from '../../lib/cn.ts'
import { usePrefs } from '../../lib/prefs.ts'
import { addComponentOfType, moveComponentTo } from '../actions.ts'
import { ComponentIcon } from '../component-icon.tsx'
import { useAssetsVersion, useDoc, useSession } from '../context.tsx'
import { DEVICES, type Device, useEditor } from '../store.ts'
import {
  axisOf,
  currentDrag,
  type DropTarget,
  endDrag,
  indexAt,
  isContainer,
  startDrag,
  validTarget,
} from './dnd.ts'
import { touchDrag } from './touch-drag.ts'

type Box = { left: number; top: number; width: number; height: number }

const ZOOMS = [50, 67, 75, 90, 100, 125, 150, 200]
const MIN_ZOOM = 50
const MAX_ZOOM = 200

/** The screen in a phone frame (SPEC § 4.1): select, hover, drop, resize. */
export function Canvas({ screenId }: { screenId: ScreenId }) {
  const { t } = useTranslation()
  const doc = useDoc()
  const session = useSession()
  useAssetsVersion()
  const screen = doc.screens[screenId]
  const { device, landscape, zoom, appScheme, selected, hovered, set, select, hover } = useEditor()
  const locale = usePrefs((s) => s.locale)
  const areaRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const screenRef = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState(1)
  const [drop, setDrop] = useState<(DropTarget & { line: Box }) | null>(null)
  const [boxes, setBoxes] = useState<{ selected?: Box; hovered?: Box; parent?: Box }>({})

  const size = DEVICES[device]
  const width = landscape ? size.height : size.width
  const height = landscape ? size.width : size.height
  const scale = zoom === 'fit' ? fit : zoom / 100

  // Fit the phone to the available space.
  useLayoutEffect(() => {
    const area = areaRef.current
    if (!area) return
    const update = () => {
      const next = Math.min(
        (area.clientWidth - 64) / (width + 24),
        (area.clientHeight - 64) / (height + 24),
        1,
      )
      setFit(Math.max(0.3, Math.round(next * 100) / 100))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(area)
    return () => observer.disconnect()
  }, [width, height])

  const elementOf = useCallback(
    (id: ComponentId | null) =>
      id
        ? (screenRef.current?.querySelector<HTMLElement>(`[data-rx-id="${CSS.escape(id)}"]`) ??
          null)
        : null,
    [],
  )

  const boxOf = useCallback((element: Element | null): Box | undefined => {
    const stage = stageRef.current
    if (!element || !stage) return undefined
    const r = element.getBoundingClientRect()
    const s = stage.getBoundingClientRect()
    return { left: r.left - s.left, top: r.top - s.top, width: r.width, height: r.height }
  }, [])

  // Keep the overlay boxes in sync with the drawn components (layout changes, fonts, images).
  useEffect(() => {
    let frame = 0
    let last = ''
    const loop = () => {
      const next = {
        selected: boxOf(elementOf(selected)),
        hovered: hovered !== selected ? boxOf(elementOf(hovered)) : undefined,
      }
      const key = JSON.stringify(next)
      if (key !== last) {
        last = key
        setBoxes(next)
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [selected, hovered, boxOf, elementOf])

  if (!screen) return null

  const componentAt = (target: EventTarget | null): ComponentId | null => {
    const element = (target as HTMLElement | null)?.closest?.('[data-rx-id]')
    const id = element?.getAttribute('data-rx-id') ?? null
    if (id && screen.components[id]?.locked) return null
    return id
  }

  const computeDrop = (event: React.DragEvent): (DropTarget & { line: Box }) | null => {
    const payload = currentDrag()
    if (!payload) return null
    let id = componentAt(event.target) ?? screen.rootId
    const point = { x: event.clientX, y: event.clientY }
    let parentId: ComponentId
    if (isContainer(screen, id) && !(payload.kind === 'move' && payload.id === id)) {
      parentId = id
    } else {
      const parentEl = elementOf(id)?.parentElement?.closest('[data-rx-id]')
      parentId = parentEl?.getAttribute('data-rx-id') ?? screen.rootId
      id = parentId
    }
    const parentEl = elementOf(parentId)
    if (!parentEl) return null
    const children = [...parentEl.querySelectorAll(':scope > [data-rx-id]')]
    const rects = children.map((child) => child.getBoundingClientRect())
    const axis = axisOf(screen, parentId)
    const index = indexAt(rects, point, axis)
    const target = { parentId, index }
    if (!validTarget(screen, payload, target)) return null
    // The insertion line, between two children (or inside an empty container).
    const parentBox = boxOf(parentEl)
    if (!parentBox) return null
    const before = children[index - 1] ? boxOf(children[index - 1] as Element) : undefined
    const after = children[index] ? boxOf(children[index] as Element) : undefined
    let line: Box
    if (axis === 'y') {
      const y =
        before && after
          ? (before.top + before.height + after.top) / 2
          : before
            ? before.top + before.height + 2
            : after
              ? after.top - 2
              : parentBox.top + 8
      const ref = before ?? after ?? parentBox
      line = { left: ref.left, top: y - 1.5, width: ref.width, height: 3 }
    } else {
      const x =
        before && after
          ? (before.left + before.width + after.left) / 2
          : before
            ? before.left + before.width + 2
            : after
              ? after.left - 2
              : parentBox.left + 8
      const ref = before ?? after ?? parentBox
      line = { left: x - 1.5, top: ref.top, width: 3, height: ref.height }
    }
    return { ...target, line }
  }

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault()
    const payload = currentDrag()
    const target = computeDrop(event)
    setDrop(null)
    endDrag()
    if (!payload || !target) return
    const where = { parentId: target.parentId, index: target.index }
    if (payload.kind === 'new') addComponentOfType(session, screenId, payload.type, locale, where)
    else {
      moveComponentTo(session, screenId, payload.id, where)
      select(payload.id)
    }
  }

  const selectedNode = selected ? screen.components[selected] : undefined
  const canEditBox = selectedNode && selected !== screen.rootId && !selectedNode.locked

  return (
    <section
      aria-label={t('editor.design.canvas')}
      className="flex h-full min-w-0 flex-col bg-canvas"
    >
      <CanvasToolbar
        device={device}
        landscape={landscape}
        zoom={zoom}
        fit={fit}
        appScheme={appScheme}
        set={set}
      />
      {/* biome-ignore lint/a11y/noStaticElementInteractions: drop zone for pointer drags; keyboard moves happen in the layers */}
      <div
        ref={areaRef}
        className="relative min-h-0 flex-1 overflow-auto"
        onDragOver={(event) => {
          if (!currentDrag()) return
          event.preventDefault()
          if (event.dataTransfer)
            event.dataTransfer.dropEffect = currentDrag()?.kind === 'new' ? 'copy' : 'move'
          setDrop(computeDrop(event))
        }}
        onDragLeave={(event) => {
          if (!areaRef.current?.contains(event.relatedTarget as Node)) setDrop(null)
        }}
        onDrop={onDrop}
      >
        <div className="flex min-h-full min-w-full flex-col items-center justify-center gap-4 p-8">
          <div ref={stageRef} className="relative">
            <PhoneFrame width={width} height={height} scale={scale} dark={appScheme === 'dark'}>
              <AppSurface theme={doc.settings.theme} scheme={appScheme}>
                <div className="flex size-full flex-col">
                  {/* biome-ignore lint/a11y/noStaticElementInteractions: pointer selection; the layers panel is the keyboard path */}
                  {/* biome-ignore lint/a11y/useKeyWithClickEvents: same */}
                  <div
                    ref={screenRef}
                    className="min-h-0 flex-1"
                    data-testid="canvas-screen"
                    onClick={(event) => select(componentAt(event.target) ?? screen.rootId)}
                    onMouseMove={(event) => {
                      const id = componentAt(event.target)
                      if (id !== useEditor.getState().hovered) hover(id)
                    }}
                    onMouseLeave={() => hover(null)}
                  >
                    <ScreenView
                      screen={screen}
                      locale={doc.meta.locale}
                      mode="design"
                      assetUrl={session.assetUrl}
                      decorateChildren={(parentId, children) =>
                        children.length
                          ? children
                          : [<EmptyHint key="empty" root={parentId === screen.rootId} />]
                      }
                    />
                  </div>
                  <TabBarPreview screenId={screenId} />
                </div>
              </AppSurface>
            </PhoneFrame>
            <Overlay
              boxes={boxes}
              drop={drop?.line}
              selectedLabel={selectedNode ? `${selectedNode.name}` : ''}
              canMove={Boolean(canEditBox)}
              canResize={Boolean(canEditBox)}
              onDragHandle={(event) => selected && startDrag(event, { kind: 'move', id: selected })}
              onTouchHandle={touchDrag(
                () => (selected ? { kind: 'move', id: selected } : null),
                selectedNode?.name ?? '',
                true,
              )}
              onResize={(dimension, value) => {
                if (!selected) return
                if (dimension !== 'height')
                  setProp(
                    session.ydoc,
                    screenId,
                    selected,
                    'width',
                    Math.round(value.width / scale),
                  )
                if (dimension !== 'width')
                  setProp(
                    session.ydoc,
                    screenId,
                    selected,
                    'height',
                    Math.round(value.height / scale),
                  )
              }}
              hoveredLabel={
                hovered && hovered !== selected ? (screen.components[hovered]?.name ?? '') : ''
              }
            />
          </div>
          <NonVisualTray screen={screen} selected={selected} onSelect={select} />
        </div>
      </div>
    </section>
  )
}

/** With tab navigation, the tab bar the app will show under this screen (not interactive). */
function TabBarPreview({ screenId }: { screenId: ScreenId }) {
  const doc = useDoc()
  const navigation = doc.settings.navigation
  if (navigation.kind !== 'tabs') return null
  const screens = (navigation.items?.map((item) => item.screen) ?? doc.screenOrder).filter(
    (id) => doc.screens[id],
  )
  if (!screens.includes(screenId)) return null
  return (
    <div className="rx-tabs" aria-hidden="true" data-testid="canvas-tabs">
      {navigationItems(doc, screens).map((item) => (
        <span
          key={item.screen}
          className="rx-tab"
          aria-current={item.screen === screenId ? 'page' : undefined}
        >
          <AppIcon name={item.icon} size={22} />
          <span>{item.label}</span>
        </span>
      ))}
    </div>
  )
}

/** Non-visual components (timer, sound, sensors…), listed under the phone (SPEC § 3). */
function NonVisualTray({
  screen,
  selected,
  onSelect,
}: {
  screen: Screen
  selected: ComponentId | null
  onSelect: (id: ComponentId) => void
}) {
  const { t } = useTranslation('catalog')
  const locale = usePrefs((s) => s.locale)
  if (!screen.nonVisual.length) return null
  return (
    <section
      aria-label={t('studio.nonVisual.title')}
      className="flex max-w-[480px] flex-wrap items-center justify-center gap-1.5"
      data-testid="non-visual-tray"
    >
      <span className="w-full text-center text-ui-sm text-muted">
        {t('studio.nonVisual.title')}
      </span>
      {screen.nonVisual.map((id) => {
        const node = screen.components[id]
        if (!node) return null
        return (
          <button
            key={id}
            type="button"
            data-rx-id={id}
            aria-pressed={selected === id}
            title={componentLabel(node.type, locale)}
            onClick={() => onSelect(id)}
            className={cn(
              'inline-flex h-control-sm items-center gap-1.5 rounded-full border bg-surface px-3 text-ui-sm font-strong shadow-1',
              selected === id
                ? 'border-primary text-primary-text ring-2 ring-primary/25'
                : 'border-border hover:border-border-strong',
            )}
          >
            <ComponentIcon type={node.type} size={14} />
            {node.name}
          </button>
        )
      })}
    </section>
  )
}

function EmptyHint({ root }: { root: boolean }) {
  const { t } = useTranslation()
  return (
    <div
      className={cn(
        'pointer-events-none flex items-center justify-center rounded-xl border-2 border-dashed border-current/25 text-center text-[14px] opacity-70',
        root ? 'min-h-40 flex-1 p-6' : 'min-h-12 min-w-20 p-2',
      )}
      style={{ color: 'var(--rx-muted)' }}
    >
      {root ? t('editor.design.emptyScreen') : t('editor.design.dropHere')}
    </div>
  )
}

function Overlay(props: {
  boxes: { selected?: Box; hovered?: Box }
  drop?: Box
  selectedLabel: string
  hoveredLabel: string
  canMove: boolean
  canResize: boolean
  onDragHandle: (event: React.DragEvent) => void
  onTouchHandle: (event: React.PointerEvent) => void
  onResize: (
    dimension: 'width' | 'height' | 'both',
    size: { width: number; height: number },
  ) => void
}) {
  const { t } = useTranslation()
  const { selected, hovered } = props.boxes
  const startResize = (dimension: 'width' | 'height' | 'both') => (event: React.PointerEvent) => {
    if (!selected) return
    event.preventDefault()
    event.stopPropagation()
    const start = {
      x: event.clientX,
      y: event.clientY,
      width: selected.width,
      height: selected.height,
    }
    const target = event.currentTarget as HTMLElement
    target.setPointerCapture(event.pointerId)
    const move = (e: PointerEvent) =>
      props.onResize(dimension, {
        width: Math.max(8, start.width + e.clientX - start.x),
        height: Math.max(8, start.height + e.clientY - start.y),
      })
    const up = () => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
  }
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {hovered ? (
        <div
          className="absolute rounded-[3px] outline-[1.5px] outline-dashed outline-primary/70"
          style={hovered}
        />
      ) : null}
      {hovered && props.hoveredLabel && !(selected && Math.abs(selected.top - hovered.top) < 24) ? (
        // Names sit outside the phone, on the left: they never hide a neighbour (J0 review).
        <span
          className="absolute right-[calc(100%+14px)] rounded bg-primary/80 px-1.5 text-[11px] leading-5 whitespace-nowrap text-white"
          style={{ top: hovered.top }}
        >
          {props.hoveredLabel}
        </span>
      ) : null}
      {selected ? (
        <div
          className="absolute rounded-[3px] outline-2 outline-primary"
          style={selected}
          data-testid="selection-box"
        >
          {props.canResize ? (
            <>
              <Handle
                className="top-1/2 -right-1.5 h-5 w-2.5 -translate-y-1/2 cursor-ew-resize"
                label={t('editor.design.resizeWidth')}
                onPointerDown={startResize('width')}
              />
              <Handle
                className="-bottom-1.5 left-1/2 h-2.5 w-5 -translate-x-1/2 cursor-ns-resize"
                label={t('editor.design.resizeHeight')}
                onPointerDown={startResize('height')}
              />
              <Handle
                className="-right-1.5 -bottom-1.5 size-3 cursor-nwse-resize"
                label={`${t('editor.design.resizeWidth')} + ${t('editor.design.resizeHeight')}`}
                onPointerDown={startResize('both')}
              />
            </>
          ) : null}
        </div>
      ) : null}
      {selected ? (
        <div
          className="pointer-events-auto absolute right-[calc(100%+14px)] flex h-6 items-center gap-0.5 rounded-md bg-primary pr-2 pl-0.5 text-[12px] font-semibold whitespace-nowrap text-white shadow-1"
          style={{ top: selected.top }}
          data-testid="selection-label"
        >
          {props.canMove ? (
            <span
              draggable
              onDragStart={props.onDragHandle}
              onDragEnd={endDrag}
              onPointerDown={props.onTouchHandle}
              className="cursor-grab touch-none"
              role="img"
              aria-label={props.selectedLabel}
            >
              <GripVertical size={14} />
            </span>
          ) : (
            <span className="w-1.5" />
          )}
          {props.selectedLabel}
          <span
            aria-hidden="true"
            className="absolute top-1/2 left-full h-px bg-primary/70"
            style={{ width: 14 + selected.left }}
          />
        </div>
      ) : null}
      {props.drop ? (
        <div
          className="absolute rounded-full bg-coral shadow-[0_0_0_2px_white]"
          style={props.drop}
          data-testid="drop-indicator"
        />
      ) : null}
    </div>
  )
}

function Handle({
  className,
  label,
  onPointerDown,
}: {
  className: string
  label: string
  onPointerDown: (event: React.PointerEvent) => void
}) {
  return (
    <span
      role="img"
      aria-label={label}
      onPointerDown={onPointerDown}
      className={cn(
        'pointer-events-auto absolute rounded-[3px] border-2 border-primary bg-white',
        className,
      )}
    />
  )
}

function CanvasToolbar(props: {
  device: Device
  landscape: boolean
  zoom: number | 'fit'
  fit: number
  appScheme: 'light' | 'dark'
  set: ReturnType<typeof useEditor.getState>['set']
}) {
  const { t } = useTranslation()
  const current = props.zoom === 'fit' ? Math.round(props.fit * 100) : props.zoom
  const step = (direction: 1 | -1) => {
    const next =
      direction > 0 ? ZOOMS.find((z) => z > current) : [...ZOOMS].reverse().find((z) => z < current)
    if (next) props.set({ zoom: next })
  }
  return (
    <div className="flex h-11 shrink-0 items-center justify-center gap-1 border-b border-border bg-surface/80 px-2 backdrop-blur junior:h-14">
      <Select
        aria-label={t('editor.design.device')}
        value={props.device}
        onChange={(event) => props.set({ device: event.target.value as Device, zoom: 'fit' })}
        className="h-control-sm w-auto text-ui-sm"
      >
        {(Object.keys(DEVICES) as Device[]).map((device) => (
          <option key={device} value={device}>
            {t(`editor.design.devices.${device}`)} · {DEVICES[device].width}×
            {DEVICES[device].height}
          </option>
        ))}
      </Select>
      <IconButton
        size="sm"
        label={t('editor.design.orientation')}
        active={props.landscape}
        onClick={() => props.set({ landscape: !props.landscape, zoom: 'fit' })}
      >
        <RotateCcw size={15} />
      </IconButton>
      <div className="mx-1 h-5 w-px bg-border" />
      <IconButton
        size="sm"
        label={t('editor.design.zoomOut')}
        disabled={current <= MIN_ZOOM}
        onClick={() => step(-1)}
      >
        <Minus size={15} />
      </IconButton>
      <span className="w-11 text-center text-ui-sm tabular-nums text-muted" aria-live="polite">
        {current} %
      </span>
      <IconButton
        size="sm"
        label={t('editor.design.zoomIn')}
        disabled={current >= MAX_ZOOM}
        onClick={() => step(1)}
      >
        <Plus size={15} />
      </IconButton>
      <IconButton
        size="sm"
        label={t('editor.design.zoomFit')}
        active={props.zoom === 'fit'}
        onClick={() => props.set({ zoom: 'fit' })}
      >
        <Scan size={15} />
      </IconButton>
      <div className="mx-1 h-5 w-px bg-border" />
      <Tooltip content={t('editor.design.appTheme')}>
        <button
          type="button"
          aria-label={
            props.appScheme === 'light' ? t('editor.preview.darkApp') : t('editor.preview.lightApp')
          }
          onClick={() => props.set({ appScheme: props.appScheme === 'light' ? 'dark' : 'light' })}
          className="grid size-control-sm place-items-center rounded-ui text-muted hover:bg-surface-2 hover:text-text"
        >
          {props.appScheme === 'light' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </Tooltip>
    </div>
  )
}

export function describe(screen: Screen, id: ComponentId, locale: 'fr' | 'en'): ReactNode {
  const node = screen.components[id]
  if (!node) return null
  const def = getComponentDef(node.type)
  return `${node.name} (${def ? componentLabel(node.type, locale) : node.type})`
}
