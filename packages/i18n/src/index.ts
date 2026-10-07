import { en } from './en/index.ts'
import { fr } from './fr/index.ts'
import type { Locale } from './locale.ts'
import type { Messages } from './types.ts'

export { DEFAULT_LOCALE, detectLocale, isLocale, LOCALES, type Locale } from './locale.ts'
export type { Messages } from './types.ts'

export const messages: Record<Locale, Messages> = { fr, en }

/** `{{name}}` interpolation, the same syntax as i18next, for packages that do not use it. */
export function format(template: string, values: Record<string, unknown> = {}): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => String(values[key] ?? ''))
}

/** Reads a dotted key (`blocks.code.note`) from a language's messages. */
export function lookup(locale: Locale, key: string): string {
  let node: unknown = messages[locale]
  for (const part of key.split('.')) {
    node = (node as Record<string, unknown> | undefined)?.[part]
  }
  return typeof node === 'string' ? node : key
}
