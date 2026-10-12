import Fastify from 'fastify'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import { authPlugin, type AuthOptions } from './plugins/auth.ts'
import { coversPlugin } from './plugins/covers.ts'
import { dbPlugin } from './plugins/db.ts'
import { errorHandlerPlugin } from './plugins/error-handler.ts'
import { webPlugin } from './plugins/web.ts'
import { albumRoutes } from './routes/albums.ts'
import { coverRoutes } from './routes/covers.ts'
import { crateRoutes } from './routes/crates.ts'
import { healthRoutes } from './routes/health.ts'
import { sessionRoutes } from './routes/session.ts'
import { DEFAULT_COVERS_DIR } from './paths.ts'

export type AppOptions = {
  /** SQLite file path, or ':memory:' for tests. Defaults to DATABASE_PATH or data/crate.db. */
  dbPath?: string
  /** Where cover images are stored. Defaults to COVERS_DIR or data/covers. */
  coversDir?: string
  /** Who may edit. Defaults to ADMIN_PASSWORD / SESSION_SECRET / NODE_ENV. */
  auth?: AuthOptions
  /** The built web app to serve (production). Defaults to WEB_DIR; unset in development. */
  webDir?: string
}

// Builds the app without starting it. Tests call this and use app.inject()
// to send fake requests, so no real port is ever opened.
export async function buildApp(opts: AppOptions = {}) {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'test' ? false : { level: 'info' },
    // Behind Caddy, every request arrives from the proxy. Trusting its X-Forwarded-For
    // header gives us the visitor's real IP (the login rate limit is per IP). Only safe
    // when the API can't be reached except through the proxy, so it's opt-in.
    trustProxy: process.env.TRUST_PROXY === 'true',
  })

  // Route schemas are Zod schemas: validate requests with them, and check responses too.
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  // Plugins first (things routes depend on), then routes.
  await app.register(errorHandlerPlugin)
  await app.register(authPlugin, {
    adminPassword: process.env.ADMIN_PASSWORD,
    sessionSecret: process.env.SESSION_SECRET,
    production: process.env.NODE_ENV === 'production',
    ...opts.auth,
  })
  await app.register(dbPlugin, { path: opts.dbPath })
  await app.register(coversPlugin, { dir: opts.coversDir ?? DEFAULT_COVERS_DIR })

  await app.register(healthRoutes, { prefix: '/api' })
  await app.register(sessionRoutes, { prefix: '/api' })
  await app.register(crateRoutes, { prefix: '/api' })
  await app.register(albumRoutes, { prefix: '/api' })
  await app.register(coverRoutes, { prefix: '/api' })

  // Last, so API and cover routes always win over the web app's catch-all.
  await app.register(webPlugin, { dir: opts.webDir ?? process.env.WEB_DIR })

  return app
}
