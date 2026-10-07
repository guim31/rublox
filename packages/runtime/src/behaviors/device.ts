import { format, messages } from '@rublox/i18n'
import type { BehaviorContext } from './types.ts'

export type Permission = keyof (typeof messages)['fr']['catalog']['runtime']['what']

function strings(ctx: BehaviorContext) {
  return messages[ctx.locale].catalog.runtime
}

/** "You refused access to the camera…" */
export function deniedMessage(ctx: BehaviorContext, what: Permission): string {
  return format(strings(ctx).denied, { what: strings(ctx).what[what] })
}

/** "This browser cannot do this: …" (the component's label in the app's words). */
export function unavailableMessage(ctx: BehaviorContext, feature: string): string {
  return format(strings(ctx).unavailable, { feature })
}

export function failedMessage(ctx: BehaviorContext, error: unknown): string {
  const text = error instanceof Error ? error.message : String(error ?? '')
  return format(strings(ctx).failed, { message: text })
}

export function noSourceMessage(ctx: BehaviorContext): string {
  return strings(ctx).noSource
}

/** Whether an error means the person (or the browser settings) refused a permission. */
export function isDenied(error: unknown): boolean {
  const name = (error as { name?: unknown } | null)?.name
  const code = (error as { code?: unknown } | null)?.code
  return (
    name === 'NotAllowedError' ||
    name === 'PermissionDeniedError' ||
    name === 'SecurityError' ||
    code === 1 ||
    error === 'not-allowed' ||
    error === 'denied'
  )
}

/** Reports a failure the way a child can act on it: refused, missing, or something else. */
export function report(ctx: BehaviorContext, error: unknown, what: Permission, feature: string) {
  const name = (error as { name?: unknown } | null)?.name
  if (isDenied(error)) ctx.fail(deniedMessage(ctx, what))
  else if (
    name === 'NotFoundError' ||
    name === 'NotSupportedError' ||
    name === 'OverconstrainedError'
  )
    ctx.fail(unavailableMessage(ctx, feature))
  else ctx.fail(failedMessage(ctx, error))
}

/** Browser globals, read lazily (tests and old browsers may lack them). */
export function nav(): Navigator | undefined {
  return globalThis.navigator
}

export function mediaDevices(): MediaDevices | undefined {
  return nav()?.mediaDevices
}

/** The app's language as a BCP 47 tag, for speech. */
export function speechLanguage(value: unknown, locale: 'fr' | 'en'): string {
  return typeof value === 'string' && value !== 'auto' ? value : locale === 'fr' ? 'fr-FR' : 'en-US'
}

/** Opens the phone's file picker (or camera) and resolves with a `blob:` URL, `''` if cancelled. */
export function pickFile(accept: string, capture?: 'user' | 'environment'): Promise<string> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    if (capture) input.setAttribute('capture', capture)
    input.style.display = 'none'
    document.body.append(input)
    const done = (url: string) => {
      input.remove()
      resolve(url)
    }
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      done(file ? URL.createObjectURL(file) : '')
    })
    input.addEventListener('cancel', () => done(''))
    input.click()
  })
}

/** Resolves after `ms`, unless the component's screen closes first. */
export function delay(ctx: BehaviorContext, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(ctx.alive()), ms)
    ctx.onDispose(() => {
      clearTimeout(timer)
      resolve(false)
    })
  })
}
