import { type DragPayload, setDrag } from './dnd.ts'

/** A finger held this long on a palette item starts a drag (shorter moves scroll the list). */
const LONG_PRESS_MS = 280
const SLOP_PX = 8

let touching = false

/** A touch drag is under way: the browser's own drag (long press) must not start too. */
export function isTouchDragging(): boolean {
  return touching
}

/** The drag-and-drop event the canvas and the layers already handle, at a point. */
function fire(
  type: 'dragenter' | 'dragover' | 'dragleave' | 'drop' | 'dragend',
  target: Element,
  point: { x: number; y: number },
  related?: Element | null,
) {
  let dataTransfer: DataTransfer | null = null
  try {
    dataTransfer = new DataTransfer()
  } catch {
    // Old Safari: handlers only read `dropEffect`, which then is skipped.
  }
  const event = new DragEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: point.x,
    clientY: point.y,
    dataTransfer,
    relatedTarget: related ?? null,
  })
  target.dispatchEvent(event)
}

function ghost(label: string): HTMLElement {
  const element = document.createElement('div')
  element.textContent = label
  element.setAttribute('aria-hidden', 'true')
  element.className =
    'pointer-events-none fixed z-[80] -translate-x-1/2 -translate-y-[130%] rounded-ui bg-primary px-3 py-1.5 font-strong text-on-primary shadow-3'
  document.body.append(element)
  return element
}

/**
 * Drag and drop with a finger or a pen (SPEC § 4.1, J0 review). The native HTML5 drag is not
 * reliable on touch screens (Chrome Android, Safari iPadOS): this fallback follows the pointer
 * and replays `dragover` / `drop` on the element under it, so the drop targets of the canvas
 * and of the layers work unchanged. The mouse keeps the native drag.
 *
 * `immediate`: starts at once (a drag handle); otherwise after a long press, so that a swipe
 * still scrolls the palette.
 */
export function touchDrag(payload: () => DragPayload | null, label: string, immediate = false) {
  return (event: React.PointerEvent) => {
    if (event.pointerType === 'mouse' || !event.isPrimary) return
    const source = event.currentTarget as HTMLElement
    const pointerId = event.pointerId
    let point = { x: event.clientX, y: event.clientY }
    const start = point
    let dragging = false
    let over: Element | null = null
    let shown: HTMLElement | null = null
    touching = true

    const block = (e: TouchEvent) => e.preventDefault()
    const moveTo = (next: { x: number; y: number }) => {
      point = next
      if (shown) {
        shown.style.left = `${next.x}px`
        shown.style.top = `${next.y}px`
      }
      const under = document.elementFromPoint(next.x, next.y)
      if (under !== over) {
        if (over) fire('dragleave', over, next, under)
        if (under) fire('dragenter', under, next, over)
        over = under
      }
      if (under) fire('dragover', under, next)
    }
    const begin = () => {
      const data = payload()
      if (!data) return cleanup()
      dragging = true
      setDrag(data)
      shown = ghost(label)
      // The page must not scroll under the finger while dragging.
      document.addEventListener('touchmove', block, { passive: false })
      navigator.vibrate?.(8)
      moveTo(point)
    }
    const timer = immediate ? undefined : setTimeout(begin, LONG_PRESS_MS)
    if (immediate) begin()

    function onMove(e: PointerEvent) {
      if (e.pointerId !== pointerId) return
      const next = { x: e.clientX, y: e.clientY }
      if (!dragging) {
        if (Math.hypot(next.x - start.x, next.y - start.y) > SLOP_PX) cleanup()
        else point = next
        return
      }
      e.preventDefault()
      moveTo(next)
    }
    function onUp(e: PointerEvent) {
      if (e.pointerId !== pointerId) return
      if (dragging) {
        const under = document.elementFromPoint(e.clientX, e.clientY)
        if (under) fire('drop', under, { x: e.clientX, y: e.clientY })
      }
      cleanup()
    }
    function onCancel(e: PointerEvent) {
      if (e.pointerId === pointerId) cleanup()
    }
    function cleanup() {
      clearTimeout(timer)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      document.removeEventListener('touchmove', block)
      if (dragging) {
        if (over) fire('dragleave', over, point, null)
        fire('dragend', source, point)
      }
      shown?.remove()
      setDrag(null)
      dragging = false
      // The browser may still send its own `dragstart` right after: ignore it a moment more.
      setTimeout(() => {
        touching = false
      }, 50)
    }
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
  }
}
