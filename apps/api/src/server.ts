import { buildApp } from './app.ts'
import { bootstrapFromEnv } from './services/bootstrap.ts'
import { seedDemoFromEnv } from './services/demo-seed.ts'
import { ensureDevAdmin } from './services/dev-admin.ts'

const port = Number(process.env.PORT ?? 3000)
const host = process.env.HOST ?? '127.0.0.1'

const app = await buildApp()

try {
  // First admin from ADMIN_EMAIL / ADMIN_PASSWORD, and legacy crates handed to it.
  await bootstrapFromEnv(app.db, process.env, app.log)

  // Local admin@frisson.com login, never in production. It is a convenience, so a failure here
  // must not keep the real app down.
  try {
    await ensureDevAdmin(app.db, process.env, app.log)
  } catch (err) {
    app.log.error(err, 'Could not add the dev admin; starting without it')
  }

  // Fictional demo content, added once per missing row. It is optional, so a failure here
  // must not keep the real app down. The seed is one transaction, so a failure leaves no rows.
  try {
    seedDemoFromEnv(app.db, process.env, app.log)
  } catch (err) {
    app.log.error(err, 'Could not add demo content; starting without it')
  }

  await app.listen({ port, host })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
