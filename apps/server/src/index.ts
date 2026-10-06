import { serve } from '@hono/node-server'
import { createApp } from './app.ts'
import { ConfigError, loadConfig } from './config.ts'
import { openDatabase } from './db/index.ts'
import { createLogger } from './logger.ts'

const SHUTDOWN_TIMEOUT_MS = 10_000

async function main() {
  let config: ReturnType<typeof loadConfig>
  try {
    config = loadConfig()
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(error.message)
      process.exit(1)
    }
    throw error
  }

  const logger = createLogger(config.logLevel)
  if (!config.secret && config.isProduction) {
    logger.warn('RUBLOX_SECRET is not set: it will be required from J1 (32 bytes or more)')
  }

  const database = openDatabase({ databaseUrl: config.databaseUrl, dataDir: config.dataDir })
  logger.info(
    {
      database: database.kind,
      location: database.kind === 'pglite' ? (config.databaseUrl ?? config.dataDir) : undefined,
    },
    'applying database migrations',
  )
  await database.migrate(config.migrationsFolder)

  const app = createApp({ config, ping: database.ping, logger })
  const server = serve({ fetch: app.fetch, port: config.port, hostname: config.host }, (info) => {
    logger.info(
      { address: info.address, port: info.port, studio: config.studioUrl, apps: config.appsUrl },
      `Rublox listening: studio ${config.studioUrl}, apps ${config.appsUrl}`,
    )
  })

  let shuttingDown = false
  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) return
    shuttingDown = true
    logger.info({ signal }, 'shutting down')
    const timer = setTimeout(() => {
      logger.error('graceful shutdown timed out')
      process.exit(1)
    }, SHUTDOWN_TIMEOUT_MS)
    timer.unref()
    server.close(async (error) => {
      if (error) logger.error({ err: error }, 'error while closing the HTTP server')
      try {
        await database.close()
      } catch (closeError) {
        logger.error({ err: closeError }, 'error while closing the database')
      }
      logger.info('stopped')
      process.exit(error ? 1 : 0)
    })
    // Idle keep-alive connections would otherwise hold `close` open.
    if ('closeIdleConnections' in server) server.closeIdleConnections()
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
