import type { MiddlewareHandler } from 'hono'

/** Features the preview iframe may use (SPEC § 6.6), delegated with its `allow` attribute. */
const APP_FEATURES = [
  'camera',
  'microphone',
  'geolocation',
  'accelerometer',
  'gyroscope',
  'clipboard-write',
  'web-share',
  'fullscreen',
  'autoplay',
] as const

export function studioCsp(appsUrl: string): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    `frame-src ${appsUrl}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
}

export function appsCsp(studioUrl: string): string {
  return [
    "default-src 'self'",
    "script-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    `frame-ancestors 'self' ${studioUrl}`,
  ].join('; ')
}

/** `Permissions-Policy` (structured header syntax): `camera=(self "https://studio"), …`. */
export function appsPermissionsPolicy(studioUrl: string): string {
  return APP_FEATURES.map((feature) => `${feature}=(self "${studioUrl}")`).join(', ')
}

function commonHeaders(headers: Headers): void {
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
}

export function studioSecurityHeaders(appsUrl: string): MiddlewareHandler {
  const csp = studioCsp(appsUrl)
  return async (c, next) => {
    await next()
    commonHeaders(c.res.headers)
    c.res.headers.set('Content-Security-Policy', csp)
  }
}

export function appsSecurityHeaders(studioUrl: string): MiddlewareHandler {
  const csp = appsCsp(studioUrl)
  const permissions = appsPermissionsPolicy(studioUrl)
  return async (c, next) => {
    await next()
    commonHeaders(c.res.headers)
    c.res.headers.set('Content-Security-Policy', csp)
    c.res.headers.set('Permissions-Policy', permissions)
  }
}
