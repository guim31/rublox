import { richText } from '@rublox/learn'
import type { ProjectDoc } from '@rublox/schema'
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '../lib/cn.ts'
import { usePrefs } from '../lib/prefs.ts'
import { anchorOf, findTarget, flyoutRect } from './targets.ts'

type Rect = { left: number; top: number; width: number; height: number }

const MARGIN = 12
const GAP = 16

function intersects(a: Rect, b: Rect, pad = 6): boolean {
  return (
    a.left < b.left + b.width + pad &&
    a.left + a.width + pad > b.left &&
    a.top < b.top + b.height + pad &&
    a.top + a.height + pad > b.top
  )
}

/**
 * Where the bubble goes: beside its target (right, left, below, above), inside the window,
 * never over the target nor over the open flyout of blocks. Without a target: in a corner.
 */
function place(
  size: { width: number; height: number },
  target: Rect | null,
  avoid: Rect[],
  fallback: 'center' | 'corner',
): { left: number; top: number } {
  const W = window.innerWidth
  const H = window.innerHeight
  const clampX = (x: number) => Math.min(Math.max(MARGIN, x), W - size.width - MARGIN)
  const clampY = (y: number) => Math.min(Math.max(MARGIN, y), H - size.height - MARGIN)
  if (target) {
    const candidates = [
      { left: target.left + target.width + GAP, top: clampY(target.top - 8) },
      { left: target.left - size.width - GAP, top: clampY(target.top - 8) },
      { left: clampX(target.left), top: target.top + target.height + GAP },
      { left: clampX(target.left), top: target.top - size.height - GAP },
    ]
    for (const candidate of candidates) {
      const box = { ...candidate, ...size }
      const inside =
        box.left >= MARGIN &&
        box.top >= MARGIN &&
        box.left + box.width <= W - MARGIN &&
        box.top + box.height <= H - MARGIN
      if (inside && ![target, ...avoid].some((rect) => intersects(box, rect))) return candidate
    }
    // Nothing fits beside it: the corner farthest from the target.
    const right = target.left + target.width / 2 < W / 2
    return {
      left: right ? W - size.width - 24 : 24,
      top: H - size.height - 24,
    }
  }
  if (fallback === 'center') return { left: (W - size.width) / 2, top: Math.max(80, H * 0.22) }
  return { left: 24, top: H - size.height - 24 }
}

/** Tutorial text: `**bold**` and `[block]` drawn like a block. */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {richText(text).map((segment, index) =>
        segment.kind === 'strong' ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: segments of a fixed text
          <strong key={index} className="font-strong">
            {segment.text}
          </strong>
        ) : segment.kind === 'block' ? (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: segments of a fixed text
            key={index}
            className="mx-0.5 inline-block rounded-[6px] bg-[#9a5c08] px-1.5 py-px font-strong text-[0.92em] leading-snug whitespace-nowrap text-white"
          >
            {segment.text}
          </span>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: segments of a fixed text
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  )
}

/**
 * A guiding bubble with a spotlight on its target, used by the tutorials and the tour. The
 * spotlight lets clicks through: the learner acts on the real interface.
 */
export function Bubble({
  target,
  doc,
  label,
  fallback = 'corner',
  wide,
  children,
  testId,
}: {
  target?: string
  doc: ProjectDoc | null
  label: string
  fallback?: 'center' | 'corner'
  wide?: boolean
  children: ReactNode
  testId?: string
}) {
  const locale = usePrefs((s) => s.locale)
  const bubble = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<{ spot: Rect | null; left: number; top: number } | null>(
    null,
  )

  // Follows the target as panels move, tabs change, the toolbox opens.
  useLayoutEffect(() => {
    let frame = 0
    let last = ''
    const loop = () => {
      const element = target ? findTarget(target, doc, locale) : null
      const rect = element?.getBoundingClientRect() ?? null
      const spot = rect
        ? { left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8 }
        : null
      const own = bubble.current?.getBoundingClientRect()
      const size = { width: own?.width ?? 340, height: own?.height ?? 160 }
      const flyout = flyoutRect()
      const anchor = element ? anchorOf(element).getBoundingClientRect() : null
      // In Blocks, the bubble waits at the bottom of the workspace, beside the toolbox and its
      // flyout: blocks are dropped higher up, and the bubble must not be in their way.
      const workspace =
        target && /^(toolbox|toolbox-category|workspace)(:|$)/.test(target)
          ? findTarget('workspace', doc, locale)?.getBoundingClientRect()
          : undefined
      const toolbox = document.querySelector('.blocklyToolbox')?.getBoundingClientRect()
      const docked = workspace
        ? {
            left: Math.min(
              Math.max(flyout?.right ?? 0, toolbox?.right ?? workspace.left) + GAP,
              workspace.right - size.width - GAP,
            ),
            top: workspace.bottom - size.height - GAP,
          }
        : null
      const position =
        docked ??
        place(
          size,
          anchor && spot
            ? { left: anchor.left, top: spot.top, width: anchor.width, height: spot.height }
            : spot,
          [...(spot ? [spot] : []), ...(flyout ? [flyout] : [])],
          fallback,
        )
      const next = { spot, ...position }
      const key = JSON.stringify(next)
      if (key !== last) {
        last = key
        setLayout(next)
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [target, doc, locale, fallback])

  return (
    <>
      {/* Above Blockly's toolbox (z-index 70), below a dragged block (80). */}
      {layout?.spot ? (
        <div
          aria-hidden="true"
          className="rx-spotlight pointer-events-none fixed z-[74] rounded-ui transition-[left,top,width,height] duration-200"
          style={layout.spot}
          data-testid="tutorial-spotlight"
        />
      ) : null}
      <section
        ref={bubble}
        aria-label={label}
        data-testid={testId}
        className={cn(
          'rx-pop fixed z-[75] flex flex-col gap-3 rounded-ui-lg border border-border bg-surface p-4 shadow-3 transition-[left,top] duration-200',
          wide ? 'w-[400px]' : 'w-[340px] junior:w-[370px]',
          !layout && 'invisible',
        )}
        style={layout ? { left: layout.left, top: layout.top } : { left: 0, top: 0 }}
      >
        {children}
      </section>
    </>
  )
}
