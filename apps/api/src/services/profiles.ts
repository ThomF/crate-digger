import { asc, count, eq } from 'drizzle-orm'
import type { ProfileCrate, PublicProfile, PublicUser, UpdateProfileInput } from '@frisson/shared'
import { MAX_PROFILE_LINKS } from '@frisson/shared'
import type { Db } from '../db/client.ts'
import { albums, crates, userLinks, users, type User } from '../db/schema.ts'
import { badRequest, notFound } from '../errors.ts'
import { requireAdmin, requireUser } from './permissions.ts'
import { findUserByUsername, getUserById } from './users.ts'

// Data classification: PUBLIC output from CONFIDENTIAL rows. The users table holds emails
// and password hashes; toPublicProfile is the only way a profile leaves this module, and it
// copies named public fields only (never id, email, role or passwordHash). Never use
// toPublicUser here: that is the private, signed-in shape.

function profileLinks(db: Db, userId: number) {
  return db
    .select({ platform: userLinks.platform, url: userLinks.url })
    .from(userLinks)
    .where(eq(userLinks.userId, userId))
    .orderBy(asc(userLinks.position), asc(userLinks.id))
    .all()
}

function profileCrates(db: Db, userId: number): ProfileCrate[] {
  // LEFT JOIN so empty crates still show up with albumCount 0.
  return db
    .select({
      id: crates.id,
      name: crates.name,
      color: crates.color,
      label: crates.label,
      albumCount: count(albums.id),
    })
    .from(crates)
    .leftJoin(albums, eq(albums.crateId, crates.id))
    .where(eq(crates.ownerId, userId))
    .groupBy(crates.id)
    .orderBy(asc(crates.sortOrder), asc(crates.id))
    .all()
}

/** The only public shape of a user. Explicit field list, so new private columns never leak. */
export function toPublicProfile(db: Db, user: User): PublicProfile {
  return {
    username: user.username,
    displayName: user.displayName,
    bio: user.bio ?? '',
    location: user.location ?? null,
    avatarUrl: user.avatarPath ?? null,
    verified: user.verified,
    links: profileLinks(db, user.id),
    crates: profileCrates(db, user.id),
  }
}

function findOrThrow(db: Db, username: string): User {
  const user = findUserByUsername(db, username.toLowerCase())
  if (!user) throw notFound('User')
  return user
}

/** Anyone may read a profile. 404 for an unknown username; lookup is case-insensitive. */
export function getPublicProfile(db: Db, username: string): PublicProfile {
  return toPublicProfile(db, findOrThrow(db, username))
}

/**
 * The signed-in user edits their own profile (401 if signed out). Fields and links are
 * replaced in one transaction, so a failure part-way changes nothing.
 */
export function updateOwnProfile(
  db: Db,
  user: PublicUser | null,
  input: UpdateProfileInput,
): PublicProfile {
  const signedIn = requireUser(user)
  // The shared schema already caps this; checked again so the service is safe on its own.
  if (input.links.length > MAX_PROFILE_LINKS) {
    throw badRequest(`Up to ${MAX_PROFILE_LINKS} links`)
  }

  db.transaction((tx) => {
    tx.update(users)
      .set({ displayName: input.displayName, bio: input.bio, location: input.location })
      .where(eq(users.id, signedIn.id))
      .run()
    tx.delete(userLinks).where(eq(userLinks.userId, signedIn.id)).run()
    if (input.links.length > 0) {
      tx.insert(userLinks)
        .values(
          input.links.map((link, position) => ({
            userId: signedIn.id,
            platform: link.platform,
            url: link.url,
            position,
          })),
        )
        .run()
    }
  })

  const fresh = getUserById(db, signedIn.id)
  if (!fresh) throw notFound('User')
  return toPublicProfile(db, fresh)
}

/** Admins only (401 signed out, 403 otherwise, even on their own name), 404 unknown user. */
export function setVerified(
  db: Db,
  actor: PublicUser | null,
  username: string,
  verified: boolean,
): PublicProfile {
  requireAdmin(actor)
  const target = findOrThrow(db, username)
  db.update(users).set({ verified }).where(eq(users.id, target.id)).run()
  return getPublicProfile(db, target.username)
}
