import { componentLabel } from '@rublox/catalog'
import type { CameraViewHandle } from '../components/media-handles.ts'
import {
  delay,
  deniedMessage,
  failedMessage,
  mediaDevices,
  nav,
  pickFile,
  report,
  speechLanguage,
  unavailableMessage,
} from './device.ts'
import type { Behavior, BehaviorContext } from './types.ts'

const label = (ctx: BehaviorContext) => componentLabel(ctx.type, ctx.locale)
const text = (value: unknown) => (value == null ? '' : String(value))

// Camera view: a live stream in the screen

const streams = new WeakMap<BehaviorContext, MediaStream>()

function stopCamera(ctx: BehaviorContext) {
  for (const track of streams.get(ctx)?.getTracks() ?? []) track.stop()
  streams.delete(ctx)
  const video = ctx.handle<CameraViewHandle>()?.video()
  if (video) video.srcObject = null
  if (ctx.alive()) ctx.set('running', false)
}

async function startCamera(ctx: BehaviorContext) {
  const devices = mediaDevices()
  if (!devices?.getUserMedia) {
    ctx.fail(unavailableMessage(ctx, label(ctx)))
    return
  }
  stopCamera(ctx)
  try {
    const stream = await devices.getUserMedia({
      video: { facingMode: ctx.get('facing') === 'front' ? 'user' : 'environment' },
      audio: false,
    })
    if (!ctx.alive()) {
      for (const track of stream.getTracks()) track.stop()
      return
    }
    streams.set(ctx, stream)
    const video = ctx.handle<CameraViewHandle>()?.video()
    if (video) {
      video.srcObject = stream
      await video.play().catch(() => undefined)
    }
    ctx.set('running', true)
  } catch (error) {
    report(ctx, error, 'camera', label(ctx))
  }
}

/** A still image of a playing video element, as a JPEG `data:` URL. */
export function snapshot(video: HTMLVideoElement, mirror = false): string {
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth || 640
  canvas.height = video.videoHeight || 480
  const context = canvas.getContext('2d')
  if (!context) return ''
  if (mirror) {
    context.translate(canvas.width, 0)
    context.scale(-1, 1)
  }
  context.drawImage(video, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.85)
}

export const cameraViewBehavior: Behavior = {
  available: () => Boolean(mediaDevices()?.getUserMedia),
  mount: (ctx) => {
    ctx.onDispose(() => stopCamera(ctx))
    if (ctx.get('autostart') === true) void startCamera(ctx)
  },
  methods: {
    start: (ctx) => startCamera(ctx),
    stop: (ctx) => stopCamera(ctx),
    takePhoto: (ctx) => {
      const video = ctx.handle<CameraViewHandle>()?.video()
      if (!video || !streams.has(ctx)) return ''
      return snapshot(video, ctx.get('facing') === 'front' && ctx.get('mirror') !== false)
    },
  },
}

// Audio recorder

type Recording = { recorder: MediaRecorder; stream: MediaStream; chunks: Blob[] }
const recordings = new WeakMap<BehaviorContext, Recording>()

export const audioRecorderBehavior: Behavior = {
  available: () =>
    Boolean(mediaDevices()?.getUserMedia) && typeof globalThis.MediaRecorder === 'function',
  mount: (ctx) =>
    ctx.onDispose(() => {
      const recording = recordings.get(ctx)
      if (recording?.recorder.state === 'recording') recording.recorder.stop()
      for (const track of recording?.stream.getTracks() ?? []) track.stop()
    }),
  methods: {
    start: async (ctx) => {
      const devices = mediaDevices()
      if (!devices?.getUserMedia || typeof globalThis.MediaRecorder !== 'function') {
        ctx.fail(unavailableMessage(ctx, label(ctx)))
        return
      }
      if (recordings.get(ctx)?.recorder.state === 'recording') return
      try {
        const stream = await devices.getUserMedia({ audio: true })
        const recorder = new MediaRecorder(stream)
        const recording: Recording = { recorder, stream, chunks: [] }
        recorder.addEventListener('dataavailable', (event) => {
          if (event.data.size) recording.chunks.push(event.data)
        })
        recordings.set(ctx, recording)
        recorder.start()
        ctx.set('recording', true)
      } catch (error) {
        report(ctx, error, 'microphone', label(ctx))
      }
    },
    stop: (ctx) =>
      new Promise<string>((resolve) => {
        const recording = recordings.get(ctx)
        if (recording?.recorder.state !== 'recording') {
          resolve(text(ctx.get('lastRecording')))
          return
        }
        recording.recorder.addEventListener(
          'stop',
          () => {
            for (const track of recording.stream.getTracks()) track.stop()
            const blob = new Blob(recording.chunks, {
              type: recording.recorder.mimeType || 'audio/webm',
            })
            const url = URL.createObjectURL(blob)
            recordings.delete(ctx)
            if (ctx.alive()) {
              ctx.set('recording', false)
              ctx.set('lastRecording', url)
              ctx.emit('done', { sound: url })
            }
            resolve(url)
          },
          { once: true },
        )
        recording.recorder.stop()
      }),
  },
}

// Text to speech

export const textToSpeechBehavior: Behavior = {
  available: () => typeof globalThis.speechSynthesis !== 'undefined',
  mount: (ctx) => ctx.onDispose(() => globalThis.speechSynthesis?.cancel()),
  methods: {
    say: (ctx, value) =>
      new Promise<void>((resolve) => {
        const synth = globalThis.speechSynthesis
        if (!synth || typeof SpeechSynthesisUtterance !== 'function') {
          ctx.fail(unavailableMessage(ctx, label(ctx)))
          return resolve()
        }
        const utterance = new SpeechSynthesisUtterance(text(value))
        utterance.lang = speechLanguage(ctx.get('language'), ctx.locale)
        utterance.rate = Number(ctx.get('rate')) || 1
        utterance.pitch = Number(ctx.get('pitch')) || 1
        utterance.onend = () => resolve()
        utterance.onerror = (event) => {
          if (event.error !== 'interrupted' && event.error !== 'canceled')
            ctx.fail(failedMessage(ctx, event.error))
          resolve()
        }
        synth.speak(utterance)
      }),
    stop: () => globalThis.speechSynthesis?.cancel(),
  },
}

// Speech recognition (Chrome, Safari)

type Recognition = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}
type RecognitionConstructor = new () => Recognition

function recognitionClass(): RecognitionConstructor | undefined {
  const g = globalThis as {
    SpeechRecognition?: RecognitionConstructor
    webkitSpeechRecognition?: RecognitionConstructor
  }
  return g.SpeechRecognition ?? g.webkitSpeechRecognition
}

const listeners = new WeakMap<BehaviorContext, Recognition>()

export const speechRecognitionBehavior: Behavior = {
  available: () => Boolean(recognitionClass()),
  mount: (ctx) => ctx.onDispose(() => listeners.get(ctx)?.abort()),
  methods: {
    listen: (ctx) =>
      new Promise<string>((resolve) => {
        const Recognition = recognitionClass()
        if (!Recognition) {
          ctx.fail(unavailableMessage(ctx, label(ctx)))
          return resolve('')
        }
        listeners.get(ctx)?.abort()
        const recognition = new Recognition()
        recognition.lang = speechLanguage(ctx.get('language'), ctx.locale)
        recognition.interimResults = false
        recognition.maxAlternatives = 1
        let heard = ''
        recognition.onresult = (event) => {
          heard = event.results[0]?.[0]?.transcript ?? ''
        }
        recognition.onerror = (event) => {
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed')
            ctx.fail(deniedMessage(ctx, 'microphone'))
          else if (event.error !== 'no-speech' && event.error !== 'aborted')
            ctx.fail(failedMessage(ctx, event.error))
        }
        recognition.onend = () => {
          listeners.delete(ctx)
          if (ctx.alive()) {
            ctx.set('listening', false)
            if (heard) {
              ctx.set('lastText', heard)
              ctx.emit('result', { text: heard })
            }
          }
          resolve(heard)
        }
        listeners.set(ctx, recognition)
        ctx.set('listening', true)
        try {
          recognition.start()
        } catch (error) {
          ctx.fail(failedMessage(ctx, error))
          resolve('')
        }
      }),
    stop: (ctx) => listeners.get(ctx)?.stop(),
  },
}

// Vibrator (not on iPhone)

export const vibratorBehavior: Behavior = {
  available: () => typeof nav()?.vibrate === 'function',
  methods: {
    vibrate: (ctx, seconds) => {
      const vibrate = nav()?.vibrate
      if (typeof vibrate !== 'function') {
        ctx.fail(unavailableMessage(ctx, label(ctx)))
        return
      }
      const ms = Math.min(10000, Math.max(0, (Number(seconds) || 0.2) * 1000))
      nav()?.vibrate(Math.round(ms))
    },
  },
}

// Camera and photo picker: the phone's own screens

export const cameraBehavior: Behavior = {
  methods: {
    takePhoto: async (ctx) => {
      const url = await pickFile('image/*', ctx.get('facing') === 'front' ? 'user' : 'environment')
      if (url && ctx.alive()) ctx.set('lastPhoto', url)
      return url
    },
  },
}

export const photoPickerBehavior: Behavior = {
  methods: {
    pick: async (ctx) => {
      const url = await pickFile('image/*')
      if (url && ctx.alive()) ctx.set('lastPhoto', url)
      return url
    },
  },
}

// Share and clipboard

async function writeClipboard(value: string): Promise<void> {
  if (nav()?.clipboard?.writeText) {
    await nav()?.clipboard.writeText(value)
    return
  }
  const area = document.createElement('textarea')
  area.value = value
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.append(area)
  area.select()
  document.execCommand('copy')
  area.remove()
}

export const shareBehavior: Behavior = {
  available: () => typeof nav()?.share === 'function',
  methods: {
    share: async (ctx, value, url) => {
      const data: ShareData = { text: text(value) }
      if (/^https?:\/\//i.test(text(url))) data.url = text(url)
      try {
        if (typeof nav()?.share === 'function') await nav()?.share(data)
        else await writeClipboard([data.text, data.url].filter(Boolean).join(' '))
      } catch (error) {
        // Closing the share sheet is not an error.
        if ((error as { name?: string })?.name !== 'AbortError')
          report(ctx, error, 'clipboard', label(ctx))
      }
    },
  },
}

export const clipboardBehavior: Behavior = {
  methods: {
    copy: async (ctx, value) => {
      try {
        await writeClipboard(text(value))
      } catch (error) {
        report(ctx, error, 'clipboard', label(ctx))
      }
    },
    paste: async (ctx) => {
      try {
        if (!nav()?.clipboard?.readText) {
          ctx.fail(unavailableMessage(ctx, label(ctx)))
          return ''
        }
        return (await nav()?.clipboard.readText()) ?? ''
      } catch (error) {
        report(ctx, error, 'clipboard', label(ctx))
        return ''
      }
    },
  },
}

// Local notifications

async function notify(ctx: BehaviorContext, title: unknown, body: unknown) {
  const N = globalThis.Notification
  if (typeof N !== 'function') {
    ctx.fail(unavailableMessage(ctx, label(ctx)))
    return
  }
  try {
    const permission = N.permission === 'default' ? await N.requestPermission() : N.permission
    if (permission !== 'granted') {
      ctx.fail(deniedMessage(ctx, 'notifications'))
      return
    }
    const options = { body: text(body), lang: ctx.locale }
    // Android only shows notifications through a service worker (published apps, J4).
    const registration = await nav()
      ?.serviceWorker?.getRegistration?.()
      .catch(() => undefined)
    if (registration) {
      await registration.showNotification(text(title), options)
      return
    }
    const notification = new N(text(title), options)
    notification.onclick = () => {
      globalThis.focus?.()
      ctx.emit('click')
    }
  } catch (error) {
    report(ctx, error, 'notifications', label(ctx))
  }
}

export const notifierBehavior: Behavior = {
  available: () => typeof globalThis.Notification === 'function',
  methods: {
    notify: (ctx, title, body) => notify(ctx, title, body),
    notifyLater: async (ctx, seconds, title, body) => {
      const ms = Math.max(0, Number(seconds) || 0) * 1000
      // Later, but not blocking the blocks that follow.
      void delay(ctx, ms).then((alive) => {
        if (alive) void notify(ctx, title, body)
      })
    },
  },
}

// QR code scanner: a full-screen panel (see overlays/qr-scanner.tsx)

export type ScanResult = { text: string } | { error: unknown }

export const qrScannerBehavior: Behavior = {
  available: () => Boolean(mediaDevices()?.getUserMedia),
  methods: {
    scan: async (ctx) => {
      if (!mediaDevices()?.getUserMedia) {
        ctx.fail(unavailableMessage(ctx, label(ctx)))
        return ''
      }
      const result = await ctx.overlay<ScanResult | null>('qr-scanner')
      if (!result) return ''
      if ('error' in result) {
        report(ctx, result.error, 'camera', label(ctx))
        return ''
      }
      if (ctx.alive()) {
        ctx.set('lastText', result.text)
        ctx.emit('scan', { text: result.text })
      }
      return result.text
    },
  },
}
