import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { crate } from '@crate-digger/shared'
import { listCrates } from '../services/crates.ts'

export const crateRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/crates', { schema: { response: { 200: crate.array() } } }, async () =>
    listCrates(app.db),
  )
}
