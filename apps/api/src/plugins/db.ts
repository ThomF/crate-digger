import fp from 'fastify-plugin'
import { createDb, type Db } from '../db/client.js'

// Tell TypeScript that every Fastify instance now has `app.db`.
declare module 'fastify' {
  interface FastifyInstance {
    db: Db
  }
}

export type DbPluginOptions = { path?: string }

// fastify-plugin makes `app.db` visible to the whole app, not just this plugin's scope.
export const dbPlugin = fp<DbPluginOptions>(async (app, opts) => {
  const { db, close } = createDb(opts.path)

  app.decorate('db', db)
  app.addHook('onClose', async () => close())
})
