import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import type { FastifyRequest } from 'fastify'
import { collectorSummary, crateCard, usernameParams } from '@frisson/shared'
import {
  followUser,
  getFeed,
  listFollowing,
  listSuggestedCollectors,
  unfollowUser,
} from '../services/follows.ts'
import { requireUser } from '../services/permissions.ts'

// Before param validation, so a signed-out caller always gets 401 rather than 400.
const signedInOnly = async (req: FastifyRequest) => {
  requireUser(req.user)
}

// Data classification: PUBLIC responses only (collectorSummary and crateCard: no email, role,
// numeric user id or demo key). Follows only ever act for request.user, and the lists are
// always the viewer's own: no route exposes another user's followers or following.
export const followRoutes: FastifyPluginAsyncZod = async (app) => {
  app.put(
    '/users/:username/follow',
    { schema: { params: usernameParams }, preValidation: signedInOnly },
    async (req, reply) => {
      followUser(app.db, req.user, req.params.username)
      return reply.code(204).send()
    },
  )

  app.delete(
    '/users/:username/follow',
    { schema: { params: usernameParams }, preValidation: signedInOnly },
    async (req, reply) => {
      unfollowUser(app.db, req.user, req.params.username)
      return reply.code(204).send()
    },
  )

  app.get(
    '/me/following',
    { schema: { response: { 200: collectorSummary.array() } }, preValidation: signedInOnly },
    async (req) => listFollowing(app.db, req.user),
  )

  app.get(
    '/me/feed',
    { schema: { response: { 200: crateCard.array() } }, preValidation: signedInOnly },
    async (req) => getFeed(app.db, req.user),
  )

  app.get(
    '/me/suggested-collectors',
    { schema: { response: { 200: collectorSummary.array() } }, preValidation: signedInOnly },
    async (req) => listSuggestedCollectors(app.db, req.user),
  )
}
