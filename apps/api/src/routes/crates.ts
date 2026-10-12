import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import {
  crate,
  crateOrderInput,
  createCrateInput,
  idParams,
  updateCrateInput,
} from '@crate-digger/shared'
import {
  createCrate,
  deleteCrate,
  getCrate,
  listCrates,
  reorderCrates,
  updateCrate,
} from '../services/crates.ts'

export const crateRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/crates', { schema: { response: { 200: crate.array() } } }, async () =>
    listCrates(app.db),
  )

  app.get('/crates/:id', { schema: { params: idParams, response: { 200: crate } } }, async (req) =>
    getCrate(app.db, req.params.id),
  )

  app.post(
    '/crates',
    { schema: { body: createCrateInput, response: { 201: crate } } },
    async (req, reply) => reply.code(201).send(createCrate(app.db, req.body)),
  )

  app.patch(
    '/crates/:id',
    { schema: { params: idParams, body: updateCrateInput, response: { 200: crate } } },
    async (req) => updateCrate(app.db, req.params.id, req.body),
  )

  // 409 Conflict if the crate still holds records.
  app.delete('/crates/:id', { schema: { params: idParams } }, async (req, reply) => {
    deleteCrate(app.db, req.params.id)
    return reply.code(204).send()
  })

  app.put(
    '/crates/order',
    { schema: { body: crateOrderInput, response: { 200: crate.array() } } },
    async (req) => reorderCrates(app.db, req.body.ids),
  )
}
