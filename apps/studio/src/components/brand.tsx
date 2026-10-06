import { cn } from '../lib/cn.ts'

/**
 * The Rublox mark: two snapping blocks (indigo and coral) — nothing taken from Roblox or
 * Thunkable (SPEC § 5.6).
 */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path
        d="M5 4h7a2 2 0 0 0 4 0h7a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-7a2 2 0 0 1-4 0H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z"
        fill="#5b4bff"
      />
      <path
        d="M9 17h3a2 2 0 0 0 4 0h11a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3z"
        fill="#ff6b5c"
      />
      <circle cx="11" cy="10" r="1.6" fill="#fff" />
      <circle cx="17" cy="10" r="1.6" fill="#fff" />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark />
      <span className="font-junior text-[22px] leading-none font-black tracking-tight text-text">
        rublox
      </span>
    </span>
  )
}

/** The mascot: a small expressive block, guide of Junior mode. */
export function Mascot({
  size = 120,
  mood = 'happy',
  className,
}: {
  size?: number
  mood?: 'happy' | 'wave'
  className?: string
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={className} aria-hidden="true">
      <ellipse cx="60" cy="108" rx="34" ry="6" fill="currentColor" opacity="0.08" />
      <path
        d="M24 26h22a8 8 0 0 0 16 0h34a10 10 0 0 1 10 10v52a10 10 0 0 1-10 10H24a10 10 0 0 1-10-10V36a10 10 0 0 1 10-10z"
        fill="#5b4bff"
      />
      <path
        d="M24 26h22a8 8 0 0 0 16 0h34a10 10 0 0 1 10 10v8H14v-8a10 10 0 0 1 10-10z"
        fill="#fff"
        opacity="0.12"
      />
      <ellipse cx="44" cy="60" rx="9" ry="10" fill="#fff" />
      <ellipse cx="76" cy="60" rx="9" ry="10" fill="#fff" />
      <circle cx="46" cy="62" r="4.5" fill="#1c1a2b" />
      <circle cx="78" cy="62" r="4.5" fill="#1c1a2b" />
      <circle cx="47.5" cy="60" r="1.5" fill="#fff" />
      <circle cx="79.5" cy="60" r="1.5" fill="#fff" />
      <ellipse cx="33" cy="76" rx="6" ry="3.5" fill="#ff8a7d" opacity="0.9" />
      <ellipse cx="87" cy="76" rx="6" ry="3.5" fill="#ff8a7d" opacity="0.9" />
      <path
        d="M50 78q10 9 20 0"
        fill="none"
        stroke="#1c1a2b"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      {mood === 'wave' ? (
        <path
          d="M106 50q10-6 8-18"
          fill="none"
          stroke="#5b4bff"
          strokeWidth="9"
          strokeLinecap="round"
        />
      ) : null}
      <path d="M98 14l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#ffc93c" />
    </svg>
  )
}
