import Fastify from 'fastify'
import { sql } from 'drizzle-orm'
import { dbPlugin } from './plugins/db.js'

export type AppOptions = {
  /** SQLite file path, or ':memory:' for tests. Defaults to DATABASE_PATH / data/crate.db. */
  dbPath?: string
}

// Builds the app without starting it. Tests call this and use app.inject()
// to send fake requests, so no real port is ever opened.
export async function buildApp(opts: AppOptions = {}) {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'test' ? false : { level: 'info' },
  })

  await app.register(dbPlugin, { path: opts.dbPath })

  app.get('/api/health', async () => {
    app.db.get(sql`SELECT 1`) // throws (→ 500) if the database is unreachable
    return { status: 'ok', service: 'crate-digger-api', db: 'ok' }
  })

  return app
}
