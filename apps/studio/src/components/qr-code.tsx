import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { cn } from '../lib/cn.ts'

/** A QR code drawn locally (`qrcode`), always dark on white so that every camera reads it. */
export function QrCode({
  value,
  label,
  className,
}: {
  value: string
  label: string
  className?: string
}) {
  const [svg, setSvg] = useState('')
  useEffect(() => {
    let cancelled = false
    void QRCode.toString(value, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }).then(
      (result) => !cancelled && setSvg(result),
    )
    return () => {
      cancelled = true
    }
  }, [value])
  return (
    <div
      role="img"
      aria-label={label}
      data-value={value}
      className={cn('aspect-square rounded-ui-lg bg-white p-2 [&_svg]:size-full', className)}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG generated locally by `qrcode`
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
