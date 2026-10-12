import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import fp from 'fastify-plugin'
import cookie from '@fastify/cookie'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { HttpError } from '../errors.ts'

// Who may change the collection.
//
//   ADMIN_PASSWORD set     → anyone can browse; changes need a login (an "admin" cookie)
//   no password, dev/test  → open: anyone can change anything (handy on localhost)
//   no password, production → read-only for everyone, so a forgotten setting never leaves
//                             a public collection open to strangers

export type AuthOptions = {
  adminPassword?: string
  production?: boolean
  /** Signs session cookies. Defaults to a value derived from the password, so changing the
   *  password logs everyone out. */
  sessionSecret?: string
}

export type Access = { canEdit: boolean; canLogIn: boolean }

declare module 'fastify' {
  interface FastifyInstance {
    auth: {
      access(req: FastifyRequest): Access
      checkPassword(password: string): boolean
      logIn(reply: FastifyReply): void
      logOut(reply: FastifyReply): void
    }
  }
}

export const SESSION_COOKIE = 'crate_digger_session'
const SESSION_DAYS = 30
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

const sha256 = (text: string) => createHash('sha256').update(text).digest()

export const authPlugin = fp<AuthOptions>(async (app, opts) => {
  const password = opts.adminPassword || undefined
  const mode = password ? 'password' : opts.production ? 'read-only' : 'open'
  if (mode === 'read-only') {
    app.log.warn('ADMIN_PASSWORD is not set: the collection is read-only. Set it to edit.')
  }

  // Cookies are signed with an HMAC, so a visitor can't just write "admin" into one.
  // `||`, not `??`: an empty SESSION_SECRET (Compose passes "" when it's unset) must also
  // fall back, or cookies would be "signed" with an empty key.
  const secret =
    opts.sessionSecret ||
    createHmac('sha256', 'crate-digger-session')
      .update(password ?? 'none')
      .digest('hex')
  await app.register(cookie, { secret })

  function isAdmin(req: FastifyRequest) {
    const raw = req.cookies[SESSION_COOKIE]
    if (!raw) return false
    const { valid, value } = req.unsignCookie(raw)
    if (!valid || !value?.startsWith('admin:')) return false
    const issuedAt = Number(value.slice('admin:'.length))
    return Date.now() - issuedAt < SESSION_DAYS * 24 * 60 * 60 * 1000
  }

  app.decorate('auth', {
    access(req: FastifyRequest): Access {
      if (mode === 'open') return { canEdit: true, canLogIn: false }
      if (mode === 'read-only') return { canEdit: false, canLogIn: false }
      return { canEdit: isAdmin(req), canLogIn: true }
    },

    checkPassword(attempt: string) {
      if (!password) return false
      // Compare hashes in constant time, so response timing doesn't leak how many
      // characters were right (and equal-length hashes keep timingSafeEqual happy).
      return timingSafeEqual(sha256(attempt), sha256(password))
    },

    logIn(reply: FastifyReply) {
      reply.setCookie(SESSION_COOKIE, `admin:${Date.now()}`, {
        signed: true,
        httpOnly: true, // page scripts can't read it, so an XSS bug can't steal it
        sameSite: 'strict', // never sent on requests started by other sites (blocks CSRF)
        secure: !!opts.production, // HTTPS only once deployed
        path: '/',
        maxAge: SESSION_DAYS * 24 * 60 * 60,
      })
    },

    logOut(reply: FastifyReply) {
      reply.clearCookie(SESSION_COOKIE, { path: '/' })
    },
  })

  // The gatekeeper: every change to the collection goes through here first.
  app.addHook('onRequest', async (req) => {
    if (!WRITE_METHODS.has(req.method) || !req.url.startsWith('/api/')) return
    if (req.url.startsWith('/api/session')) return // logging in/out is always allowed

    const { canEdit, canLogIn } = app.auth.access(req)
    if (canEdit) return
    throw canLogIn
      ? new HttpError(401, 'Log in to change the collection')
      : new HttpError(403, 'This collection is read-only')
  })
})
