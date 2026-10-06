import { useEffect, useRef } from 'react'

const COLORS = ['#5b4bff', '#ff6b5c', '#ffc93c', '#13a27f', '#aaa2ff']

/**
 * A short burst of confetti, drawn on a canvas that ignores the pointer (no dependency).
 * Nothing moves when the system asks for reduced motion.
 */
export function Confetti({ pieces = 120 }: { pieces?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const element = canvas.current
    const context = element?.getContext('2d')
    if (!element || !context || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ratio = window.devicePixelRatio || 1
    element.width = window.innerWidth * ratio
    element.height = window.innerHeight * ratio
    context.scale(ratio, ratio)
    const width = window.innerWidth
    const parts = Array.from({ length: pieces }, (_, index) => ({
      x: width / 2 + (Math.random() - 0.5) * 120,
      y: window.innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 14,
      vy: -8 - Math.random() * 9,
      size: 5 + Math.random() * 6,
      angle: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.3,
      color: COLORS[index % COLORS.length] ?? '#5b4bff',
    }))
    let frame = 0
    let ticks = 0
    const draw = () => {
      ticks += 1
      context.clearRect(0, 0, width, window.innerHeight)
      for (const p of parts) {
        p.vy += 0.32
        p.vx *= 0.985
        p.x += p.vx
        p.y += p.vy
        p.angle += p.spin
        context.save()
        context.globalAlpha = Math.max(0, 1 - ticks / 150)
        context.translate(p.x, p.y)
        context.rotate(p.angle)
        context.fillStyle = p.color
        context.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        context.restore()
      }
      if (ticks < 150) frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [pieces])
  return (
    <canvas
      ref={canvas}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[70] size-full"
    />
  )
}
