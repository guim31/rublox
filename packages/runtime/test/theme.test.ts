import { describe, expect, it } from 'vitest'
import { contrast, parseHex, readableOn, textOn } from '../src/theme.ts'

const ratio = (a: string, b: string) => contrast(parseHex(a) ?? [0, 0, 0], parseHex(b) ?? [0, 0, 0])

describe('readable colors (WCAG 1.4.3)', () => {
  it('writes white or near black on a fill, whichever reads better', () => {
    expect(textOn('#6d4aff')).toBe('#ffffff')
    expect(textOn('#ffd84d')).toBe('#1b1a24')
    expect(textOn('#f08c00')).toBe('#1b1a24')
    for (const fill of ['#6d4aff', '#ffd84d', '#f08c00', '#12b886', '#ff6b5c']) {
      expect(ratio(textOn(fill), fill), fill).toBeGreaterThanOrEqual(4.5)
    }
    // A mid-tone where neither reaches 4.5: the better of the two.
    expect(ratio(textOn('#4c6ef5'), '#4c6ef5')).toBeCloseTo(
      Math.max(ratio('#ffffff', '#4c6ef5'), ratio('#1b1a24', '#4c6ef5')),
    )
    // A CSS variable cannot be measured: white.
    expect(textOn('var(--rx-danger)')).toBe('#ffffff')
  })

  it('keeps a readable text color, and adjusts one that is not', () => {
    expect(readableOn('#1b1a24', '#ffffff')).toBe('#1b1a24')
    for (const [color, background] of [
      ['#f59f00', '#ffffff'],
      ['#c2410c', '#121219'],
      ['#12b886', '#ffffff'],
      ['#6d4aff', '#121219'],
    ] as const) {
      const adjusted = readableOn(color, background)
      expect(ratio(adjusted, background), `${color} on ${background}`).toBeGreaterThanOrEqual(4.5)
    }
  })
})
