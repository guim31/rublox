import { format, messages } from '@rublox/i18n'
import type { Locale, UiMode } from '@rublox/schema'

/** Thrown into running code when the app stops: never reported. */
export class StopSignal extends Error {
  override name = 'StopSignal'
  constructor() {
    super('stopped')
  }
}

type FriendlyKey = keyof (typeof messages)['fr']['runtime']['friendly']

/**
 * An error raised on purpose by the engine's helpers, with what a learner needs to know (a
 * list's length and the position asked). Its message is written in the interface language.
 */
export class RxError extends Error {
  override name = 'RxError'
  constructor(
    readonly code: FriendlyKey,
    readonly values: Record<string, string | number> = {},
  ) {
    super(code)
  }
}

/** `n` → `5ᵉ` in French, `5th` in English. */
function ordinal(n: number, locale: Locale): string {
  if (locale === 'fr') return n === 1 ? '1ᵉʳ' : `${n}ᵉ`
  const tens = n % 100
  const suffix = tens >= 11 && tens <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th')
  return `${n}${suffix}`
}

/** `rx.item(list, index)`: the item at `index` (from 1), or an error a child understands. */
export function listItem(list: unknown, index: unknown): unknown {
  const position = Number(index)
  if (typeof list === 'string') list = [...list]
  if (!Array.isArray(list)) throw new RxError('notAList')
  if (list.length === 0) throw new RxError('emptyList', { index: position })
  if (!Number.isInteger(position) || position < 1 || position > list.length)
    throw new RxError('listIndex', { length: list.length, index: position })
  return list[position - 1]
}

/** The plain-language explanation of an error, or `undefined` when there is none. */
function explain(error: unknown, locale: Locale): string | undefined {
  const strings = messages[locale].runtime
  if (error instanceof RxError) {
    const values: Record<string, unknown> = { ...error.values }
    if (typeof values.index === 'number') values.nth = ordinal(values.index, locale)
    return format(strings.friendly[error.code], values)
  }
  const text = error instanceof Error ? error.message : String(error)
  if (error instanceof RangeError && /call stack|recursion/i.test(text))
    return strings.errors.tooMuchRecursion
  if (error instanceof RangeError && /array length/i.test(text)) return strings.friendly.badLength
  if (error instanceof TypeError && /is not iterable/i.test(text)) return strings.friendly.notAList
  if (error instanceof TypeError && /is not a function/i.test(text))
    return strings.errors.notAFunction
  if (error instanceof TypeError && /undefined|null/i.test(text)) {
    const property = /reading '([^']+)'/.exec(text)?.[1]
    return property
      ? format(strings.friendly.emptyValueProperty, { property })
      : strings.errors.undefinedValue
  }
  if (error instanceof SyntaxError && /JSON/i.test(text)) return strings.friendly.badJson
  if (error instanceof ReferenceError) return strings.friendly.unknownName
  return undefined
}

/**
 * An error message a learner can act on. Junior gets plain words only; Studio also gets the
 * JavaScript error, to learn to read it.
 */
export function friendlyError(error: unknown, locale: Locale, mode: UiMode): string {
  const strings = messages[locale].runtime.errors
  const friendly = explain(error, locale)
  const text = error instanceof Error ? error.message : String(error)
  if (!friendly) return format(strings.generic, { message: text })
  if (mode === 'junior' || error instanceof RxError) return friendly
  const raw = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  return `${friendly} (${raw})`
}
