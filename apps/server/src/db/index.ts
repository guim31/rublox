import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite'
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator'
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js'
import { migrate as migratePostgres } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { MEMORY_DATABASE_URL } from '../config.ts'
import * as schema from './schema.ts'

export { schema }

/** Driver-independent Drizzle database: PGlite and postgres.js share the same pg-core API. */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>

export interface DatabaseHandle {
  db: Database
  kind: 'pglite' | 'postgres'
  /** Applies pending Drizzle migrations from `migrationsFolder`. */
  migrate(migrationsFolder: string): Promise<void>
  /** Runs `select 1`; throws if the database is unreachable. */
  ping(): Promise<void>
  close(): Promise<void>
}

export interface DatabaseOptions {
  /** PostgreSQL URL, `memory://` (in-memory PGlite), or undefined (PGlite in `dataDir`). */
  databaseUrl: string | undefined
  dataDir: string
}

/**
 * Opens the database. Without `DATABASE_URL`, PGlite (PostgreSQL compiled to WebAssembly) runs
 * in-process, so development and tests need neither Docker nor an external server.
 */
export function openDatabase({ databaseUrl, dataDir }: DatabaseOptions): DatabaseHandle {
  if (databaseUrl && databaseUrl !== MEMORY_DATABASE_URL) {
    const client = postgres(databaseUrl, { max: 10, onnotice: () => {} })
    const db = drizzlePostgres({ client, schema })
    return {
      db,
      kind: 'postgres',
      migrate: (migrationsFolder) => migratePostgres(db, { migrationsFolder }),
      ping: async () => {
        await db.execute(sql`select 1`)
      },
      close: () => client.end({ timeout: 5 }),
    }
  }

  let client: PGlite
  if (databaseUrl === MEMORY_DATABASE_URL) {
    client = new PGlite()
  } else {
    const dir = join(dataDir, 'pglite')
    mkdirSync(dir, { recursive: true })
    client = new PGlite(dir)
  }
  const db = drizzlePglite({ client, schema })
  return {
    db,
    kind: 'pglite',
    migrate: (migrationsFolder) => migratePglite(db, { migrationsFolder }),
    ping: async () => {
      await db.execute(sql`select 1`)
    },
    close: () => client.close(),
  }
}
