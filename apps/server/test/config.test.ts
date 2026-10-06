import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ConfigError, DEVELOPMENT_SECRET, loadConfig } from '../src/config.ts'
import { defaultPlayerDist, defaultStudioDist, serverRoot } from '../src/paths.ts'

describe('loadConfig', () => {
  it('uses the development origins by default', () => {
    const config = loadConfig({})
    expect(config.nodeEnv).toBe('development')
    expect(config.studioUrl).toBe('http://localhost:5173')
    expect(config.appsUrl).toBe('http://127.0.0.1:5174')
    expect(config.appsHost).toBe('127.0.0.1:5174')
    expect(config.port).toBe(3000)
    expect(config.host).toBe('0.0.0.0')
    expect(config.databaseUrl).toBeUndefined()
    expect(config.dataDir).toBe(resolve('data'))
    expect(config.trustProxy).toBe(false)
    expect(config.maxUploadBytes).toBe(20 * 1024 * 1024)
  })

  it('uses single-port origins outside development', () => {
    const config = loadConfig({ NODE_ENV: 'production', RUBLOX_SECRET: 's'.repeat(32) })
    expect(config.studioUrl).toBe('http://localhost:3000')
    expect(config.appsUrl).toBe('http://127.0.0.1:3000')
    expect(config.isProduction).toBe(true)
  })

  it('normalises URLs to origins', () => {
    const config = loadConfig({
      STUDIO_URL: 'https://Studio.example.com/',
      APPS_URL: 'https://apps.example.com:443/path',
    })
    expect(config.studioUrl).toBe('https://studio.example.com')
    expect(config.appsUrl).toBe('https://apps.example.com')
    expect(config.appsHost).toBe('apps.example.com')
  })

  it('parses booleans and numbers', () => {
    const config = loadConfig({ TRUST_PROXY: 'true', PORT: '8080', MAX_UPLOAD_MB: '5' })
    expect(config.trustProxy).toBe(true)
    expect(config.port).toBe(8080)
    expect(config.maxUploadBytes).toBe(5 * 1024 * 1024)
  })

  it('resolves the built front-ends next to the server package', () => {
    const config = loadConfig({})
    expect(config.studioDist).toBe(defaultStudioDist)
    expect(config.playerDist).toBe(defaultPlayerDist)
    expect(defaultStudioDist).toBe(resolve(serverRoot, '../studio/dist'))
    expect(config.migrationsFolder).toBe(resolve(serverRoot, 'drizzle'))
  })

  it('treats empty variables as unset', () => {
    const config = loadConfig({ DATABASE_URL: '', RUBLOX_SECRET: '' })
    expect(config.databaseUrl).toBeUndefined()
    expect(config.secret).toBe(DEVELOPMENT_SECRET)
  })

  it('requires a secret in production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/RUBLOX_SECRET/)
  })

  it('reads the first administrator, both variables or neither', () => {
    expect(loadConfig({}).admin).toBeUndefined()
    expect(
      loadConfig({ RUBLOX_ADMIN_USERNAME: 'admin', RUBLOX_ADMIN_PASSWORD: 'secret password' })
        .admin,
    ).toEqual({ username: 'admin', password: 'secret password' })
    expect(() => loadConfig({ RUBLOX_ADMIN_USERNAME: 'admin' })).toThrow(ConfigError)
  })

  it.each([
    { RUBLOX_SECRET: 'too-short' },
    { DATABASE_URL: 'mysql://localhost/db' },
    { STUDIO_URL: 'ftp://example.com' },
    { STUDIO_URL: 'http://example.com', APPS_URL: 'http://example.com/' },
    { TRUST_PROXY: 'maybe' },
    { PORT: 'abc' },
  ])('rejects invalid values: %o', (env) => {
    expect(() => loadConfig(env)).toThrow(ConfigError)
  })

  it('accepts a long enough secret and the memory database', () => {
    const config = loadConfig({ RUBLOX_SECRET: 'x'.repeat(32), DATABASE_URL: 'memory://' })
    expect(config.secret).toHaveLength(32)
    expect(config.databaseUrl).toBe('memory://')
  })
})
