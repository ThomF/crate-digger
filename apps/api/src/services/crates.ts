import { asc, count, eq } from 'drizzle-orm'
import type { Crate } from '@crate-digger/shared'
import type { Db } from '../db/client.ts'
import { albums, crates } from '../db/schema.ts'
import { badRequest } from '../errors.ts'

export function listCrates(db: Db): Crate[] {
  // LEFT JOIN so empty crates still show up (with albumCount 0).
  return db
    .select({
      id: crates.id,
      name: crates.name,
      color: crates.color,
      label: crates.label,
      sortOrder: crates.sortOrder,
      albumCount: count(albums.id),
    })
    .from(crates)
    .leftJoin(albums, eq(albums.crateId, crates.id))
    .groupBy(crates.id)
    .orderBy(asc(crates.sortOrder), asc(crates.id))
    .all()
}

/** For request bodies that reference a crate: a missing crate is the client's mistake (400). */
export function assertCrateExists(db: Db, crateId: number) {
  const found = db.select({ id: crates.id }).from(crates).where(eq(crates.id, crateId)).get()
  if (!found) throw badRequest(`Crate ${crateId} does not exist`)
}
