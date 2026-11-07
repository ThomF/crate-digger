import Fastify from 'fastify'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import { authPlugin } from './plugins/auth.ts'
import { coversPlugin } from './plugins/covers.ts'
import { dbPlugin } from './plugins/db.ts'
import { errorHandlerPlugin } from './plugins/error-handler.ts'
import { webPlugin } from './plugins/web.ts'
import { albumRoutes } from './routes/albums.ts'
import { authRoutes } from './routes/auth.ts'
import { coverRoutes } from './routes/covers.ts'
import { crateRoutes } from './routes/crates.ts'
import { healthRoutes } from './routes/health.ts'
import { profileRoutes } from './routes/profiles.ts'
import { DEFAULT_COVERS_DIR } from './paths.ts'

export type AppOptions = {
  /** SQLite file path, or ':memory:' for tests. Defaults to DATABASE_PATH or data/crate.db. */
  dbPath?: string
  /** Where cover images are stored. Defaults to COVERS_DIR or data/covers. */
  coversDir?: string
  /** Session cookies and login limits. `production` (Secure cookies) defaults from NODE_ENV;
   *  rateLimit defaults to 10 signup/login attempts per IP per 15 minutes. */
  auth?: {
    production?: boolean
    rateLimit?: { max: number; timeWindow: number }
  }
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
  await app.register(dbPlugin, { path: opts.dbPath })
  // After dbPlugin: it looks up each request's session in app.db.
  await app.register(authPlugin, {
    production: opts.auth?.production ?? process.env.NODE_ENV === 'production',
  })
  await app.register(coversPlugin, { dir: opts.coversDir ?? DEFAULT_COVERS_DIR })

  await app.register(healthRoutes, { prefix: '/api' })
  await app.register(authRoutes, { prefix: '/api', rateLimit: opts.auth?.rateLimit })
  await app.register(crateRoutes, { prefix: '/api' })
  await app.register(albumRoutes, { prefix: '/api' })
  await app.register(coverRoutes, { prefix: '/api' })
  await app.register(profileRoutes, { prefix: '/api' })

  // Last, so API and cover routes always win over the web app's catch-all.
  await app.register(webPlugin, { dir: opts.webDir ?? process.env.WEB_DIR })

  return app
}
