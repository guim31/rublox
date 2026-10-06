import { en } from './en/index.ts'
import { fr } from './fr/index.ts'
import type { Messages } from './types.ts'

export type { Messages } from './types.ts'

export const LOCALES = ['fr', 'en'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'fr'

export const messages: Record<Locale, Messages> = { fr, en }

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

/** The browser's preferred supported language, French otherwise. */
export function detectLocale(
  languages: readonly string[] = globalThis.navigator?.languages ?? [],
): Locale {
  for (const language of languages) {
    const base = language.toLowerCase().split('-')[0]
    if (isLocale(base)) return base
  }
  return DEFAULT_LOCALE
}

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
