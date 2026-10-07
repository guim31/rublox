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

export type MascotMood = 'happy' | 'wave' | 'think' | 'cheer' | 'oops'

const INK = '#1c1a2b'

/** Eyes and mouth of each mood. */
function Face({ mood }: { mood: MascotMood }) {
  if (mood === 'cheer') {
    return (
      <>
        <path
          d="M36 62q8-10 16 0M68 62q8-10 16 0"
          fill="none"
          stroke={INK}
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path d="M47 74q13 16 26 0z" fill={INK} />
        <path d="M53 80q7 5 14 0" fill="#ff8a7d" />
      </>
    )
  }
  const look =
    mood === 'think' ? { x: 3, y: -3 } : mood === 'oops' ? { x: 0, y: 0 } : { x: 2, y: 2 }
  return (
    <>
      <ellipse cx="44" cy="60" rx="9" ry={mood === 'oops' ? 11 : 10} fill="#fff" />
      <ellipse cx="76" cy="60" rx="9" ry={mood === 'oops' ? 11 : 10} fill="#fff" />
      <circle cx={44 + look.x} cy={60 + look.y} r={mood === 'oops' ? 3.5 : 4.5} fill={INK} />
      <circle cx={76 + look.x} cy={60 + look.y} r={mood === 'oops' ? 3.5 : 4.5} fill={INK} />
      <circle cx={45.5 + look.x} cy={58 + look.y} r="1.5" fill="#fff" />
      <circle cx={77.5 + look.x} cy={58 + look.y} r="1.5" fill="#fff" />
      {mood === 'think' ? (
        <circle cx="62" cy="80" r="4" fill="none" stroke={INK} strokeWidth="3.5" />
      ) : mood === 'oops' ? (
        <path
          d="M48 82q4-5 8 0t8 0t8 0"
          fill="none"
          stroke={INK}
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M50 78q10 9 20 0"
          fill="none"
          stroke={INK}
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      )}
    </>
  )
}

/**
 * The mascot: a small expressive block, guide of Junior mode (SPEC § 5.6). Original drawing:
 * an indigo snapping block with a face. `animated` adds a short, non-blocking motion that
 * reduced motion turns off.
 */
export function Mascot({
  size = 120,
  mood = 'happy',
  animated = false,
  className,
}: {
  size?: number
  mood?: MascotMood
  animated?: boolean
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={cn(animated && mood === 'cheer' && 'rx-mascot-bounce', className)}
      aria-hidden="true"
    >
      <ellipse cx="60" cy="108" rx="34" ry="6" fill="currentColor" opacity="0.08" />
      {mood === 'cheer' ? (
        <path
          d="M18 52q-12-10-8-26M102 52q12-10 8-26"
          fill="none"
          stroke="#5b4bff"
          strokeWidth="9"
          strokeLinecap="round"
        />
      ) : null}
      <path
        d="M24 26h22a8 8 0 0 0 16 0h34a10 10 0 0 1 10 10v52a10 10 0 0 1-10 10H24a10 10 0 0 1-10-10V36a10 10 0 0 1 10-10z"
        fill="#5b4bff"
      />
      <path
        d="M24 26h22a8 8 0 0 0 16 0h34a10 10 0 0 1 10 10v8H14v-8a10 10 0 0 1 10-10z"
        fill="#fff"
        opacity="0.12"
      />
      <Face mood={mood} />
      {mood !== 'oops' ? (
        <>
          <ellipse cx="33" cy="76" rx="6" ry="3.5" fill="#ff8a7d" opacity="0.9" />
          <ellipse cx="87" cy="76" rx="6" ry="3.5" fill="#ff8a7d" opacity="0.9" />
        </>
      ) : (
        <path d="M100 30q5 8 0 11q-5-3 0-11z" fill="#6ec3ff" />
      )}
      {mood === 'wave' ? (
        <g className={animated ? 'rx-mascot-wave' : undefined}>
          <path
            d="M106 50q10-6 8-18"
            fill="none"
            stroke="#5b4bff"
            strokeWidth="9"
            strokeLinecap="round"
          />
        </g>
      ) : null}
      {mood === 'think' ? (
        <g fill="#ffc93c">
          <circle cx="98" cy="20" r="3" />
          <circle cx="106" cy="12" r="4" />
        </g>
      ) : (
        <path d="M98 14l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#ffc93c" />
      )}
      {mood === 'cheer' ? <path d="M16 12l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#13a27f" /> : null}
    </svg>
  )
}
