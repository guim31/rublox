import { messages } from '@rublox/i18n'
import { useEffect, useRef, useState } from 'react'
import type { OverlayProps } from './registry.ts'

type Detector = { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> }
type DetectorClass = {
  new (options: { formats: string[] }): Detector
  getSupportedFormats?: () => Promise<string[]>
}

const SCAN_EVERY_MS = 180

/** A reader of QR codes: the native BarcodeDetector, or jsQR (loaded on demand) without it. */
async function makeReader(): Promise<(video: HTMLVideoElement) => Promise<string | null>> {
  const Native = (globalThis as { BarcodeDetector?: DetectorClass }).BarcodeDetector
  if (Native) {
    const formats = (await Native.getSupportedFormats?.().catch(() => [])) ?? []
    if (formats.includes('qr_code')) {
      const detector = new Native({ formats: ['qr_code'] })
      return async (video) => (await detector.detect(video))[0]?.rawValue ?? null
    }
  }
  const { default: jsQR } = await import('jsqr')
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })
  return async (video) => {
    if (!context || !video.videoWidth) return null
    const scale = Math.min(1, 640 / video.videoWidth)
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const image = context.getImageData(0, 0, canvas.width, canvas.height)
    return jsQR(image.data, image.width, image.height)?.data ?? null
  }
}

/** Full-screen camera with a frame; answers with the first QR code read, or null. */
export function QrScannerOverlay({ overlay, locale }: OverlayProps) {
  const strings = messages[locale].catalog.runtime.scanner
  const video = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let done = false
    const finish = (value: unknown) => {
      if (done) return
      done = true
      overlay.resolve(value)
    }
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
        if (done) return
        const element = video.current
        if (!element) return
        element.srcObject = stream
        await element.play().catch(() => undefined)
        setReady(true)
        const read = await makeReader()
        const loop = async () => {
          if (done) return
          const text = await read(element).catch(() => null)
          if (text) finish({ text })
          else timer = setTimeout(() => void loop(), SCAN_EVERY_MS)
        }
        void loop()
      } catch (error) {
        finish({ error })
      }
    })()
    return () => {
      done = true
      clearTimeout(timer)
      for (const track of stream?.getTracks() ?? []) track.stop()
    }
  }, [overlay])

  return (
    <div className="rx-overlay" role="dialog" aria-modal="true" aria-label={strings.title}>
      <div className="rx-overlay-bar">
        <span>{ready ? strings.title : strings.starting}</span>
        <button type="button" onClick={() => overlay.resolve(null)}>
          {strings.cancel}
        </button>
      </div>
      <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex' }}>
        <video ref={video} muted playsInline autoPlay />
        <div className="rx-scan-frame" aria-hidden="true" />
      </div>
    </div>
  )
}
