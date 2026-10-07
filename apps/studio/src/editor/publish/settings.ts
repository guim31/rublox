import type { AppSettings, ProjectDoc } from '@rublox/schema'
import { config } from '../../lib/config.ts'

const HEX = /^#[0-9a-fA-F]{6}$/

function hexOr(value: string, fallback: string): string {
  return HEX.test(value) ? value.toLowerCase() : fallback
}

/** First settings of an app never published: its name and the project's theme. */
export function defaultAppSettings(doc: ProjectDoc): AppSettings {
  const primary = hexOr(doc.settings.theme.primary, '#5b4bff')
  return {
    name: doc.meta.name.slice(0, 40) || 'Rublox',
    description: (doc.meta.description ?? '').slice(0, 300),
    themeColor: primary,
    backgroundColor: hexOr(doc.settings.theme.background, '#ffffff'),
    icon: { kind: 'emoji', emoji: '🚀', background: primary },
  }
}

/** The address of a published app on the apps origin. */
export function appAddress(slug: string): string {
  return `${config.appsUrl.replace(/\/$/, '')}/a/${slug}/`
}
