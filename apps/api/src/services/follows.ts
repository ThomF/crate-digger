import { and, asc, count, desc, eq, isNotNull, isNull, ne } from 'drizzle-orm'
import type { CollectorSummary, CrateCard, PublicUser } from '@frisson/shared'
import type { Db } from '../db/client.ts'
import { albums, crates, follows, users, type User } from '../db/schema.ts'
import { badRequest, notFound } from '../errors.ts'
import { requireUser } from './permissions.ts'
import { findUserByUsername } from './users.ts'

// Data classification: PUBLIC output from CONFIDENTIAL and INTERNAL rows. The users table holds
// emails and password hashes, and follows records who follows whom. Everything leaving this
// module is built from the explicit field lists below, so email, role, numeric user ids and
// demo keys are never even selected. Only the signed-in viewer's own follows are ever listed.

/** The most crates the feed returns. */
export const FEED_LIMIT = 50

// isDemo is computed by the database, so the demo key itself never reaches this process.
const summaryFields = {
  username: users.username,
  displayName: users.displayName,
  avatarUrl: users.avatarPath,
  verified: users.verified,
  isDemo: isNotNull(users.demoSeedKey).mapWith(Boolean),
}

function findOrThrow(db: Db, username: string): User {
  const user = findUserByUsername(db, username)
  if (!user) throw notFound('User')
  return user
}

/** 401 signed out, 404 unknown user, 400 on yourself. Following twice keeps the one row. */
export function followUser(db: Db, viewer: PublicUser | null, username: string): void {
  const signedIn = requireUser(viewer)
  const target = findOrThrow(db, username)
  if (target.id === signedIn.id) throw badRequest('You cannot follow yourself')
  db.insert(follows)
    .values({ followerId: signedIn.id, followeeId: target.id })
    .onConflictDoNothing()
    .run()
}

/** 401 signed out, 404 unknown user. Not following them (or yourself) is simply a no-op. */
export function unfollowUser(db: Db, viewer: PublicUser | null, username: string): void {
  const signedIn = requireUser(viewer)
  const target = findOrThrow(db, username)
  db.delete(follows)
    .where(and(eq(follows.followerId, signedIn.id), eq(follows.followeeId, target.id)))
    .run()
}

/** Who the viewer follows, most recently followed first. */
export function listFollowing(db: Db, viewer: PublicUser | null): CollectorSummary[] {
  const signedIn = requireUser(viewer)
  return db
    .select(summaryFields)
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followeeId))
    .where(eq(follows.followerId, signedIn.id))
    .orderBy(desc(follows.createdAt), desc(follows.id))
    .all()
}

/** Crates owned by users the viewer follows, newest created first, up to FEED_LIMIT. */
export function getFeed(db: Db, viewer: PublicUser | null): CrateCard[] {
  const signedIn = requireUser(viewer)
  const rows = db
    .select({
      id: crates.id,
      name: crates.name,
      color: crates.color,
      label: crates.label,
      // LEFT JOIN so empty crates still show up with albumCount 0.
      albumCount: count(albums.id),
      createdAt: crates.createdAt,
      ownerUsername: users.username,
      ownerDisplayName: users.displayName,
    })
    .from(follows)
    .innerJoin(crates, eq(crates.ownerId, follows.followeeId))
    .innerJoin(users, eq(users.id, follows.followeeId))
    .leftJoin(albums, eq(albums.crateId, crates.id))
    .where(eq(follows.followerId, signedIn.id))
    .groupBy(crates.id)
    .orderBy(desc(crates.createdAt), desc(crates.id))
    .limit(FEED_LIMIT)
    .all()
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }))
}

/** Demo collectors the viewer does not follow and is not, by username. Empty without demo data. */
export function listSuggestedCollectors(db: Db, viewer: PublicUser | null): CollectorSummary[] {
  const signedIn = requireUser(viewer)
  return db
    .select(summaryFields)
    .from(users)
    .leftJoin(follows, and(eq(follows.followeeId, users.id), eq(follows.followerId, signedIn.id)))
    .where(and(isNotNull(users.demoSeedKey), ne(users.id, signedIn.id), isNull(follows.id)))
    .orderBy(asc(users.username))
    .all()
}
