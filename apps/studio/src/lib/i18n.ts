import type { Locale, Messages, messages } from '@rublox/i18n'
import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'studio'
    resources: (typeof messages)['fr']
  }
}

const NAMESPACES = ['studio', 'blocks', 'runtime', 'catalog'] as const

/**
 * The strings of one language, loaded on demand: the studio's first download carries only the
 * language in use (SPEC § 7). The editor's packages read both from `@rublox/i18n` later.
 */
async function strings(locale: Locale): Promise<Messages> {
  return locale === 'en'
    ? (await import('@rublox/i18n/en')).en
    : (await import('@rublox/i18n/fr')).fr
}

async function addLanguage(locale: Locale) {
  if (i18next.hasResourceBundle(locale, 'studio')) return
  const loaded = await strings(locale)
  for (const ns of NAMESPACES) i18next.addResourceBundle(locale, ns, loaded[ns], true, true)
}

/** i18next with the studio's strings; `t('key')` is type-checked against the French file. */
export async function initI18n(locale: Locale) {
  await i18next.use(initReactI18next).init({
    lng: locale,
    // French is the reference: an English string missing would show the French one.
    fallbackLng: 'fr',
    defaultNS: 'studio',
    ns: [...NAMESPACES],
    resources: {},
    interpolation: { escapeValue: false },
    returnNull: false,
  })
  await Promise.all([addLanguage(locale), locale === 'fr' ? null : addLanguage('fr')])
  await i18next.changeLanguage(locale)
  return i18next
}

/** Switches the interface's language, loading its strings first. */
export async function setLanguage(locale: Locale) {
  await addLanguage(locale)
  await i18next.changeLanguage(locale)
}

export { i18next }
