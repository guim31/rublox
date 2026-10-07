import { format, messages } from '@rublox/i18n'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AppIcon } from '../icons.tsx'
import type { CameraViewHandle, LottieHandle, VideoHandle } from './media-handles.ts'
import { type Renderer, rootAttributes, useExpose } from './types.ts'

export const VideoRenderer: Renderer = (p) => {
  const ref = useRef<HTMLVideoElement>(null)
  const handle = useMemo<VideoHandle>(() => ({ element: () => ref.current }), [])
  useExpose(p, handle)
  const src = typeof p.props.src === 'string' && p.props.src ? p.assetUrl(p.props.src) : undefined
  return (
    <div
      {...rootAttributes(p, 'Video')}
      className="rx-media"
      style={{ overflow: 'hidden', ...p.style }}
    >
      {src ? (
        <video
          ref={ref}
          src={src}
          controls={p.props.controls !== false && !p.design}
          autoPlay={p.props.autoplay === true && !p.design}
          loop={p.props.loop === true}
          muted={p.props.muted === true}
          playsInline
          preload="metadata"
          style={{ objectFit: p.props.fit === 'cover' ? 'cover' : 'contain' }}
          onEnded={() => p.emit('ended')}
          onPlay={() => p.setValue('playing', true)}
          onPause={() => p.setValue('playing', false)}
          onTimeUpdate={(event) =>
            p.setValue('position', Math.round(event.currentTarget.currentTime * 10) / 10)
          }
          onError={() =>
            p.emit('error', {
              message: format(messages[p.locale].catalog.runtime.failed, {
                message: messages[p.locale].catalog.runtime.video,
              }),
            })
          }
        />
      ) : (
        <Placeholder icon="video" label={messages[p.locale].catalog.runtime.video} />
      )}
    </div>
  )
}

function Placeholder({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="rx-placeholder">
      <AppIcon name={icon} size={32} />
      <span>{label}</span>
    </div>
  )
}

export const LottieRenderer: Renderer = (p) => {
  const box = useRef<HTMLDivElement>(null)
  const animation = useRef<ReturnType<LottieHandle['animation']>>(null)
  const handle = useMemo<LottieHandle>(() => ({ animation: () => animation.current }), [])
  useExpose(p, handle)
  const src = typeof p.props.src === 'string' && p.props.src ? p.assetUrl(p.props.src) : undefined
  const loop = p.props.loop !== false
  const autoplay = p.props.autoplay !== false
  const speed = Number(p.props.speed) || 1
  // `emit` is a new function at each render: read it through a ref, not as a dependency.
  const emitRef = useRef(p.emit)
  emitRef.current = p.emit
  const { design } = p
  useEffect(() => {
    const emit: typeof emitRef.current = (...args) => emitRef.current(...args)
    const container = box.current
    if (!src || !container) return
    let cancelled = false
    let destroy = () => {}
    void (async () => {
      try {
        const [{ default: lottie }, data] = await Promise.all([
          import('lottie-web/build/player/lottie_light'),
          fetch(src).then((response) => response.json()),
        ])
        if (cancelled) return
        const anim = lottie.loadAnimation({
          container,
          renderer: 'svg',
          loop,
          autoplay: autoplay || design,
          animationData: data,
        })
        anim.setSpeed(speed)
        anim.addEventListener('complete', () => emit('complete'))
        animation.current = anim
        destroy = () => anim.destroy()
      } catch (error) {
        if (!design) emit('error', { message: String((error as Error)?.message ?? error) })
      }
    })()
    return () => {
      cancelled = true
      animation.current = null
      destroy()
    }
  }, [src, loop, autoplay, speed, design])
  return (
    <div {...rootAttributes(p, 'Lottie')} className="rx-lottie" style={p.style}>
      <div ref={box} className="rx-lottie-box" aria-hidden="true" />
      {src ? null : (
        <Placeholder icon="sparkles" label={messages[p.locale].catalog.runtime.lottie} />
      )}
    </div>
  )
}

export const WebViewRenderer: Renderer = (p) => {
  const url = String(p.props.url ?? '')
  const safe = /^https:\/\/\S+$/i.test(url)
  const [reloads, setReloads] = useState(0)
  const handle = useMemo(() => ({ reload: () => setReloads((n) => n + 1) }), [])
  useExpose(p, handle)
  const strings = messages[p.locale].catalog.runtime
  return (
    <div
      {...rootAttributes(p, 'WebView')}
      className="rx-media rx-web"
      style={{ overflow: 'hidden', ...p.style }}
    >
      {safe && !p.design ? (
        <iframe
          key={reloads}
          src={url}
          title={p.name}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          referrerPolicy="no-referrer"
          onLoad={() => p.emit('load')}
        />
      ) : (
        <div className="rx-placeholder">
          <AppIcon name="globe" size={32} />
          <span>{strings.web}</span>
          <small>{safe ? url : strings.webHint}</small>
        </div>
      )}
    </div>
  )
}

export const CameraViewRenderer: Renderer = (p) => {
  const ref = useRef<HTMLVideoElement>(null)
  const handle = useMemo<CameraViewHandle>(() => ({ video: () => ref.current }), [])
  useExpose(p, handle)
  const running = p.props.running === true
  const mirror = p.props.mirror !== false && p.props.facing === 'front'
  return (
    <div
      {...rootAttributes(p, 'CameraView')}
      className="rx-media"
      style={{ overflow: 'hidden', ...p.style }}
    >
      <video
        ref={ref}
        muted
        playsInline
        autoPlay
        aria-label={p.name}
        style={{
          transform: mirror ? 'scaleX(-1)' : undefined,
          display: running ? undefined : 'none',
          objectFit: 'cover',
        }}
      />
      {running ? null : (
        <Placeholder icon="camera" label={messages[p.locale].catalog.runtime.camera.off} />
      )}
    </div>
  )
}
