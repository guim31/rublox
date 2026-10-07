import { RotateCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn.ts'

/** A free component on the canvas: its center and size in canvas pixels, and its rotation. */
export type FreeBox = { cx: number; cy: number; width: number; height: number; rotation: number }

type Drag = (clientX: number, clientY: number, shift: boolean) => void

/** Follows the pointer from a handle until it is released. */
function track(event: React.PointerEvent, onMove: Drag) {
  event.preventDefault()
  event.stopPropagation()
  const target = event.currentTarget as HTMLElement
  target.setPointerCapture?.(event.pointerId)
  const move = (e: PointerEvent) => onMove(e.clientX, e.clientY, e.shiftKey)
  const up = () => {
    target.removeEventListener('pointermove', move)
    target.removeEventListener('pointerup', up)
    target.removeEventListener('pointercancel', up)
  }
  target.addEventListener('pointermove', move)
  target.addEventListener('pointerup', up)
  target.addEventListener('pointercancel', up)
}

/**
 * The selection of a component placed freely in a game scene (SPEC § 4.1): a frame turned
 * with it, four size handles and a rotation handle. Moving is done by dragging the component
 * itself, or with the arrow keys.
 */
export function FreeFrame(props: {
  box: FreeBox
  label: string
  resize: 'box' | 'size' | null
  rotate: boolean
  onResize: Drag
  onRotate: Drag
}) {
  const { t } = useTranslation()
  const { box } = props
  const corners = [
    'top-0 left-0 cursor-nwse-resize',
    'top-0 left-full cursor-nesw-resize',
    'top-full left-0 cursor-nesw-resize',
    'top-full left-full cursor-nwse-resize',
  ]
  return (
    <div
      className="absolute"
      style={{
        left: box.cx,
        top: box.cy,
        width: box.width,
        height: box.height,
        transform: `translate(-50%, -50%) rotate(${box.rotation}deg)`,
      }}
      data-testid="selection-box"
      data-free=""
    >
      <div className="absolute inset-0 rounded-[2px] outline-2 outline-primary" />
      <span
        className="absolute bottom-full left-0 mb-1 rounded bg-primary px-1.5 text-[11px] leading-5 font-semibold whitespace-nowrap text-white shadow-1"
        style={{ transform: `rotate(${-box.rotation}deg)`, transformOrigin: '0 100%' }}
      >
        {props.label}
      </span>
      {props.resize
        ? corners.map((place) => (
            <span
              key={place}
              role="img"
              aria-label={t('game.canvas.resize')}
              title={t('game.canvas.resize')}
              data-testid="free-resize"
              onPointerDown={(event) => track(event, props.onResize)}
              className={cn(
                'pointer-events-auto absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-[3px] border-2 border-primary bg-white junior:size-4',
                place,
              )}
            />
          ))
        : null}
      {props.rotate ? (
        <>
          <span className="absolute bottom-full left-1/2 h-5 w-px -translate-x-1/2 bg-primary" />
          <span
            role="img"
            aria-label={t('game.canvas.rotate')}
            title={t('game.canvas.rotate')}
            data-testid="free-rotate"
            onPointerDown={(event) => track(event, props.onRotate)}
            className="pointer-events-auto absolute bottom-full left-1/2 mb-5 grid size-5 -translate-x-1/2 cursor-grab place-items-center rounded-full border-2 border-primary bg-white text-primary junior:size-6"
          >
            <RotateCw size={11} strokeWidth={3} />
          </span>
        </>
      ) : null}
    </div>
  )
}
