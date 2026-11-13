import { and, count, desc, eq } from 'drizzle-orm'
import type { ProfileFavorite, PublicUser } from '@frisson/shared'
import type { Db } from '../db/client.ts'
import { albums, crateFavorites, crates, users } from '../db/schema.ts'
import { badRequest, notFound } from '../errors.ts'
import { requireUser } from './permissions.ts'

// Data classification: PUBLIC output from CONFIDENTIAL and INTERNAL rows. The users table holds
// emails and password hashes, and crate_favorites records which crates a user favorited.
// Everything leaving this module is built from the explicit field lists below, so email, role,
// numeric user ids and demo keys are never even selected. Favorites only ever act for the
// signed-in viewer; a profile lists a user's favorites as public crate cards.

function findCrateOrThrow(db: Db, crateId: number) {
  const found = db
    .select({ id: crates.id, ownerId: crates.ownerId })
    .from(crates)
    .where(eq(crates.id, crateId))
    .get()
  if (!found) throw notFound(`Crate ${crateId}`)
  return found
}

/**
 * 401 signed out, 404 unknown crate, 400 on your own crate (checked in that order). Favoriting
 * twice keeps the one row. Ownerless crates and anyone else's crates may be favorited.
 */
export function favoriteCrate(db: Db, viewer: PublicUser | null, crateId: number): void {
  const signedIn = requireUser(viewer)
  const target = findCrateOrThrow(db, crateId)
  if (target.ownerId === signedIn.id) throw badRequest('You cannot favorite your own crate')
  db.insert(crateFavorites)
    .values({ userId: signedIn.id, crateId: target.id })
    .onConflictDoNothing()
    .run()
}

/** 401 signed out, 404 unknown crate. Not having favorited it is simply a no-op. */
export function unfavoriteCrate(db: Db, viewer: PublicUser | null, crateId: number): void {
  const signedIn = requireUser(viewer)
  const target = findCrateOrThrow(db, crateId)
  db.delete(crateFavorites)
    .where(and(eq(crateFavorites.userId, signedIn.id), eq(crateFavorites.crateId, target.id)))
    .run()
}

/** Has this viewer favorited this crate? Always false when signed out (viewerId null). */
export function isFavoritedBy(db: Db, crateId: number, viewerId: number | null): boolean {
  if (viewerId === null) return false
  const row = db
    .select({ id: crateFavorites.id })
    .from(crateFavorites)
    .where(and(eq(crateFavorites.userId, viewerId), eq(crateFavorites.crateId, crateId)))
    .get()
  return row !== undefined
}

/** The crates a user favorited, newest favorited first. Public: any viewer may see them. */
export function listFavorites(db: Db, userId: number): ProfileFavorite[] {
  return db
    .select({
      id: crates.id,
      name: crates.name,
      color: crates.color,
      label: crates.label,
      // LEFT JOIN so empty crates still show up with albumCount 0.
      albumCount: count(albums.id),
      // LEFT JOIN so ownerless legacy crates show up with null owner fields.
      ownerUsername: users.username,
      ownerDisplayName: users.displayName,
    })
    .from(crateFavorites)
    .innerJoin(crates, eq(crates.id, crateFavorites.crateId))
    .leftJoin(users, eq(users.id, crates.ownerId))
    .leftJoin(albums, eq(albums.crateId, crates.id))
    .where(eq(crateFavorites.userId, userId))
    .groupBy(crates.id)
    .orderBy(desc(crateFavorites.createdAt), desc(crateFavorites.id))
    .all()
}
