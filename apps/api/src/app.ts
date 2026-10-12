import Fastify from 'fastify'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import { dbPlugin } from './plugins/db.ts'
import { errorHandlerPlugin } from './plugins/error-handler.ts'
import { albumRoutes } from './routes/albums.ts'
import { crateRoutes } from './routes/crates.ts'
import { healthRoutes } from './routes/health.ts'

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

  // Route schemas are Zod schemas: validate requests with them, and check responses too.
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  // Plugins first (things routes depend on), then routes.
  await app.register(errorHandlerPlugin)
  await app.register(dbPlugin, { path: opts.dbPath })

  await app.register(healthRoutes, { prefix: '/api' })
  await app.register(crateRoutes, { prefix: '/api' })
  await app.register(albumRoutes, { prefix: '/api' })

  return app
}
