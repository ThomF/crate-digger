import { asc, eq, isNull } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { crates, users } from '../db/schema.ts'
import { HttpError } from '../errors.ts'
import { createUser, findUserByUsername } from './users.ts'

// Data classification: CONFIDENTIAL (credentials). The bootstrap password comes from the
// environment, is hashed by createUser and is never logged.

export type BootstrapLog = {
  info: (msg: string) => void
  warn: (msg: string) => void
}

export type BootstrapResult = {
  /** True when this call created the admin. */
  created: boolean
  /** The admin that now owns legacy crates, if there is one. */
  adminId: number | null
  /** How many ownerless crates were handed to that admin. */
  assignedCrates: number
}

const silent: BootstrapLog = { info: () => {}, warn: () => {} }

export function freeAdminUsername(db: Db): string {
  if (!findUserByUsername(db, 'admin')) return 'admin'
  for (let n = 2; ; n++) {
    const candidate = `admin-${n}`
    if (!findUserByUsername(db, candidate)) return candidate
  }
}

function earliestAdminId(db: Db): number | null {
  const row = db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, 'admin'))
    .orderBy(asc(users.id))
    .get()
  return row?.id ?? null
}

/**
 * Runs on every start. Creates the first admin from the given email and password when no
 * admin exists yet (it never changes an existing admin's password), then gives every
 * crate without an owner to the earliest admin. Safe to run any number of times.
 */
export async function bootstrapAdmin(
  db: Db,
  { email, password }: { email?: string; password?: string },
  log: BootstrapLog = silent,
): Promise<BootstrapResult> {
  let created = false
  let adminId = earliestAdminId(db)

  if (adminId === null) {
    if (!email || !password) {
      log.warn(
        'No admin account exists and ADMIN_EMAIL / ADMIN_PASSWORD are not both set: ' +
          'skipping admin creation. Legacy crates stay admin-only until an admin exists.',
      )
    } else {
      try {
        const admin = await createUser(
          db,
          { email, username: freeAdminUsername(db), displayName: 'Admin', password },
          'admin',
        )
        adminId = admin.id
        created = true
        log.info(`Created admin account ${admin.username}`)
      } catch (err) {
        // ADMIN_EMAIL already belongs to an ordinary account: refuse to promote it silently.
        if (err instanceof HttpError && err.statusCode === 409) {
          log.warn(`Could not create the admin account: ${err.message}`)
        } else {
          throw err
        }
      }
    }
  }

  let assignedCrates = 0
  if (adminId !== null) {
    assignedCrates = db
      .update(crates)
      .set({ ownerId: adminId })
      .where(isNull(crates.ownerId))
      .run().changes
    if (assignedCrates > 0) log.info(`Assigned ${assignedCrates} ownerless crate(s) to the admin`)
  }

  return { created, adminId, assignedCrates }
}

/** bootstrapAdmin with ADMIN_EMAIL / ADMIN_PASSWORD from the environment. */
export function bootstrapFromEnv(
  db: Db,
  env: NodeJS.ProcessEnv = process.env,
  log: BootstrapLog = silent,
): Promise<BootstrapResult> {
  // `||`: Compose passes "" for unset values, which must count as missing.
  return bootstrapAdmin(
    db,
    { email: env.ADMIN_EMAIL || undefined, password: env.ADMIN_PASSWORD || undefined },
    log,
  )
}
