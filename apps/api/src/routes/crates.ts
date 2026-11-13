import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import {
  crate,
  crateDetail,
  recommendedCrateCard,
  crateOrderInput,
  createCrateInput,
  idParams,
  updateCrateInput,
} from '@frisson/shared'
import {
  createCrate,
  deleteCrate,
  getCrateDetail,
  listCrates,
  listRecommendedCrates,
  reorderCrates,
  updateCrate,
} from '../services/crates.ts'

// Reads are public. Writes pass request.user to the service, which answers 401/403/404.
export const crateRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/crates', { schema: { response: { 200: crate.array() } } }, async () =>
    listCrates(app.db),
  )

  // Declared ahead of /crates/:id, so 'recommended' is never read as an id.
  app.get(
    '/crates/recommended',
    { schema: { response: { 200: recommendedCrateCard.array() } } },
    async () => listRecommendedCrates(app.db),
  )

  // viewerFavorited depends on who is asking; signed out it is always false.
  app.get(
    '/crates/:id',
    { schema: { params: idParams, response: { 200: crateDetail } } },
    async (req) => getCrateDetail(app.db, req.params.id, req.user),
  )

  app.post(
    '/crates',
    { schema: { body: createCrateInput, response: { 201: crate } } },
    async (req, reply) => reply.code(201).send(createCrate(app.db, req.user, req.body)),
  )

  app.patch(
    '/crates/:id',
    { schema: { params: idParams, body: updateCrateInput, response: { 200: crate } } },
    async (req) => updateCrate(app.db, req.user, req.params.id, req.body),
  )

  // 409 Conflict if the crate still holds records.
  app.delete('/crates/:id', { schema: { params: idParams } }, async (req, reply) => {
    deleteCrate(app.db, req.user, req.params.id)
    return reply.code(204).send()
  })

  app.put(
    '/crates/order',
    { schema: { body: crateOrderInput, response: { 200: crate.array() } } },
    async (req) => reorderCrates(app.db, req.user, req.body.ids),
  )
}
