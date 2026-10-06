import type { GeneratedCode } from '@rublox/blocks'
import { isPlayerMessage, type StudioToPlayer } from '@rublox/runtime'
import type { ProjectDoc, ScreenId, WorkspaceKey } from '@rublox/schema'
import { Moon, RotateCw, Square, Sun } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PhoneFrame } from '../../components/phone.tsx'
import { IconButton } from '../../components/ui/button.tsx'
import { cn } from '../../lib/cn.ts'
import { appsOrigin, config } from '../../lib/config.ts'
import { usePrefs } from '../../lib/prefs.ts'
import { useAssetsVersion, useSession } from '../context.tsx'
import { DEVICES, useEditor } from '../store.ts'

/**
 * The live preview: the player on the apps origin in an iframe (SPEC § 6.6), fed with the
 * project and its generated code on every change.
 */
export function Preview({
  doc,
  code,
  screenId,
}: {
  doc: ProjectDoc
  code: Record<WorkspaceKey, GeneratedCode>
  screenId: ScreenId
}) {
  const { t } = useTranslation()
  const session = useSession()
  const { mode, locale } = usePrefs()
  const { running, appScheme, set } = useEditor()
  const assetsVersion = useAssetsVersion()
  const frame = useRef<HTMLIFrameElement>(null)
  const area = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [scale, setScale] = useState(0.8)
  const sentAssets = useRef(-1)
  const { width, height } = DEVICES.phone

  const post = (message: StudioToPlayer) =>
    frame.current?.contentWindow?.postMessage(message, appsOrigin)

  // Messages from the player: only from our iframe, on the apps origin.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== appsOrigin || event.source !== frame.current?.contentWindow) return
      const message: unknown = event.data
      if (!isPlayerMessage(message)) return
      if (message.type === 'rx:ready') {
        sentAssets.current = -1
        setReady(true)
      } else if (message.type === 'rx:log') useEditor.getState().log(message.entry)
      else if (message.type === 'rx:state') useEditor.getState().set({ running: message.running })
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // Send the project whenever it (or its code) changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `post` only reads a ref
  useEffect(() => {
    if (!ready) return
    let cancelled = false
    void (async () => {
      const assets = sentAssets.current !== assetsVersion ? await session.assetBlobs() : undefined
      if (cancelled) return
      sentAssets.current = assetsVersion
      post({ type: 'rx:load', doc, code, assets, locale, mode, scheme: appScheme, screenId })
    })()
    return () => {
      cancelled = true
    }
  }, [ready, doc, code, assetsVersion, locale, mode, screenId, session])

  // The preview follows the screen being edited.
  const shownScreen = useRef(screenId)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `post` only reads a ref
  useEffect(() => {
    if (!ready || shownScreen.current === screenId) return
    shownScreen.current = screenId
    post({ type: 'rx:restart', screenId })
  }, [ready, screenId])

  // biome-ignore lint/correctness/useExhaustiveDependencies: `post` only reads a ref
  useEffect(() => {
    if (ready) post({ type: 'rx:scheme', scheme: appScheme })
  }, [ready, appScheme])

  // Commands (palette, shortcuts) reach the preview through the editor store.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `post` only reads a ref
  useEffect(() => {
    set({
      preview: {
        restart: () => post({ type: 'rx:restart', screenId }),
        stop: () => post({ type: 'rx:stop' }),
      },
    })
    return () => set({ preview: null })
  }, [screenId, set])

  useLayoutEffect(() => {
    const element = area.current
    if (!element) return
    const update = () => {
      const next = Math.min(
        (element.clientWidth - 32) / (width + 20),
        (element.clientHeight - 32) / (height + 20),
        1,
      )
      setScale(Math.max(0.35, next))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [width, height])

  return (
    <section
      aria-label={t('editor.preview.title')}
      className="flex h-full min-h-0 flex-col bg-canvas"
    >
      <header className="flex h-11 shrink-0 items-center gap-1 border-b border-border bg-surface/80 px-2 junior:h-14">
        <h2 className="flex items-center gap-2 px-1 font-strong">
          {t('editor.preview.title')}
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-strong',
              running ? 'bg-mint-soft text-mint-text' : 'bg-surface-3 text-muted',
            )}
            data-testid="preview-state"
          >
            <span className={cn('size-1.5 rounded-full', running ? 'bg-mint' : 'bg-muted')} />
            {running ? t('editor.preview.running') : t('editor.preview.stopped')}
          </span>
        </h2>
        <div className="flex-1" />
        <IconButton
          size="sm"
          label={appScheme === 'light' ? t('editor.preview.darkApp') : t('editor.preview.lightApp')}
          onClick={() => set({ appScheme: appScheme === 'light' ? 'dark' : 'light' })}
        >
          {appScheme === 'light' ? <Sun size={15} /> : <Moon size={15} />}
        </IconButton>
        <IconButton
          size="sm"
          label={t('editor.preview.restart')}
          onClick={() => post({ type: 'rx:restart', screenId })}
          data-testid="preview-restart"
        >
          <RotateCw size={15} />
        </IconButton>
        <IconButton
          size={mode === 'junior' ? 'md' : 'sm'}
          variant={running ? 'danger' : 'ghost'}
          label={t('editor.preview.stop')}
          disabled={!running}
          onClick={() => post({ type: 'rx:stop' })}
          data-testid="preview-stop"
        >
          <Square size={13} fill="currentColor" />
        </IconButton>
      </header>
      <div
        ref={area}
        className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4"
      >
        <PhoneFrame width={width} height={height} scale={scale} dark={appScheme === 'dark'}>
          <iframe
            ref={frame}
            title={t('editor.preview.frame')}
            src={`${config.appsUrl.replace(/\/$/, '')}/`}
            allow="camera; microphone; geolocation; accelerometer; gyroscope; clipboard-write; web-share; fullscreen; autoplay"
            className="size-full"
            data-testid="preview-frame"
          />
        </PhoneFrame>
      </div>
    </section>
  )
}
