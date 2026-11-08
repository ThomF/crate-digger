import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import {
  publicProfile,
  setVerifiedInput,
  updateProfileInput,
  usernameParams,
} from '@frisson/shared'
import { requireAdmin, requireUser } from '../services/permissions.ts'
import { getPublicProfile, setVerified, updateOwnProfile } from '../services/profiles.ts'

// Data classification: PUBLIC responses only (publicProfile: no id, email or role).
// Profile edits only ever target request.user: there is deliberately no :username edit route.
export const profileRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/users/:username',
    { schema: { params: usernameParams, response: { 200: publicProfile } } },
    async (req) => getPublicProfile(app.db, req.params.username, req.user),
  )

  app.patch(
    '/me/profile',
    {
      schema: { body: updateProfileInput, response: { 200: publicProfile } },
      // Before body validation, so a signed-out caller gets 401 rather than 400.
      preValidation: async (req) => {
        requireUser(req.user)
      },
    },
    async (req) => updateOwnProfile(app.db, req.user, req.body),
  )

  app.patch(
    '/users/:username/verified',
    {
      schema: {
        params: usernameParams,
        body: setVerifiedInput,
        response: { 200: publicProfile },
      },
      // 401 / 403 before validation; the service checks again.
      preValidation: async (req) => {
        requireAdmin(req.user)
      },
    },
    async (req) => setVerified(app.db, req.user, req.params.username, req.body.verified),
  )
}
