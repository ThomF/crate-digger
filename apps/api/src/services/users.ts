import { eq } from 'drizzle-orm'
import type { PublicUser, SignupInput, UserRole } from '@frisson/shared'
import type { Db } from '../db/client.ts'
import { users, type User } from '../db/schema.ts'
import { HttpError } from '../errors.ts'
import { hashPassword } from './passwords.ts'

// Data classification: CONFIDENTIAL (PII + credentials). Rows here hold emails and
// password hashes. Only toPublicUser output may leave the API, and it never has the hash.

const EMAIL_TAKEN = 'Email already registered'
const USERNAME_TAKEN = 'Username taken'

/** The only shape of a user the API ever sends. Drops passwordHash and createdAt. */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  }
}

export function findUserByEmail(db: Db, email: string): User | undefined {
  return db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).get()
}

export function findUserByUsername(db: Db, username: string): User | undefined {
  return db.select().from(users).where(eq(users.username, username.trim().toLowerCase())).get()
}

export function getUserById(db: Db, id: number): User | undefined {
  return db.select().from(users).where(eq(users.id, id)).get()
}

function isUniqueViolation(err: unknown): err is Error & { message: string } {
  return (
    err instanceof Error &&
    (err as { code?: unknown }).code === 'SQLITE_CONSTRAINT_UNIQUE' &&
    typeof err.message === 'string'
  )
}

/**
 * Creates a user. Email and username are stored lower-cased; displayName defaults to the
 * username. Throws 409 when the email or username is already in use. The role is set by
 * the caller (signup always passes the default 'user'), never by the request body.
 */
export async function createUser(
  db: Db,
  input: SignupInput,
  role: UserRole = 'user',
): Promise<PublicUser> {
  const email = input.email.trim().toLowerCase()
  const username = input.username.trim().toLowerCase()
  const displayName = input.displayName?.trim() || username

  if (findUserByEmail(db, email)) throw new HttpError(409, EMAIL_TAKEN)
  if (findUserByUsername(db, username)) throw new HttpError(409, USERNAME_TAKEN)

  const passwordHash = await hashPassword(input.password)

  try {
    const row = db
      .insert(users)
      .values({ email, username, displayName, passwordHash, role })
      .returning()
      .get()
    return toPublicUser(row)
  } catch (err) {
    // Two signups racing past the pre-checks above (the hash is async in between).
    if (isUniqueViolation(err)) {
      throw new HttpError(409, err.message.includes('users.email') ? EMAIL_TAKEN : USERNAME_TAKEN)
    }
    throw err
  }
}
