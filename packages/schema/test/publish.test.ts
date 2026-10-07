import { describe, expect, it } from 'vitest'
import { appSettingsSchema, isValidSlug, liveFromPhoneSchema, slugify } from '../src/index.ts'

describe('slugs', () => {
  it('accepts simple addresses only', () => {
    expect(isValidSlug('mon-appli')).toBe(true)
    expect(isValidSlug('a1b')).toBe(true)
    expect(isValidSlug('ab')).toBe(false)
    expect(isValidSlug('-abc')).toBe(false)
    expect(isValidSlug('abc-')).toBe(false)
    expect(isValidSlug('a--b')).toBe(false)
    expect(isValidSlug('Mon-Appli')).toBe(false)
    expect(isValidSlug('a'.repeat(41))).toBe(false)
    expect(isValidSlug('../x')).toBe(false)
  })

  it('proposes a slug from a name', () => {
    expect(slugify('Le dé magique !')).toBe('le-de-magique')
    expect(slugify('  Ça marche   ')).toBe('ca-marche')
    expect(isValidSlug(slugify('Œ'))).toBe(true)
    expect(isValidSlug(slugify('x'.repeat(80)))).toBe(true)
  })
})

describe('publication settings', () => {
  it('validates the icon and colours', () => {
    const settings = appSettingsSchema.parse({
      name: 'Dé',
      themeColor: '#6d4aff',
      backgroundColor: '#ffffff',
      icon: { kind: 'emoji', emoji: '🎲', background: '#ffd84d' },
    })
    expect(settings.description).toBe('')
    expect(appSettingsSchema.safeParse({ ...settings, themeColor: 'red' }).success).toBe(false)
  })
})

describe('live messages', () => {
  it('refuses unknown or oversized phone messages', () => {
    expect(liveFromPhoneSchema.safeParse({ type: 'hello', device: 'iPhone' }).success).toBe(true)
    expect(liveFromPhoneSchema.safeParse({ type: 'load' }).success).toBe(false)
    expect(
      liveFromPhoneSchema.safeParse({
        type: 'log',
        entry: { level: 'log', message: 'x'.repeat(5000), time: 1 },
      }).success,
    ).toBe(false)
  })
})
