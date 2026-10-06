import QRCode from 'qrcode'
import { useMemo } from 'react'
import { cssColor } from '../theme.ts'
import { renderMarkdown } from './markdown.tsx'
import { type Renderer, rootAttributes } from './types.ts'

export const ProgressBarRenderer: Renderer = (p) => {
  const value = Math.min(100, Math.max(0, Number(p.props.value) || 0))
  const thickness = Number(p.props.thickness) || 10
  return (
    <div
      {...rootAttributes(p, 'ProgressBar')}
      role="progressbar"
      aria-label={p.name}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className="rx-progress"
      style={{
        height: thickness,
        borderRadius: thickness,
        background: cssColor(p.props.trackColor) ?? 'var(--rx-surface)',
        ...p.style,
      }}
    >
      <div
        className="rx-progress-fill"
        style={{
          width: `${value}%`,
          borderRadius: thickness,
          background: cssColor(p.props.color) ?? 'var(--rx-primary)',
        }}
      />
    </div>
  )
}

export const SpinnerRenderer: Renderer = (p) => {
  const size = Number(p.props.size) || 36
  const spinning = p.props.spinning !== false
  return (
    <div
      {...rootAttributes(p, 'Spinner')}
      role="status"
      aria-label={p.name}
      style={{ width: size, height: size, flexShrink: 0, ...p.style }}
    >
      <svg
        viewBox="0 0 48 48"
        width={size}
        height={size}
        className={spinning ? 'rx-spin' : undefined}
        aria-hidden="true"
      >
        <circle
          cx="24"
          cy="24"
          r="19"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.18"
          strokeWidth="5"
        />
        <path
          d="M24 5a19 19 0 0 1 19 19"
          fill="none"
          stroke={cssColor(p.props.color) ?? 'var(--rx-primary)'}
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

export const RichTextRenderer: Renderer = (p) => {
  const text = String(p.props.text ?? '')
  const link = cssColor(p.props.linkColor) ?? 'var(--rx-primary)'
  return (
    <div
      {...rootAttributes(p, 'RichText')}
      className="rx-rich"
      style={{
        fontSize: Number(p.props.fontSize) || 16,
        color: cssColor(p.props.color) ?? 'var(--rx-text)',
        ...p.style,
      }}
    >
      {renderMarkdown(text, link, !p.design)}
    </div>
  )
}

/** The dark modules of a QR code as one SVG path (sizes are in modules). */
function qrPath(text: string): { size: number; path: string } | null {
  if (!text) return null
  try {
    const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' })
    let path = ''
    for (let row = 0; row < modules.size; row++) {
      for (let col = 0; col < modules.size; col++) {
        if (modules.get(row, col)) path += `M${col} ${row}h1v1h-1z`
      }
    }
    return { size: modules.size, path }
  } catch {
    return null
  }
}

export const QrCodeRenderer: Renderer = (p) => {
  const text = String(p.props.text ?? '')
  const qr = useMemo(() => qrPath(text), [text])
  const background = cssColor(p.props.backgroundColor) ?? '#ffffff'
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: can be made clickable by blocks
    // biome-ignore lint/a11y/useKeyWithClickEvents: same
    <div
      {...rootAttributes(p, 'QrCode')}
      style={{ background, padding: 8, flexShrink: 0, ...p.style }}
      onClick={p.design ? undefined : () => p.emit('click')}
    >
      {qr ? (
        <svg
          viewBox={`-2 -2 ${qr.size + 4} ${qr.size + 4}`}
          width="100%"
          height="100%"
          role="img"
          aria-label={text}
          shapeRendering="crispEdges"
        >
          <rect x="-2" y="-2" width={qr.size + 4} height={qr.size + 4} fill={background} />
          <path d={qr.path} fill={cssColor(p.props.color) ?? '#000000'} />
        </svg>
      ) : null}
    </div>
  )
}
