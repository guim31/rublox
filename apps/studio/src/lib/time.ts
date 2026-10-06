import type { TFunction } from 'i18next'

/** "il y a 5 min", or a date beyond a week. */
export function relativeTime(iso: string, t: TFunction, locale: string, now = Date.now()): string {
  const seconds = Math.max(0, (now - Date.parse(iso)) / 1000)
  if (seconds < 60) return t('dashboard.time.now')
  if (seconds < 3600) return t('dashboard.time.minutes', { count: Math.floor(seconds / 60) })
  if (seconds < 86400) return t('dashboard.time.hours', { count: Math.floor(seconds / 3600) })
  if (seconds < 7 * 86400) return t('dashboard.time.days', { count: Math.floor(seconds / 86400) })
  return new Date(iso).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
