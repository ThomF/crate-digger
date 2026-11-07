import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import rateLimit from '@fastify/rate-limit'
import { credentialsInput, publicUser, signupInput } from '@frisson/shared'
import { HttpError } from '../errors.ts'
import { verifyAgainstDummy, verifyPassword } from '../services/passwords.ts'
import { createSession, deleteSession } from '../services/sessions.ts'
import { createUser, findUserByEmail, toPublicUser } from '../services/users.ts'
import { SESSION_COOKIE } from '../plugins/auth.ts'

// Data classification: CONFIDENTIAL (PII + credentials). Emails and passwords arrive
// here; responses only ever carry publicUser (no password hash).

export type AuthRoutesOptions = {
  /** Signup/login attempts allowed per IP per window. Default: 10 per 15 minutes. */
  rateLimit?: { max: number; timeWindow: number }
}

const DEFAULT_RATE_LIMIT = { max: 10, timeWindow: 15 * 60 * 1000 }

// One message for both "no such email" and "wrong password", so the response never
// tells a stranger which emails have accounts.
const BAD_CREDENTIALS = 'Email or password is incorrect'

export const authRoutes: FastifyPluginAsyncZod<AuthRoutesOptions> = async (app, opts) => {
  // Registered inside this plugin with global: false, so only routes that ask for a limit
  // (signup and login) get one. Counted per IP, in memory.
  await app.register(rateLimit, {
    global: false,
    keyGenerator: (req) => req.ip,
    // Thrown, so the error handler sends it in the usual ApiError shape.
    errorResponseBuilder: () => new HttpError(429, 'Too many attempts. Try again later.'),
  })
  const limit = { rateLimit: { ...DEFAULT_RATE_LIMIT, ...opts.rateLimit } }

  app.post(
    '/auth/signup',
    { schema: { body: signupInput, response: { 201: publicUser } }, config: limit },
    async (req, reply) => {
      // Always role 'user': the schema strips any `role` the client sends.
      const user = await createUser(app.db, req.body)
      const session = createSession(app.db, user.id)
      app.auth.setSessionCookie(reply, session.token, session.expiresAt)
      reply.code(201)
      return user
    },
  )

  app.post(
    '/auth/login',
    { schema: { body: credentialsInput, response: { 200: publicUser } }, config: limit },
    async (req, reply) => {
      const { email, password } = req.body
      const found = findUserByEmail(app.db, email)
      // Unknown emails still pay for a full scrypt verify, so timing gives nothing away.
      const ok = found
        ? await verifyPassword(password, found.passwordHash)
        : await verifyAgainstDummy(password)
      if (!found || !ok) throw new HttpError(401, BAD_CREDENTIALS)

      const session = createSession(app.db, found.id)
      app.auth.setSessionCookie(reply, session.token, session.expiresAt)
      return toPublicUser(found)
    },
  )

  app.post('/auth/logout', async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE]
    if (token) deleteSession(app.db, token)
    app.auth.clearSessionCookie(reply)
    return reply.code(204).send()
  })

  app.get('/auth/me', { schema: { response: { 200: publicUser } } }, async (req) => {
    if (!req.user) throw new HttpError(401, 'Not signed in')
    return req.user
  })
}
