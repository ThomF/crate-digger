import fp from 'fastify-plugin'
import cookie from '@fastify/cookie'
import type { FastifyReply } from 'fastify'
import type { PublicUser } from '@frisson/shared'
import { findSessionUser } from '../services/sessions.ts'

// Who is making this request. Reads the session cookie and sets request.user (or null).
// It does not decide what they may do: routes ask services/permissions.ts for that.
//
// Must be registered after dbPlugin, because it looks sessions up in app.db.

export type AuthOptions = {
  /** Secure cookies (HTTPS only). Defaults from NODE_ENV in buildApp. */
  production?: boolean
}

declare module 'fastify' {
  interface FastifyRequest {
    /** The signed-in user, or null for visitors. */
    user: PublicUser | null
  }
  interface FastifyInstance {
    auth: {
      setSessionCookie(reply: FastifyReply, token: string, expiresAt: Date): void
      clearSessionCookie(reply: FastifyReply): void
    }
  }
}

export const SESSION_COOKIE = 'frisson_session'

export const authPlugin = fp<AuthOptions>(async (app, opts) => {
  // No signing secret: the cookie holds an opaque random token, and only its hash is
  // in the database, so there is nothing for a visitor to forge.
  await app.register(cookie)

  const cookieOptions = {
    httpOnly: true, // page scripts can't read it, so an XSS bug can't steal it
    sameSite: 'lax' as const, // not sent on cross-site POSTs (CSRF), but links still work
    secure: !!opts.production, // HTTPS only once deployed
    path: '/',
  }

  app.decorateRequest('user', null)

  app.decorate('auth', {
    setSessionCookie(reply: FastifyReply, token: string, expiresAt: Date) {
      reply.setCookie(SESSION_COOKIE, token, { ...cookieOptions, expires: expiresAt })
    },
    clearSessionCookie(reply: FastifyReply) {
      reply.clearCookie(SESSION_COOKIE, cookieOptions)
    },
  })

  app.addHook('onRequest', async (req) => {
    const token = req.cookies[SESSION_COOKIE]
    req.user = token ? findSessionUser(app.db, token) : null
  })
})
