import { useEffect, useMemo, useRef } from 'react'
import { cssColor } from '../theme.ts'
import type { CanvasHandle } from './media-handles.ts'
import { type Renderer, rootAttributes, useExpose } from './types.ts'

type Op =
  | { kind: 'stroke'; color: string; width: number; points: [number, number][] }
  | { kind: 'circle'; color: string; x: number; y: number; r: number }
  | { kind: 'rect'; color: string; x: number; y: number; w: number; h: number }
  | { kind: 'text'; color: string; size: number; text: string; x: number; y: number }

const MAX_OPS = 4000

/**
 * The drawing is kept as a list of operations, redrawn when the area changes size or colors
 * (theme tokens are resolved on the element, so `@primary` follows the app theme).
 */
export const CanvasRenderer: Renderer = (p) => {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const ops = useRef<Op[]>([])
  const props = useRef(p.props)
  props.current = p.props

  const resolve = (color: unknown, fallback: string): string => {
    const css = cssColor(color) ?? fallback
    if (!css.startsWith('var(')) return css
    const element = wrap.current
    if (!element) return fallback
    const name = css.slice(4, -1)
    return getComputedStyle(element).getPropertyValue(name).trim() || fallback
  }

  const redraw = () => {
    const element = canvas.current
    const context = element?.getContext('2d')
    if (!element || !context) return
    const ratio = globalThis.devicePixelRatio || 1
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.fillStyle = resolve(props.current.backgroundColor, '#ffffff')
    context.fillRect(0, 0, element.width / ratio, element.height / ratio)
    for (const op of ops.current) paint(context, op)
  }

  const paint = (context: CanvasRenderingContext2D, op: Op) => {
    context.fillStyle = op.color
    context.strokeStyle = op.color
    if (op.kind === 'stroke') {
      context.lineWidth = op.width
      context.lineCap = 'round'
      context.lineJoin = 'round'
      context.beginPath()
      const [first, ...rest] = op.points
      if (!first) return
      context.moveTo(first[0], first[1])
      if (!rest.length) context.lineTo(first[0] + 0.01, first[1])
      for (const [x, y] of rest) context.lineTo(x, y)
      context.stroke()
    } else if (op.kind === 'circle') {
      context.beginPath()
      context.arc(op.x, op.y, Math.max(0, op.r), 0, Math.PI * 2)
      context.fill()
    } else if (op.kind === 'rect') {
      context.fillRect(op.x, op.y, op.w, op.h)
    } else {
      context.font = `${op.size}px ${getComputedStyle(canvas.current ?? document.body).fontFamily}`
      context.textBaseline = 'top'
      context.fillText(op.text, op.x, op.y)
    }
  }

  const add = (op: Op) => {
    ops.current.push(op)
    if (ops.current.length > MAX_OPS) ops.current.splice(0, ops.current.length - MAX_OPS)
    const context = canvas.current?.getContext('2d')
    if (context) paint(context, op)
  }

  const pen = () => resolve(props.current.penColor, '#5b4bff')
  const width = () => Number(props.current.penWidth) || 6

  // biome-ignore lint/correctness/useExhaustiveDependencies: the helpers only read refs
  const handle = useMemo<CanvasHandle>(
    () => ({
      clear: () => {
        ops.current = []
        redraw()
      },
      line: (x1, y1, x2, y2) =>
        add({
          kind: 'stroke',
          color: pen(),
          width: width(),
          points: [
            [x1, y1],
            [x2, y2],
          ],
        }),
      circle: (x, y, r) => add({ kind: 'circle', color: pen(), x, y, r }),
      rect: (x, y, w, h) => add({ kind: 'rect', color: pen(), x, y, w, h }),
      text: (text, x, y) => add({ kind: 'text', color: pen(), size: width() * 3 + 8, text, x, y }),
      image: () => canvas.current?.toDataURL('image/png') ?? '',
    }),
    [],
  )
  useExpose(p, handle)

  // Size the bitmap to the element (sharp on high density screens) and redraw.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `redraw` only reads refs
  useEffect(() => {
    const element = canvas.current
    if (!element) return
    const fit = () => {
      const ratio = globalThis.devicePixelRatio || 1
      const { width: w, height: h } = element.getBoundingClientRect()
      element.width = Math.max(1, Math.round(w * ratio))
      element.height = Math.max(1, Math.round(h * ratio))
      redraw()
    }
    fit()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(fit)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: redraw when the background changes
  useEffect(() => redraw(), [p.props.backgroundColor])

  const stroke = useRef<Op | null>(null)
  const point = (event: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = event.currentTarget.getBoundingClientRect()
    // The editor's preview is scaled: convert screen pixels to the canvas's own pixels.
    const sx = rect.width / (event.currentTarget.offsetWidth || rect.width || 1)
    const sy = rect.height / (event.currentTarget.offsetHeight || rect.height || 1)
    return [
      Math.round((event.clientX - rect.left) / (sx || 1)),
      Math.round((event.clientY - rect.top) / (sy || 1)),
    ]
  }

  return (
    <div
      {...rootAttributes(p, 'Canvas')}
      ref={wrap}
      className="rx-canvas"
      style={{ overflow: 'hidden', ...p.style }}
    >
      <canvas
        ref={canvas}
        aria-label={p.name}
        style={{ touchAction: p.design ? undefined : 'none' }}
        onPointerDown={(event) => {
          if (p.design) return
          event.currentTarget.setPointerCapture?.(event.pointerId)
          const [x, y] = point(event)
          if (props.current.fingerDrawing !== false) {
            stroke.current = { kind: 'stroke', color: pen(), width: width(), points: [[x, y]] }
            add(stroke.current)
          }
          p.emit('touch', { x, y })
        }}
        onPointerMove={(event) => {
          if (p.design || event.buttons === 0) return
          const [x, y] = point(event)
          const current = stroke.current
          if (current?.kind === 'stroke') {
            const last = current.points.at(-1) ?? [x, y]
            current.points.push([x, y])
            const context = canvas.current?.getContext('2d')
            if (context) paint(context, { ...current, points: [last, [x, y]] })
          }
          p.emit('drag', { x, y })
        }}
        onPointerUp={(event) => {
          if (p.design) return
          stroke.current = null
          const [x, y] = point(event)
          p.emit('release', { x, y })
        }}
      />
    </div>
  )
}
