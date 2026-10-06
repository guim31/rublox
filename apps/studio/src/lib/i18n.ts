import { type Locale, messages } from '@rublox/i18n'
import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'studio'
    resources: (typeof messages)['fr']
  }
}

/** i18next with the studio's strings; `t('key')` is type-checked against the French file. */
export function initI18n(locale: Locale) {
  void i18next.use(initReactI18next).init({
    lng: locale,
    fallbackLng: 'fr',
    defaultNS: 'studio',
    ns: ['studio', 'blocks', 'runtime'],
    resources: {
      fr: { ...messages.fr },
      en: { ...messages.en },
    },
    interpolation: { escapeValue: false },
    returnNull: false,
  })
  return i18next
}

export { i18next }
