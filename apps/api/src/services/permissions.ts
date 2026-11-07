import { eq } from 'drizzle-orm'
import type { PublicUser } from '@frisson/shared'
import type { Db } from '../db/client.ts'
import { albums, crates } from '../db/schema.ts'
import { HttpError, notFound } from '../errors.ts'

// The one place that decides who may change what. Routes pass request.user in; this
// module throws HttpError (401 signed out, 403 not yours, 404 missing) and never
// touches `reply`.
//
// Rules: admins may edit everything. Everyone else may edit only crates they own (and
// the albums in them). Crates with no owner (from before accounts) are admin-only.

/** The signed-in user, or a 401. */
export function requireUser(user: PublicUser | null): PublicUser {
  if (!user) throw new HttpError(401, 'Sign in to make changes')
  return user
}

/** May this user edit something owned by `ownerId`? */
export function canEditOwner(user: PublicUser | null, ownerId: number | null): boolean {
  if (!user) return false
  if (user.role === 'admin') return true
  return ownerId !== null && ownerId === user.id
}

/** 401 if signed out, 404 if the crate is missing, 403 if it isn't theirs. */
export function assertCanEditCrate(db: Db, user: PublicUser | null, crateId: number): PublicUser {
  const signedIn = requireUser(user)
  const crate = db
    .select({ ownerId: crates.ownerId })
    .from(crates)
    .where(eq(crates.id, crateId))
    .get()
  if (!crate) throw notFound(`Crate ${crateId}`)
  if (!canEditOwner(signedIn, crate.ownerId)) {
    throw new HttpError(403, 'You can only change crates you own')
  }
  return signedIn
}

/** Same rules as assertCanEditCrate, applied to the crate the album is in. */
export function assertCanEditAlbum(db: Db, user: PublicUser | null, albumId: number): PublicUser {
  const signedIn = requireUser(user)
  const row = db
    .select({ ownerId: crates.ownerId })
    .from(albums)
    .innerJoin(crates, eq(crates.id, albums.crateId))
    .where(eq(albums.id, albumId))
    .get()
  if (!row) throw notFound(`Album ${albumId}`)
  if (!canEditOwner(signedIn, row.ownerId)) {
    throw new HttpError(403, 'You can only change records in crates you own')
  }
  return signedIn
}

/** 401 if signed out, 403 unless an admin. A role check only: whose record it is never matters. */
export function requireAdmin(user: PublicUser | null): PublicUser {
  const signedIn = requireUser(user)
  if (signedIn.role !== 'admin') throw new HttpError(403, 'Only admins can do that')
  return signedIn
}
