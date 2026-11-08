import { eq, max, or } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import {
  DEMO_CRATES,
  DEMO_NEWS,
  DEMO_USERS,
  type DemoAlbum,
  type DemoCrate,
  type DemoUser,
} from '../db/demo-content.ts'
import { albums, crates, newsItems, tracks, users } from '../db/schema.ts'
import type { BootstrapLog } from './bootstrap.ts'

// Data classification: CONFIDENTIAL when reading. The collision check below looks at real
// accounts' usernames and emails, but only to skip them: it never changes those rows and never
// logs anything of theirs. Everything it writes is fictional PUBLIC demo data (db/demo-content.ts).

/**
 * The stored password hash of every demo user. It is not a scrypt string, so verifyPassword
 * rejects every password, including this text itself. Demo users can never log in.
 */
export const DEMO_PASSWORD_HASH = 'demo-account-no-login'

export type DemoSeedCounts = {
  users: number
  crates: number
  albums: number
  tracks: number
  news: number
}

const silent: BootstrapLog = { info: () => {}, warn: () => {} }

/** The time a record is pretended to be added: one minute apart, in crate order. */
const ALBUM_ADDED_STEP_MS = 60_000

/**
 * Whether this start should add demo content: SEED_DEMO_DATA 'true' always, 'false' never,
 * otherwise everywhere except production. Compose passes "" for unset values, and that counts
 * as unset.
 */
export function shouldSeedDemo(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.SEED_DEMO_DATA === 'true') return true
  if (env.SEED_DEMO_DATA === 'false') return false
  return env.NODE_ENV !== 'production'
}

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

/** The id of this demo user, inserted if missing, or null when a real account holds the name. */
function ensureUser(tx: Tx, user: DemoUser, counts: DemoSeedCounts, log: BootstrapLog) {
  const existing = tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.demoSeedKey, user.seedKey))
    .get()
  if (existing) return existing.id

  const holder = tx
    .select({ id: users.id })
    .from(users)
    .where(or(eq(users.username, user.username), eq(users.email, user.email)))
    .get()
  if (holder) {
    log.warn(
      `Skipping demo user ${user.username} and its crates: ` +
        'that username or email already belongs to another account',
    )
    return null
  }

  const inserted = tx
    .insert(users)
    .values({
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      passwordHash: DEMO_PASSWORD_HASH,
      role: 'user',
      verified: false,
      bio: user.bio,
      demoSeedKey: user.seedKey,
      createdAt: new Date(user.createdAt),
    })
    .returning({ id: users.id })
    .get()
  counts.users += 1
  return inserted.id
}

/** The id of this demo crate, inserted after every current crate if missing. */
function ensureCrate(tx: Tx, crate: DemoCrate, ownerId: number, counts: DemoSeedCounts) {
  const existing = tx
    .select({ id: crates.id })
    .from(crates)
    .where(eq(crates.demoSeedKey, crate.seedKey))
    .get()
  if (existing) return existing.id

  const last = tx
    .select({ value: max(crates.sortOrder) })
    .from(crates)
    .get()?.value
  const createdAt = new Date(crate.createdAt)
  const inserted = tx
    .insert(crates)
    .values({
      name: crate.name,
      label: crate.label,
      color: crate.color,
      sortOrder: (last ?? -1) + 1,
      ownerId,
      demoSeedKey: crate.seedKey,
      recommendedRank: crate.recommendedRank ?? null,
      createdAt,
      updatedAt: createdAt,
    })
    .returning({ id: crates.id })
    .get()
  counts.crates += 1
  return inserted.id
}

/** Inserts this demo album with its tracks if missing. An existing album is left alone. */
function ensureAlbum(
  tx: Tx,
  album: DemoAlbum,
  crateId: number,
  addedAt: Date,
  counts: DemoSeedCounts,
) {
  const existing = tx
    .select({ id: albums.id })
    .from(albums)
    .where(eq(albums.demoSeedKey, album.seedKey))
    .get()
  if (existing) return

  const last = tx
    .select({ value: max(albums.position) })
    .from(albums)
    .where(eq(albums.crateId, crateId))
    .get()?.value
  const inserted = tx
    .insert(albums)
    .values({
      crateId,
      title: album.title,
      artist: album.artist,
      year: album.year,
      genre: album.genre,
      format: album.format,
      sleeveColor: album.sleeveColor,
      rating: album.rating,
      position: (last ?? -1) + 1,
      demoSeedKey: album.seedKey,
      createdAt: addedAt,
      updatedAt: addedAt,
    })
    .returning({ id: albums.id })
    .get()
  counts.albums += 1

  const trackRows = Object.entries(album.sides).flatMap(([side, titles]) =>
    titles.map((title, i) => ({
      albumId: inserted.id,
      side: side as 'A' | 'B' | 'C' | 'D',
      position: i + 1,
      title,
    })),
  )
  if (trackRows.length > 0) {
    tx.insert(tracks).values(trackRows).run()
    counts.tracks += trackRows.length
  }
}

/**
 * Adds whatever demo content is missing, in one transaction, and returns what it inserted.
 * It only ever inserts. Rows are matched by seed key, so a renamed demo crate stays renamed, and
 * a deleted demo row comes back (which is how demo crates return after `npm run db:seed`).
 */
export function seedDemoContent(db: Db, log: BootstrapLog = silent): DemoSeedCounts {
  const counts: DemoSeedCounts = { users: 0, crates: 0, albums: 0, tracks: 0, news: 0 }

  db.transaction((tx) => {
    const ownerIds = new Map<string, number>()
    for (const user of DEMO_USERS) {
      const id = ensureUser(tx, user, counts, log)
      if (id !== null) ownerIds.set(user.seedKey, id)
    }

    for (const crate of DEMO_CRATES) {
      const ownerId = ownerIds.get(crate.ownerSeedKey)
      if (ownerId === undefined) continue // the owner was skipped, so everything of theirs is

      const crateId = ensureCrate(tx, crate, ownerId, counts)
      crate.albums.forEach((album, i) => {
        const addedAt = new Date(new Date(crate.createdAt).getTime() + i * ALBUM_ADDED_STEP_MS)
        ensureAlbum(tx, album, crateId, addedAt, counts)
      })
    }

    for (const item of DEMO_NEWS) {
      const inserted = tx
        .insert(newsItems)
        .values({
          seedKey: item.seedKey,
          title: item.title,
          summary: item.summary,
          source: item.source,
          publishedAt: new Date(item.publishedAt),
        })
        .onConflictDoNothing({ target: newsItems.seedKey })
        .run()
      counts.news += inserted.changes
    }
  })

  return counts
}

/** seedDemoContent when the environment asks for it (see shouldSeedDemo), else null. */
export function seedDemoFromEnv(
  db: Db,
  env: NodeJS.ProcessEnv = process.env,
  log: BootstrapLog = silent,
): DemoSeedCounts | null {
  if (!shouldSeedDemo(env)) {
    log.info('Skipping demo content (set SEED_DEMO_DATA=true to add it)')
    return null
  }
  const counts = seedDemoContent(db, log)
  log.info(
    `Demo content: added ${counts.users} users, ${counts.crates} crates, ` +
      `${counts.albums} albums, ${counts.tracks} tracks, ${counts.news} news items`,
  )
  return counts
}
