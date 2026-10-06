import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config.ts'
import { type DatabaseHandle, openDatabase, schema } from '../src/db/index.ts'
import { createDistFixture, get, testApp } from './helpers.ts'

const dist = createDistFixture()
let database: DatabaseHandle

beforeAll(async () => {
  const config = loadConfig({ NODE_ENV: 'test', DATABASE_URL: 'memory://' })
  database = openDatabase(config)
  await database.migrate(config.migrationsFolder)
})

afterAll(async () => {
  await database.close()
  dist.cleanup()
})

describe('/healthz', () => {
  it('answers ok on any host once the database responds', async () => {
    const app = testApp(dist, { ping: database.ping })
    for (const host of ['studio.example.com', 'apps.example.com', 'localhost:3000']) {
      const res = await get(app, host, '/healthz')
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ status: 'ok' })
    }
  })

  it('answers 503 when the database fails', async () => {
    const app = testApp(dist, {
      ping: async () => {
        throw new Error('connection refused')
      },
    })
    const res = await get(app, 'studio.example.com', '/healthz')
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ status: 'error' })
  })
})

describe('migrations', () => {
  it('create instance_settings', async () => {
    await database.db.insert(schema.instanceSettings).values({ key: 'theme', value: { a: 1 } })
    const rows = await database.db.select().from(schema.instanceSettings)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.value).toEqual({ a: 1 })
    expect(typeof rows[0]!.updatedAt).toBe('object')
  })

  it('are idempotent', async () => {
    await expect(database.migrate(loadConfig({ NODE_ENV: 'test' }).migrationsFolder)).resolves.toBe(
      undefined,
    )
  })
})
