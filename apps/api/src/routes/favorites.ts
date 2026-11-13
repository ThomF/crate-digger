import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import type { FastifyRequest } from 'fastify'
import { idParams } from '@frisson/shared'
import { favoriteCrate, unfavoriteCrate } from '../services/favorites.ts'
import { requireUser } from '../services/permissions.ts'

// Before param validation, so a signed-out caller always gets 401 rather than 400.
const signedInOnly = async (req: FastifyRequest) => {
  requireUser(req.user)
}

// Data classification: INTERNAL writes, no response body. Favorites only ever act for
// request.user; a user's favorites are read through their public profile.
export const favoriteRoutes: FastifyPluginAsyncZod = async (app) => {
  app.put(
    '/crates/:id/favorite',
    { schema: { params: idParams }, preValidation: signedInOnly },
    async (req, reply) => {
      favoriteCrate(app.db, req.user, req.params.id)
      return reply.code(204).send()
    },
  )

  app.delete(
    '/crates/:id/favorite',
    { schema: { params: idParams }, preValidation: signedInOnly },
    async (req, reply) => {
      unfavoriteCrate(app.db, req.user, req.params.id)
      return reply.code(204).send()
    },
  )
}
