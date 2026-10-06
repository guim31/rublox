import { messages } from '@rublox/i18n'
import { type Renderer, rootAttributes } from './types.ts'

function Placeholder({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 120 80" className="rx-image-placeholder" role="img" aria-label={label}>
      <rect width="120" height="80" rx="6" fill="var(--rx-surface)" />
      <circle cx="84" cy="24" r="9" fill="var(--rx-secondary)" opacity="0.85" />
      <path d="M10 70 L42 34 L64 58 L78 44 L110 70 Z" fill="var(--rx-primary)" opacity="0.75" />
    </svg>
  )
}

export const ImageRenderer: Renderer = (p) => {
  const src = typeof p.props.src === 'string' && p.props.src ? p.assetUrl(p.props.src) : undefined
  const alt = String(p.props.alt ?? '')
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: an image can be made clickable by blocks
    // biome-ignore lint/a11y/useKeyWithClickEvents: same
    <div
      {...rootAttributes(p, 'Image')}
      className="rx-image"
      style={{ overflow: 'hidden', ...p.style }}
      onClick={p.design ? undefined : () => p.emit('click')}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          draggable={false}
          style={{
            width: '100%',
            height: '100%',
            objectFit: (p.props.fit as 'cover') ?? 'cover',
            display: 'block',
          }}
        />
      ) : (
        <Placeholder label={alt || messages[p.locale].runtime.imagePlaceholder} />
      )}
    </div>
  )
}
