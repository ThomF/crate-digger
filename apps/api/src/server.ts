import { buildApp } from './app.ts'
import { bootstrapFromEnv } from './services/bootstrap.ts'

const port = Number(process.env.PORT ?? 3000)
const host = process.env.HOST ?? '127.0.0.1'

const app = await buildApp()

try {
  // First admin from ADMIN_EMAIL / ADMIN_PASSWORD, and legacy crates handed to it.
  await bootstrapFromEnv(app.db, process.env, app.log)
  await app.listen({ port, host })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
