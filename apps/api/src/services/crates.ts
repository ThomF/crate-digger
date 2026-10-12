import { asc, count, eq, max } from 'drizzle-orm'
import type { Crate, CreateCrateInput, UpdateCrateInput } from '@crate-digger/shared'
import type { Db } from '../db/client.ts'
import { albums, crates } from '../db/schema.ts'
import { HttpError, badRequest, notFound } from '../errors.ts'

const crateColumns = {
  id: crates.id,
  name: crates.name,
  color: crates.color,
  label: crates.label,
  sortBy: crates.sortBy,
  sortOrder: crates.sortOrder,
  albumCount: count(albums.id),
}

export function listCrates(db: Db): Crate[] {
  // LEFT JOIN so empty crates still show up (with albumCount 0).
  return db
    .select(crateColumns)
    .from(crates)
    .leftJoin(albums, eq(albums.crateId, crates.id))
    .groupBy(crates.id)
    .orderBy(asc(crates.sortOrder), asc(crates.id))
    .all()
}

export function getCrate(db: Db, id: number): Crate {
  const crate = db
    .select(crateColumns)
    .from(crates)
    .leftJoin(albums, eq(albums.crateId, crates.id))
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

export function createCrate(db: Db, input: CreateCrateInput): Crate {
  // New crates go at the end of the shelf.
  const last =
    db
      .select({ value: max(crates.sortOrder) })
      .from(crates)
      .get()?.value ?? -1
  const { id } = db
    .insert(crates)
    .values({ ...input, sortOrder: last + 1 })
    .returning({ id: crates.id })
    .get()
  return getCrate(db, id)
}

export function updateCrate(db: Db, id: number, input: UpdateCrateInput): Crate {
  const result = db.update(crates).set(input).where(eq(crates.id, id)).run()
  if (result.changes === 0) throw notFound(`Crate ${id}`)
  return getCrate(db, id)
}

export function deleteCrate(db: Db, id: number): void {
  const { albumCount } = getCrate(db, id) // 404 if missing
  // The database would refuse too (ON DELETE RESTRICT), but this explains why.
  if (albumCount > 0) {
    const records = albumCount === 1 ? '1 record' : `${albumCount} records`
    throw new HttpError(409, `This crate still holds ${records}. Move or remove them first.`)
  }
  db.delete(crates).where(eq(crates.id, id)).run()
}

/** Sets the order of crates on the shelf. `ids` must list every crate exactly once. */
export function reorderCrates(db: Db, ids: number[]): Crate[] {
  const existing = db
    .select({ id: crates.id })
    .from(crates)
    .all()
    .map((c) => c.id)
  const sameSet = ids.length === existing.length && existing.every((id) => ids.includes(id))
  if (!sameSet) throw badRequest('Send every crate id exactly once')

  db.transaction((tx) => {
    ids.forEach((id, sortOrder) => {
      tx.update(crates).set({ sortOrder }).where(eq(crates.id, id)).run()
    })
  })
  return listCrates(db)
}
