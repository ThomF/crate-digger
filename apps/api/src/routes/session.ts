import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import rateLimit from '@fastify/rate-limit'
import { loginInput, sessionInfo } from '@crate-digger/shared'
import { HttpError } from '../errors.ts'

export const sessionRoutes: FastifyPluginAsyncZod = async (app) => {
  // Registered inside this plugin, so the limit applies only to these routes.
  await app.register(rateLimit, { global: false })

  app.get('/session', { schema: { response: { 200: sessionInfo } } }, async (req) =>
    app.auth.access(req),
  )

  app.post(
    '/session',
    {
      schema: { body: loginInput, response: { 200: sessionInfo } },
      // At most 10 guesses per 15 minutes from one address: slows password guessing to a crawl.
      config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
    },
    async (req, reply) => {
      if (!app.auth.access(req).canLogIn) throw new HttpError(400, 'Logging in is not enabled')
      if (!app.auth.checkPassword(req.body.password)) {
        throw new HttpError(401, "That password isn't right")
      }
      app.auth.logIn(reply)
      return { canEdit: true, canLogIn: true }
    },
  )

  app.delete('/session', { schema: { response: { 200: sessionInfo } } }, async (req, reply) => {
    app.auth.logOut(reply)
    // This request still carries the old cookie, so work out the logged-out answer directly:
    // with a password, logged out means no editing; in open mode nothing changes.
    const { canEdit, canLogIn } = app.auth.access(req)
    return { canEdit: canLogIn ? false : canEdit, canLogIn }
  })
}
