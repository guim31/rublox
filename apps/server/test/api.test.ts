import { afterAll, describe, expect, it } from 'vitest'
import { version } from '../src/api.ts'
import { createDistFixture, get, testApp } from './helpers.ts'

const dist = createDistFixture()
const app = testApp(dist)

afterAll(() => dist.cleanup())

describe('/api', () => {
  it('GET /api/config returns the origins and version', async () => {
    const res = await get(app, 'studio.example.com', '/api/config')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      studioUrl: 'http://studio.example.com',
      appsUrl: 'http://apps.example.com',
      version,
    })
  })

  it('answers unknown API routes with JSON 404 instead of the SPA', async () => {
    for (const path of ['/api', '/api/', '/api/unknown', '/api/a/b']) {
      const res = await get(app, 'studio.example.com', path)
      expect(res.status, path).toBe(404)
      expect(await res.json()).toEqual({ error: 'not_found' })
    }
  })
})
