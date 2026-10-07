import { describe, expect, it } from 'vitest'
import { rateKey } from '../src/ai/app-relay.ts'
import { FailureGuard } from '../src/guard.ts'
import { isUuid, uuidv7 } from '../src/ids.ts'
import { sniff } from '../src/sniff.ts'

const bytes = (...values: (number | string)[]) =>
  new Uint8Array(
    values.flatMap((value) =>
      typeof value === 'string' ? [...value].map((char) => char.charCodeAt(0)) : [value],
    ),
  )
const text = (value: string) => new TextEncoder().encode(value)

describe('sniff', () => {
  it.each([
    [bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a, 0, 0), 'image/png'],
    [bytes(0xff, 0xd8, 0xff, 0xe0), 'image/jpeg'],
    [bytes('GIF89a', 0, 0), 'image/gif'],
    [bytes('RIFF', 0, 0, 0, 0, 'WEBPVP8 '), 'image/webp'],
    [bytes('RIFF', 0, 0, 0, 0, 'WAVEfmt '), 'audio/wav'],
    [bytes(0, 0, 0, 0x20, 'ftypavif'), 'image/avif'],
    [bytes(0, 0, 0, 0x20, 'ftypisom'), 'video/mp4'],
    [bytes('OggS', 0), 'audio/ogg'],
    [bytes('ID3', 4, 0), 'audio/mpeg'],
    [bytes('wOF2', 0), 'font/woff2'],
    [
      text('<?xml version="1.0"?>\n<!-- logo --><svg xmlns="http://www.w3.org/2000/svg"/>'),
      'image/svg+xml',
    ],
    [text('{"v":"5.7.4","layers":[]}'), 'application/json'],
  ])('recognises %#', (content, mime) => {
    expect(sniff(content)?.mime).toBe(mime)
  })

  it.each([
    text('<html><script>alert(1)</script></html>'),
    text('#!/bin/sh\nrm -rf /'),
    text('{"not":"lottie"}'),
    bytes(0x4d, 0x5a, 0x90, 0),
    new Uint8Array(0),
  ])('refuses anything else (%#)', (content) => {
    expect(sniff(content)).toBeNull()
  })
})

describe('FailureGuard', () => {
  it('blocks after 5 failures in 15 minutes, until the oldest one expires', () => {
    let now = 0
    const guard = new FailureGuard(5, 15 * 60_000, () => now)
    for (let i = 0; i < 5; i++) {
      expect(guard.retryAfter('ip')).toBe(0)
      guard.fail('ip')
      now += 60_000
    }
    expect(guard.retryAfter('ip')).toBe(10 * 60)
    expect(guard.retryAfter('other')).toBe(0)
    now = 15 * 60_000 + 1
    expect(guard.retryAfter('ip')).toBe(0)
  })
})

describe('uuidv7', () => {
  it('is a version 7 UUID that sorts by time', () => {
    const a = uuidv7(1_000)
    const b = uuidv7(2_000)
    expect(isUuid(a)).toBe(true)
    expect(a[14]).toBe('7')
    expect(a < b).toBe(true)
  })
})

describe('rateKey (SPEC § 0.10)', () => {
  it('counts an IPv4 address alone, and an IPv6 one by its /64', () => {
    expect(rateKey('198.51.100.7')).toBe('198.51.100.7')
    expect(rateKey('2001:db8:1:2:aaaa::1')).toBe('2001:db8:1:2::/64')
    expect(rateKey('2001:0db8:0001:0002:ffff:ffff:ffff:ffff')).toBe('2001:db8:1:2::/64')
    expect(rateKey('2001:db8::1')).toBe('2001:db8:0:0::/64')
    expect(rateKey('::1')).toBe('0:0:0:0::/64')
  })
})
