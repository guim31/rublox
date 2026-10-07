import { afterAll, describe, expect, it } from 'vitest'
import { resolveClientIp } from '../src/client-ip.ts'
import { createDistFixture, get, testApp } from './helpers.ts'

const dist = createDistFixture()
const app = testApp(dist)

afterAll(() => dist.cleanup())

describe('security headers', () => {
  it('sends a strict CSP on the studio origin', async () => {
    const res = await get(app, 'studio.example.com', '/')
    const csp = res.headers.get('content-security-policy')!
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self';")
    expect(csp).toContain('frame-src http://apps.example.com;')
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    // An app that opens the studio gets no handle on it, nor on its preview (SPEC § 0.10).
    expect(res.headers.get('cross-origin-opener-policy')).toBe('same-origin')
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
    expect(res.headers.get('permissions-policy')).toBeNull()
  })

  it('lets only the studio frame the apps origin', async () => {
    const res = await get(app, 'apps.example.com', '/')
    const csp = res.headers.get('content-security-policy')!
    expect(csp).toContain("script-src 'self' blob:;")
    expect(csp).toContain("frame-ancestors 'self' http://studio.example.com")
    expect(csp).not.toContain('frame-src')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
  })

  it('delegates device features to the studio on the apps origin', async () => {
    const res = await get(app, 'apps.example.com', '/')
    const policy = res.headers.get('permissions-policy')!
    for (const feature of [
      'camera',
      'microphone',
      'geolocation',
      'accelerometer',
      'gyroscope',
      'clipboard-write',
      'fullscreen',
      'autoplay',
    ]) {
      expect(policy).toContain(`${feature}=(self "http://studio.example.com")`)
    }
    // Unknown to Chrome as a policy feature (« Unrecognized feature »): the iframe's `allow`
    // attribute delegates it.
    expect(policy).not.toContain('web-share')
  })

  it('also protects error responses', async () => {
    const studio = await get(app, 'studio.example.com', '/api/nope')
    expect(studio.headers.get('content-security-policy')).toContain("frame-ancestors 'none'")
    const apps = await get(app, 'apps.example.com', '/_rx/proxy')
    expect(apps.headers.get('content-security-policy')).toContain('frame-ancestors')
  })
})

describe('resolveClientIp', () => {
  it('uses the socket address by default', () => {
    expect(
      resolveClientIp({ realIp: '203.0.113.7', socketAddress: '192.0.2.1', trustProxy: false }),
    ).toBe('192.0.2.1')
  })

  it('uses X-Real-IP behind a trusted proxy', () => {
    expect(
      resolveClientIp({ realIp: ' 203.0.113.7 ', socketAddress: '192.0.2.1', trustProxy: true }),
    ).toBe('203.0.113.7')
  })

  it('falls back to the socket address when X-Real-IP is missing', () => {
    expect(
      resolveClientIp({ realIp: undefined, socketAddress: '192.0.2.1', trustProxy: true }),
    ).toBe('192.0.2.1')
    expect(resolveClientIp({ realIp: '', socketAddress: '192.0.2.1', trustProxy: true })).toBe(
      '192.0.2.1',
    )
  })
})
