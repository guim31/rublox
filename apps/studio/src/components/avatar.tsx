import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../lib/cn.ts'

/**
 * Avatars: illustrations drawn for Rublox (SPEC § 4.7: no photos). Each one is the mascot's
 * block with its own colour and a few features, so they stay recognisable at 24 px.
 */
export const AVATARS = [
  'blue',
  'coral',
  'mint',
  'sun',
  'cat',
  'fox',
  'bear',
  'bunny',
  'frog',
  'robot',
  'alien',
  'astronaut',
] as const

export type AvatarId = (typeof AVATARS)[number]

const BODY: Record<AvatarId, string> = {
  blue: '#5b4bff',
  coral: '#ff6b5c',
  mint: '#2fbf8f',
  sun: '#f5b301',
  cat: '#8a7dff',
  fox: '#ff8a3d',
  bear: '#9b6a45',
  bunny: '#e98fc1',
  frog: '#58b947',
  robot: '#7c8ba1',
  alien: '#36c2c9',
  astronaut: '#e9edf5',
}

const BACKGROUND: Record<AvatarId, string> = {
  blue: '#e6e3ff',
  coral: '#ffe4e0',
  mint: '#d9f5ea',
  sun: '#fff1c4',
  cat: '#ece9ff',
  fox: '#ffe8d6',
  bear: '#f1e6dc',
  bunny: '#fde6f2',
  frog: '#e2f5dc',
  robot: '#e3e8ef',
  alien: '#d8f4f5',
  astronaut: '#1f2547',
}

export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === 'string' && (AVATARS as readonly string[]).includes(value)
}

function Features({ id }: { id: AvatarId }) {
  const body = BODY[id]
  switch (id) {
    case 'cat':
      return (
        <>
          <path d="M14 16l4-9 6 7z" fill={body} />
          <path d="M50 16l-4-9-6 7z" fill={body} />
        </>
      )
    case 'fox':
      return (
        <>
          <path d="M13 17l3-11 8 8z" fill={body} />
          <path d="M51 17l-3-11-8 8z" fill={body} />
          <path d="M22 44q10 8 20 0v6H22z" fill="#fff" opacity="0.85" />
        </>
      )
    case 'bear':
      return (
        <>
          <circle cx="17" cy="15" r="6" fill={body} />
          <circle cx="47" cy="15" r="6" fill={body} />
        </>
      )
    case 'bunny':
      return (
        <>
          <rect x="18" y="2" width="7" height="17" rx="3.5" fill={body} />
          <rect x="39" y="2" width="7" height="17" rx="3.5" fill={body} />
        </>
      )
    case 'frog':
      return (
        <>
          <circle cx="22" cy="17" r="7" fill={body} />
          <circle cx="42" cy="17" r="7" fill={body} />
        </>
      )
    case 'robot':
      return (
        <>
          <rect x="30.5" y="5" width="3" height="9" fill="#4b5568" />
          <circle cx="32" cy="5" r="3" fill="#ff6b5c" />
        </>
      )
    case 'alien':
      return (
        <>
          <path d="M20 16l-4-9" stroke={body} strokeWidth="3" strokeLinecap="round" />
          <path d="M44 16l4-9" stroke={body} strokeWidth="3" strokeLinecap="round" />
          <circle cx="16" cy="6" r="3" fill="#ffc93c" />
          <circle cx="48" cy="6" r="3" fill="#ffc93c" />
        </>
      )
    case 'astronaut':
      return <rect x="11" y="13" width="42" height="42" rx="12" fill="#bcd6ff" opacity="0.35" />
    default:
      return <path d="M24 16h4a4 4 0 0 0 8 0h4z" fill={body} />
  }
}

/** One avatar; without an id, the initial of `name` on a neutral tile. */
export function Avatar({
  id,
  name,
  size = 32,
  className,
}: {
  id: string | null | undefined
  name: string
  size?: number
  className?: string
}) {
  if (!isAvatarId(id)) {
    return (
      <span
        aria-hidden="true"
        style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
        className={cn(
          'inline-grid shrink-0 place-items-center rounded-full bg-primary-soft font-strong text-primary-text uppercase',
          className,
        )}
      >
        {name.trim().charAt(0) || '?'}
      </span>
    )
  }
  const body = BODY[id]
  const dark = id === 'astronaut'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={cn('shrink-0 rounded-full', className)}
    >
      <circle cx="32" cy="32" r="32" fill={BACKGROUND[id]} />
      <Features id={id} />
      <rect x="13" y="15" width="38" height="38" rx="10" fill={body} />
      {id === 'robot' ? <rect x="18" y="25" width="28" height="13" rx="6" fill="#1f2547" /> : null}
      <ellipse cx="25" cy="32" rx="4.2" ry="4.8" fill={id === 'robot' ? '#7df9ff' : '#fff'} />
      <ellipse cx="39" cy="32" rx="4.2" ry="4.8" fill={id === 'robot' ? '#7df9ff' : '#fff'} />
      {id !== 'robot' ? (
        <>
          <circle cx="26" cy="33" r="2.2" fill={dark ? '#1f2547' : '#1c1a2b'} />
          <circle cx="40" cy="33" r="2.2" fill={dark ? '#1f2547' : '#1c1a2b'} />
        </>
      ) : null}
      <path
        d="M27 42q5 4.5 10 0"
        fill="none"
        stroke={dark ? '#1f2547' : '#1c1a2b'}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <ellipse cx="20" cy="41" rx="3" ry="1.8" fill="#ff8a7d" opacity="0.8" />
      <ellipse cx="44" cy="41" rx="3" ry="1.8" fill="#ff8a7d" opacity="0.8" />
    </svg>
  )
}

/** A grid of avatars to choose from: native radio buttons, so arrow keys move between them. */
export function AvatarPicker({
  value,
  onChange,
}: {
  value: string | null
  onChange: (id: AvatarId) => void
}) {
  const { t } = useTranslation()
  const group = useId()
  return (
    <div className="flex flex-wrap gap-2">
      {AVATARS.map((id) => (
        <label key={id} className="relative cursor-pointer rounded-full">
          <input
            type="radio"
            name={group}
            value={id}
            checked={value === id}
            onChange={() => onChange(id)}
            aria-label={t('avatars.choose', { name: t(`avatars.names.${id}`) })}
            className="peer sr-only"
          />
          <span className="block rounded-full p-0.5 ring-offset-2 ring-offset-surface transition-transform peer-checked:ring-3 peer-checked:ring-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary hover:scale-105">
            <Avatar id={id} name={id} size={52} />
          </span>
        </label>
      ))}
    </div>
  )
}
