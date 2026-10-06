import { format, messages } from '@rublox/i18n'
import type { Locale, UiMode } from '@rublox/schema'

/** Thrown into running code when the app stops: never reported. */
export class StopSignal extends Error {
  override name = 'StopSignal'
  constructor() {
    super('stopped')
  }
}

/**
 * An error message a learner can act on. Junior gets plain words only; Studio also gets the
 * JavaScript error, to learn to read it.
 */
export function friendlyError(error: unknown, locale: Locale, mode: UiMode): string {
  const strings = messages[locale].runtime.errors
  const raw = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  const text = error instanceof Error ? error.message : String(error)
  let friendly: string
  if (error instanceof RangeError && /call stack/i.test(text)) friendly = strings.tooMuchRecursion
  else if (error instanceof TypeError && /is not a function/i.test(text))
    friendly = strings.notAFunction
  else if (error instanceof TypeError && /undefined|null/i.test(text))
    friendly = strings.undefinedValue
  else return format(strings.generic, { message: text })
  return mode === 'studio' ? `${friendly} (${raw})` : friendly
}
