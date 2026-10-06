import { serve } from '@hono/node-server'
import { bootstrapAdmin } from './accounts.ts'
import { createApp } from './app.ts'
import { ConfigError, loadConfig } from './config.ts'
import { openDatabase } from './db/index.ts'
import { createLogger } from './logger.ts'
import { purgeTrash } from './routes/projects.ts'
import { createServices } from './services.ts'

const SHUTDOWN_TIMEOUT_MS = 10_000
const PURGE_INTERVAL_MS = 6 * 3600 * 1000

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

  const database = openDatabase({ databaseUrl: config.databaseUrl, dataDir: config.dataDir })
  logger.info(
    {
      database: database.kind,
      location: database.kind === 'pglite' ? (config.databaseUrl ?? config.dataDir) : undefined,
    },
    'applying database migrations',
  )
  await database.migrate(config.migrationsFolder)

  const services = createServices(database.db, config, logger)
  await bootstrapAdmin(services, config.admin)
  const purge = async () => {
    try {
      const purged = await purgeTrash(services)
      if (purged.projects || purged.files) logger.info(purged, 'emptied the trash')
    } catch (error) {
      logger.error({ err: error }, 'could not empty the trash')
    }
  }
  void purge()
  const purgeTimer = setInterval(purge, PURGE_INTERVAL_MS)
  purgeTimer.unref()

  const app = createApp({ config, services, ping: database.ping, logger })
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
    clearInterval(purgeTimer)
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
