import { createHash, randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { PublicUser } from '@frisson/shared'
import type { Db } from '../db/client.ts'
import { sessions, users } from '../db/schema.ts'
import { toPublicUser } from './users.ts'

// Data classification: CONFIDENTIAL (credentials). The session token is a bearer secret:
// it lives only in the user's cookie. The database keeps its sha256, so a leaked
// database (or backup) cannot be replayed as a login.

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

/** Starts a session. Returns the token for the cookie; only its hash is stored. */
export function createSession(db: Db, userId: number): { token: string; expiresAt: Date } {
  const token = randomBytes(32).toString('base64url')
  // The column stores whole seconds, so round down to keep the cookie and row in step.
  const expiresAt = new Date(Math.floor((Date.now() + SESSION_TTL_MS) / 1000) * 1000)
  db.insert(sessions)
    .values({ id: hashToken(token), userId, expiresAt })
    .run()
  return { token, expiresAt }
}

/** The signed-in user for a cookie token, or null. Expired sessions are deleted. */
export function findSessionUser(db: Db, token: string): PublicUser | null {
  if (!token) return null
  const id = hashToken(token)
  const row = db
    .select({ expiresAt: sessions.expiresAt, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, id))
    .get()
  if (!row) return null
  if (row.expiresAt.getTime() <= Date.now()) {
    db.delete(sessions).where(eq(sessions.id, id)).run()
    return null
  }
  return toPublicUser(row.user)
}

/** Ends a session. Unknown tokens are fine (logging out twice is not an error). */
export function deleteSession(db: Db, token: string): void {
  if (!token) return
  db.delete(sessions)
    .where(eq(sessions.id, hashToken(token)))
    .run()
}
