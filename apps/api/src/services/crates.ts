import { and, asc, count, eq, inArray, isNull, max, ne, or } from 'drizzle-orm'
import type { Crate, CreateCrateInput, PublicUser, UpdateCrateInput } from '@frisson/shared'
import type { Db } from '../db/client.ts'
import { albums, crates, users } from '../db/schema.ts'
import { HttpError, badRequest, notFound } from '../errors.ts'
import { assertCanEditCrate, requireUser } from './permissions.ts'

// Writes take the signed-in user (request.user, or null) and check it here via
// permissions.ts, so routes stay thin and never decide who may change what.

const crateColumns = {
  id: crates.id,
  name: crates.name,
  color: crates.color,
  label: crates.label,
  sortBy: crates.sortBy,
  sortOrder: crates.sortOrder,
  albumCount: count(albums.id),
  // Data classification: PUBLIC. Only the owner's id, username and display name; never email.
  ownerId: crates.ownerId,
  ownerUsername: users.username,
  ownerDisplayName: users.displayName,
}

export function listCrates(db: Db): Crate[] {
  // LEFT JOINs so empty crates still show up (with albumCount 0), as do ownerless ones.
  return db
    .select(crateColumns)
    .from(crates)
    .leftJoin(albums, eq(albums.crateId, crates.id))
    .leftJoin(users, eq(users.id, crates.ownerId))
    .groupBy(crates.id)
    .orderBy(asc(crates.sortOrder), asc(crates.id))
    .all()
}

export function getCrate(db: Db, id: number): Crate {
  const crate = db
    .select(crateColumns)
    .from(crates)
    .leftJoin(albums, eq(albums.crateId, crates.id))
    .leftJoin(users, eq(users.id, crates.ownerId))
    .where(eq(crates.id, id))
    .groupBy(crates.id)
    .get()
  if (!crate) throw notFound(`Crate ${id}`)
  return crate
}

/** For request bodies that reference a crate: a missing crate is the client's mistake (400). */
export function assertCrateExists(db: Db, crateId: number) {
  const found = db.select({ id: crates.id }).from(crates).where(eq(crates.id, crateId)).get()
  if (!found) throw badRequest(`Crate ${crateId} does not exist`)
}

/** 401 if signed out. The new crate belongs to whoever created it. */
export function createCrate(db: Db, user: PublicUser | null, input: CreateCrateInput): Crate {
  const owner = requireUser(user)
  // New crates go at the end of the shelf.
  const last =
    db
      .select({ value: max(crates.sortOrder) })
      .from(crates)
      .get()?.value ?? -1
  const { id } = db
    .insert(crates)
    .values({ ...input, sortOrder: last + 1, ownerId: owner.id })
    .returning({ id: crates.id })
    .get()
  return getCrate(db, id)
}

/** 401 signed out, 404 missing, 403 not theirs (admins may edit any crate). */
export function updateCrate(
  db: Db,
  user: PublicUser | null,
  id: number,
  input: UpdateCrateInput,
): Crate {
  assertCanEditCrate(db, user, id)
  const result = db.update(crates).set(input).where(eq(crates.id, id)).run()
  if (result.changes === 0) throw notFound(`Crate ${id}`)
  return getCrate(db, id)
}

/** 401 signed out, 404 missing, 403 not theirs, 409 if it still holds records. */
export function deleteCrate(db: Db, user: PublicUser | null, id: number): void {
  assertCanEditCrate(db, user, id)
  const { albumCount } = getCrate(db, id) // 404 if missing
  // The database would refuse too (ON DELETE RESTRICT), but this explains why.
  if (albumCount > 0) {
    const records = albumCount === 1 ? '1 record' : `${albumCount} records`
    throw new HttpError(409, `This crate still holds ${records}. Move or remove them first.`)
  }
  db.delete(crates).where(eq(crates.id, id)).run()
}

/**
 * Sets the order of crates on the shelf. `ids` must list every crate exactly once (400).
 * 401 if signed out; unless admin, 403 if any listed crate is ownerless or someone else's.
 */
export function reorderCrates(db: Db, user: PublicUser | null, ids: number[]): Crate[] {
  const signedIn = requireUser(user)
  const existing = db
    .select({ id: crates.id })
    .from(crates)
    .all()
    .map((c) => c.id)
  const sameSet = ids.length === existing.length && existing.every((id) => ids.includes(id))
  if (!sameSet) throw badRequest('Send every crate id exactly once')

  if (signedIn.role !== 'admin' && ids.length > 0) {
    const notTheirs = db
      .select({ id: crates.id })
      .from(crates)
      .where(
        and(inArray(crates.id, ids), or(isNull(crates.ownerId), ne(crates.ownerId, signedIn.id))),
      )
      .get()
    if (notTheirs) throw new HttpError(403, 'You can only reorder crates you own')
  }

  db.transaction((tx) => {
    ids.forEach((id, sortOrder) => {
      tx.update(crates).set({ sortOrder }).where(eq(crates.id, id)).run()
    })
  })
  return listCrates(db)
}
