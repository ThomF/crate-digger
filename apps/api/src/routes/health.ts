import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { sql } from 'drizzle-orm'

export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/health', async () => {
    app.db.get(sql`SELECT 1`) // throws (→ 500) if the database is unreachable
    return { status: 'ok', service: 'crate-digger-api', db: 'ok' }
  })
}
