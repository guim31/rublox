import { sep } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { injectRuntimeConfig, safeRelativePath } from '../src/static.ts'
import { createDistFixture, get, indexHtml, testApp } from './helpers.ts'

const dist = createDistFixture()
const app = testApp(dist)
const studioHost = 'studio.example.com'
const appsHost = 'apps.example.com'

afterAll(() => dist.cleanup())

function readConfig(html: string): unknown {
  const match = /<script id="rublox-config" type="application\/json">(.*?)<\/script>/.exec(html)
  return JSON.parse(match![1]!)
}

describe('host routing', () => {
  it('serves the studio index on the studio host', async () => {
    const res = await get(app, studioHost, '/')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(res.headers.get('cache-control')).toBe('no-cache')
    expect(await res.text()).toContain('<body>studio</body>')
  })

  it('serves the player index on the apps host', async () => {
    const res = await get(app, appsHost, '/')
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('<body>player</body>')
  })

  it('treats any unknown host as the studio origin', async () => {
    const res = await get(app, 'other.example.com', '/')
    expect(await res.text()).toContain('<body>studio</body>')
  })

  it('matches the apps host case-insensitively and ignores the default port', async () => {
    const res = await get(app, 'APPS.example.com:80', '/')
    expect(await res.text()).toContain('<body>player</body>')
  })

  it('injects the runtime config into index.html', async () => {
    const html = await (await get(app, appsHost, '/')).text()
    expect(readConfig(html)).toEqual({
      studioUrl: 'http://studio.example.com',
      appsUrl: 'http://apps.example.com',
    })
  })

  it('falls back to index.html for client-side routes', async () => {
    const studio = await get(app, studioHost, '/projects/abc/edit')
    expect(studio.status).toBe(200)
    expect(await studio.text()).toContain('<body>studio</body>')
    const player = await get(app, appsHost, '/preview')
    expect(await player.text()).toContain('<body>player</body>')
  })

  it('does not fall back for missing files', async () => {
    expect((await get(app, studioHost, '/_app/missing-000.js')).status).toBe(404)
    expect((await get(app, studioHost, '/missing.png')).status).toBe(404)
  })

  it('serves hashed files with an immutable cache policy', async () => {
    const res = await get(app, studioHost, '/_app/index-abc123.js')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/javascript; charset=utf-8')
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(await res.text()).toBe('console.log("studio")')
  })

  it('sends the right content types', async () => {
    const wasm = await get(app, appsHost, '/_app/engine.wasm')
    expect(wasm.headers.get('content-type')).toBe('application/wasm')
    const svg = await get(app, studioHost, '/favicon.svg')
    expect(svg.headers.get('content-type')).toBe('image/svg+xml')
    expect(svg.headers.get('cache-control')).toBe('no-cache')
    const manifest = await get(app, studioHost, '/manifest.webmanifest')
    expect(manifest.headers.get('content-type')).toBe('application/manifest+json; charset=utf-8')
  })

  it('keeps the two origins apart', async () => {
    expect((await get(app, appsHost, '/_app/index-abc123.js')).status).toBe(404)
    expect((await get(app, studioHost, '/_app/player-def456.js')).status).toBe(404)
    const api = await get(app, appsHost, '/api/config')
    expect(api.headers.get('content-type')).not.toContain('application/json')
  })

  it.each(['/a/my-app/', '/live/token', '/assets/abc', '/_rx/proxy'])(
    'reserves %s on the apps origin',
    async (path) => {
      const res = await get(app, appsHost, path)
      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: 'not_found' })
    },
  )

  it.each([
    '/../secret.txt',
    '/%2e%2e/secret.txt',
    '/_app/%2e%2e/%2e%2e/secret.txt',
    '/_app/..%2f..%2fsecret.txt',
    '/..%5csecret.txt',
    '/.env',
  ])('refuses path traversal: %s', async (path) => {
    const res = await get(app, studioHost, path)
    expect(await res.text()).not.toContain('outside the dist folder')
    expect([200, 404]).toContain(res.status)
  })

  it('answers HEAD requests without a body', async () => {
    const res = await app.request(`http://${studioHost}/`, {
      method: 'HEAD',
      headers: { host: studioHost },
    })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('')
  })

  it('rejects other methods on static routes', async () => {
    const res = await app.request(`http://${studioHost}/`, {
      method: 'POST',
      headers: { host: studioHost },
    })
    expect(res.status).toBe(404)
  })
})

describe('missing dist folders', () => {
  const missing = testApp({ studioDist: '/nonexistent/studio', playerDist: '/nonexistent/player' })

  it('explains how to get the UI', async () => {
    const studio = await get(missing, studioHost, '/')
    expect(studio.status).toBe(503)
    expect(await studio.text()).toContain('pnpm dev')
    const player = await get(missing, appsHost, '/some/route')
    expect(await player.text()).toContain('pnpm build')
  })

  it('still serves the API', async () => {
    expect((await get(missing, studioHost, '/api/config')).status).toBe(200)
  })
})

describe('runtime config injection', () => {
  it('escapes < so the JSON cannot close the script element', () => {
    const html = injectRuntimeConfig(indexHtml('x'), {
      studioUrl: 'http://studio.example.com/</script><script>alert(1)</script>',
      appsUrl: 'http://apps.example.com',
    })!
    expect(html).not.toContain('</script><script>alert(1)')
    expect(html).toContain('\\u003c/script>')
    expect(readConfig(html)).toEqual({
      studioUrl: 'http://studio.example.com/</script><script>alert(1)</script>',
      appsUrl: 'http://apps.example.com',
    })
  })

  it('returns null without a config tag', () => {
    expect(injectRuntimeConfig('<html></html>', { studioUrl: 'a', appsUrl: 'b' })).toBeNull()
  })
})

describe('safeRelativePath', () => {
  it('normalises ordinary paths', () => {
    expect(safeRelativePath('/')).toBe('')
    expect(safeRelativePath('/_app/a%20b.js')).toBe(['_app', 'a b.js'].join(sep))
  })

  it.each(['/../x', '/a/%2e%2e/x', '/a%00b', '/a%5cb', '/%E0%A4%A', '/.git/config'])(
    'refuses %s',
    (path) => {
      expect(safeRelativePath(path)).toBeNull()
    },
  )
})
