import type { Db } from '../db/client.ts'
import { users } from '../db/schema.ts'
import { freeAdminUsername, type BootstrapLog } from './bootstrap.ts'
import { hashDevAdminPassword } from './passwords.ts'
import { findUserByEmail } from './users.ts'

// Data classification: CONFIDENTIAL (credentials). This step writes a known, weak password's
// hash for local development. Log only fixed strings plus the username, never the password or
// the hash. See docs/adr/0007-dev-admin-login.md.

export const DEV_ADMIN_EMAIL = 'admin@frisson.com'

const silent: BootstrapLog = { info: () => {}, warn: () => {} }

/**
 * Production is checked first, so SEED_DEV_ADMIN=true can never override it. This fails open:
 * a host started with NODE_ENV unset counts as development (see docs/DEPLOY.md).
 */
export function shouldSeedDevAdmin(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV?.trim().toLowerCase() === 'production') return false
  return env.SEED_DEV_ADMIN !== 'false'
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Error && (err as { code?: unknown }).code === 'SQLITE_CONSTRAINT_UNIQUE'
}

/**
 * Adds the local admin@frisson.com / admin account if it is missing. It only ever inserts this
 * one users row: an existing account keeps its role and password, whatever they are.
 * Runs from server.ts, not buildApp, so test databases still start empty.
 */
export async function ensureDevAdmin(
  db: Db,
  env: NodeJS.ProcessEnv = process.env,
  log: BootstrapLog = silent,
): Promise<{ created: boolean }> {
  if (!shouldSeedDevAdmin(env)) return { created: false }

  const existing = findUserByEmail(db, DEV_ADMIN_EMAIL)
  if (existing) {
    if (existing.role !== 'admin') {
      log.warn(`Dev admin not added: ${DEV_ADMIN_EMAIL} is a non-admin account; not promoting it`)
    }
    return { created: false }
  }

  const passwordHash = await hashDevAdminPassword()
  // Picked after the async hash, so the name is as fresh as possible when it is inserted.
  const username = freeAdminUsername(db)

  try {
    db.insert(users)
      .values({
        email: DEV_ADMIN_EMAIL,
        username,
        displayName: 'Admin',
        passwordHash,
        role: 'admin',
      })
      .run()
  } catch (err) {
    // Another process took the email or username while this one was hashing. Not an error:
    // the row that won stays as it is. The driver's message is not logged, only a fixed string.
    if (isUniqueViolation(err)) {
      log.warn('Dev admin not added: the email or username was taken at the same moment')
      return { created: false }
    }
    throw err
  }

  log.info(`Created dev admin account ${username}`)
  return { created: true }
}
